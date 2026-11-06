#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Opens the local console in a browser and signs in a dedicated test login.

.DESCRIPTION
    These Cognito users live only on the Level 5 test tenants. They are not
    customer logins and they are not on the public player venue list.

    Login                  Role                 Where
    test-venue-admin       Venue Administrator  Level 5 Venue A1 only
    test-front-desk        Front Desk           Level 5 Venue A1 only
    test-account-owner     Account Owner        Tenant A (A1, A2) and Tenant B (B1)
    test-cloud-admin       Cloud Administrator  Every venue in Tenant A
    test-fleet-admin       Fleet Administrator  Fleet for Tenant A
    test-billing-admin     Billing Admin        Billing for Tenant A
    test-technician        Technician           Local device and fleet reads, Tenant A
    test-operator          Operator             Local device only

    Tenants: operator-test-l5 (Level 5 Test Tenant A) and operator-test-l5b.
    Venues: venue-l5-a1, venue-l5-a2, venue-l5-b1.
    The Chicago and Nashville lab venues are not part of this login set.

    The password is read from BANDIT_E2E_PASSWORD, from gitignored
    .test-login.local, or from BanditArena/credentials/test-credentials.json
    for that username. Real sign-in uses Cognito, so Venue hours and
    Reservations show the Level 5 data.

    -Bypass skips Cognito and opens the local mock shell. That is for clicking
    through the console without the cloud. Cloud calls are not authenticated.

.EXAMPLE
    .\scripts\Start-TestLogin.ps1

.EXAMPLE
    .\scripts\Start-TestLogin.ps1 -Username test-account-owner

.EXAMPLE
    .\scripts\Start-TestLogin.ps1 -Bypass -Username test-front-desk
#>
param(
    [ValidateSet(
        'test-venue-admin',
        'test-front-desk',
        'test-account-owner',
        'test-cloud-admin',
        'test-fleet-admin',
        'test-billing-admin',
        'test-technician',
        'test-operator'
    )]
    [string]$Username = 'test-venue-admin',

    [switch]$Bypass
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$secretFile = Join-Path $projectRoot '.test-login.local'
$localUrl = 'http://localhost:5173'

$roleByUser = @{
    'test-venue-admin'   = 'venue-admin'
    'test-front-desk'    = 'front-desk'
    'test-account-owner' = 'account-owner'
    'test-cloud-admin'   = 'cloud-admin'
    'test-fleet-admin'   = 'fleet-admin'
    'test-billing-admin' = 'billing-admin'
    'test-technician'    = 'technician'
    'test-operator'      = 'operator'
}

function Test-LocalConsole {
    try {
        $request = [System.Net.HttpWebRequest]::Create('http://localhost:5173')
        $request.Timeout = 2000
        $request.Method = 'GET'
        $response = $request.GetResponse()
        $response.Close()
        return $true
    } catch {
        return $false
    }
}

function Read-LocalPassword {
    if ($env:BANDIT_E2E_PASSWORD) { return $env:BANDIT_E2E_PASSWORD }
    if (Test-Path $secretFile) {
        foreach ($line in Get-Content $secretFile) {
            if ($line -match '^\s*BANDIT_E2E_PASSWORD=(.*)$') {
                $value = $Matches[1].Trim()
                if ($value) { return $value }
            }
        }
    }
    $credentials = Join-Path (Split-Path $projectRoot -Parent) 'BanditArena\credentials\test-credentials.json'
    if (-not (Test-Path $credentials)) { return $null }
    $parsed = Get-Content $credentials -Raw | ConvertFrom-Json
    $match = $parsed.administratorPool.users | Where-Object { $_.username -eq $Username }
    if ($match -and $match.password -and -not $match.password.StartsWith('__SET_')) {
        return $match.password
    }
    return $null
}

$password = Read-LocalPassword
if (-not $Bypass -and -not $password) {
    if (-not (Test-Path $secretFile)) {
        @(
            '# Gitignored. One line, the Cognito password for the test-* logins.',
            'BANDIT_E2E_PASSWORD='
        ) | Set-Content -Path $secretFile -Encoding utf8
    }
    throw "Put the test login password in $secretFile as BANDIT_E2E_PASSWORD=... or set that environment variable. Then run this script again."
}

if (-not (Test-LocalConsole)) {
    Write-Host 'Starting the local console on http://localhost:5173' -ForegroundColor Cyan
    Start-Process -FilePath 'powershell' -ArgumentList @(
        '-NoProfile', '-File', (Join-Path $PSScriptRoot 'Start-Local.ps1')
    ) -WorkingDirectory $projectRoot
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 1
        if (Test-LocalConsole) { $ready = $true; break }
    }
    if (-not $ready) {
        throw 'The local console did not start on port 5173.'
    }
}

$role = $roleByUser[$Username]
if ($Bypass) {
    $url = "$localUrl/?e2eAuthBypass=true&e2eUser=$([uri]::EscapeDataString($Username))&e2eRole=$([uri]::EscapeDataString($role))"
    Write-Host "Opening the Windows browser as $Username ($role)." -ForegroundColor Cyan
} else {
    $url = $localUrl
    Write-Host "Opening the Windows browser. Sign in as $Username." -ForegroundColor Cyan
}

$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

if ($browser) {
    Start-Process -FilePath $browser -ArgumentList @('--new-window', $url)
} else {
    Start-Process $url
}

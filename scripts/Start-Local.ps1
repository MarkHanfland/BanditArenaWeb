#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Starts the BanditArenaWeb Vite development server.

.DESCRIPTION
    Ensures local env configuration exists, installs npm dependencies when needed,
    and runs the dev server on http://localhost:5173.

    Device pages call the Bandit Arena REST API at http://localhost:9724.
    Cloud pages use /api (proxied to API Gateway in dev).

.EXAMPLE
    .\scripts\Start-Local.ps1
#>

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$envExample = Join-Path $projectRoot '.env.example'
$envFile = Join-Path $projectRoot '.env'
$nodeModules = Join-Path $projectRoot 'node_modules'

if (-not (Test-Path (Join-Path $projectRoot 'package.json'))) {
    throw "BanditArenaWeb package.json not found at $projectRoot"
}

if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item $envExample $envFile
    Write-Host "Created .env from .env.example" -ForegroundColor Yellow
}

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    throw 'npm not found. Install Node.js 20+.'
}

Push-Location $projectRoot
try {
    if (-not (Test-Path $nodeModules)) {
        Write-Host 'Installing npm dependencies...' -ForegroundColor Cyan
        npm ci
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed with exit code $LASTEXITCODE"
        }
    }

    Write-Host 'Starting BanditArenaWeb dev server on http://localhost:5173' -ForegroundColor Cyan
    Write-Host 'Device API: http://localhost:9724 | Cloud API: /api (proxied)' -ForegroundColor Cyan
    Write-Host 'Press Ctrl+C to stop' -ForegroundColor Yellow
    Write-Host ''

    npm run dev
    if ($LASTEXITCODE -ne 0) {
        throw "npm run dev failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

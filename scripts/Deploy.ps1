#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Builds and deploys BanditArenaWeb to production S3 + CloudFront.

.DESCRIPTION
    Wraps Sync-BanditArenaWebsite.ps1 from BanditArenaCloudInfrastructure.
    Requires AWS CLI credentials with access to the arena website stack.

.PARAMETER Region
    AWS region for the website stack (default: us-east-1).

.PARAMETER StackName
    CloudFormation stack name (default: bandit-arena-website-prod).

.PARAMETER SkipBuild
    Skip npm build and sync existing dist/ only.

.PARAMETER SkipInvalidation
    Skip CloudFront cache invalidation after S3 sync.

.EXAMPLE
    .\scripts\Deploy.ps1

.EXAMPLE
    .\scripts\Deploy.ps1 -SkipBuild
#>

param(
    [string]$Region = 'us-east-1',
    [string]$StackName = 'bandit-arena-website-prod',
    [switch]$SkipBuild,
    [switch]$SkipInvalidation
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$infraRoot = (Resolve-Path (Join-Path $projectRoot '..\BanditArenaCloudInfrastructure')).Path
$syncScript = Join-Path $infraRoot 'scripts\aws\Sync-BanditArenaWebsite.ps1'

if (-not (Test-Path $syncScript)) {
    throw "Deploy helper not found: $syncScript"
}

Write-Host 'Deploying BanditArenaWeb to banditarena.com (S3 + CloudFront)...' -ForegroundColor Cyan

$syncParams = @{
    Region      = $Region
    StackName   = $StackName
    WebsiteRoot = $projectRoot
}
if ($SkipBuild) { $syncParams.SkipBuild = $true }
if ($SkipInvalidation) { $syncParams.SkipInvalidation = $true }

& $syncScript @syncParams

if ($LASTEXITCODE -ne 0) {
    throw "Deploy failed with exit code $LASTEXITCODE"
}

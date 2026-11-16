<#
.SYNOPSIS
    FreeShow ChurchTools Patcher for Windows
.DESCRIPTION
    Patches existing FreeShow with ChurchTools integration.
    Run as Administrator for best results.
.NOTES
    Run: Set-ExecutionPolicy Bypass -Scope Process -Force; .\patch-freeshow.ps1
#>

param(
    [string]$FreeShowPath = "",
    [string]$GitHubRepo = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "! $msg" -ForegroundColor Yellow }
function Write-ErrorMsg { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }

# Auto-detect repo
if (-not $GitHubRepo) {
    $remoteUrl = git config --get remote.origin.url 2>$null
    if ($remoteUrl -match 'github\.com[:/]([^/]+/[^/]+)(\.git)?$') {
        $GitHubRepo = $matches[1]
    } else {
        $GitHubRepo = "Felixstro-dev/FreeshowChurchToolsDownloader"
    }
}

Write-Step "FreeShow ChurchTools Patcher (repo: $GitHubRepo)"

# Find FreeShow
$possiblePaths = @(
    "C:\Program Files\FreeShow\resources",
    "C:\Program Files (x86)\FreeShow\resources",
    "$env:LOCALAPPDATA\Programs\FreeShow\resources",
    "$env:APPDATA\FreeShow\resources"
)
if ($FreeShowPath) { $possiblePaths = @($FreeShowPath) + $possiblePaths }

$foundPath = $null
foreach ($path in $possiblePaths) {
    $asar = Join-Path $path "app.asar"
    if (Test-Path $asar) { $foundPath = $path; break }
}

if (-not $foundPath) {
    Write-ErrorMsg "FreeShow not found. Use -FreeShowPath 'C:\Custom\Path\FreeShow'"
    exit 1
}
Write-Success "Found: $foundPath"

$appAsar = Join-Path $foundPath "app.asar"
if (-not (Test-Path $appAsar)) { Write-ErrorMsg "app.asar not found"; exit 1 }

# Backup
$backupPath = "$appAsar.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (-not (Test-Path $backupPath) -or $Force) {
    Write-Step "Backing up..."; Copy-Item $appAsar $backupPath -Force; Write-Success "Backup: $backupPath"
}

# Extract
$tempDir = [System.IO.Path]::GetTempFileName()
Remove-Item $tempDir -Force
New-Item -ItemType Directory -Path $tempDir | Out-Null

Write-Step "Extracting..."
npx asar extract $appAsar $tempDir
Write-Success "Extracted"

# Patch
Write-Step "Patching..."
$churchToolsDir = Join-Path $tempDir "electron" "contentProviders" "churchtools"
New-Item -ItemType Directory -Force -Path $churchToolsDir | Out-Null

$registryFile = Join-Path $tempDir "electron" "contentProviders" "ContentProviderRegistry.ts"
if (Test-Path $registryFile) {
    $content = Get-Content $registryFile -Raw
    if ($content -notmatch "churchtools") {
        $content = $content -replace '^(import .* from "\./ContentProviderFactory";)', '$1`nimport { ChurchToolsProvider } from "./churchtools/ChurchToolsProvider";'
        $content = $content -replace '(ContentProviderFactory\.register\([^)]+\);)', '$1`nContentProviderFactory.register("churchtools", ChurchToolsProvider);'
        Set-Content $registryFile $content -Encoding UTF8
        Write-Success "Updated registry"
    }
}

# Minimal ChurchToolsProvider
$providerFile = Join-Path $churchToolsDir "ChurchToolsProvider.ts"
Set-Content $providerFile @'
import { ContentProvider } from "../base/ContentProvider"
import type { ContentLibraryCategory, ContentFile } from "../base/types"

export class ChurchToolsProvider extends ContentProvider<any, any> {
    constructor() {
        super({ providerId: "churchtools", displayName: "ChurchTools", port: 5503, clientId: "", clientSecret: "", apiUrl: "", scopes: ["calendar", "services", "songs", "events", "persons", "files"] as const })
    }
    isConnected(): boolean { return false }
    async connect(): Promise<any> { return null }
    disconnect(): void {}
    async apiRequest(data: any): Promise<any> { throw new Error("Build from source for full features") }
    async loadServices(): Promise<void> {}
    async startupLoad(): Promise<void> {}
    async getContentLibrary(): Promise<any[]> { return [] }
    async getContent(key: string): Promise<any[]> { return [] }
    protected handleAuthCallback(req: any, res: any): void {}
    protected async refreshToken(): Promise<any> { return null }
    protected async authenticate(): Promise<any> { return null }
}
'@

# Rebuild
Write-Step "Rebuilding app.asar..."
npx asar pack $tempDir $appAsar
Write-Success "Done!"

Write-Host ""
Write-Host "Restart FreeShow → Settings → ChurchTools → Configure → Connect" -ForegroundColor Cyan
Write-Warning "Minimal patch. For full features, build from source: git clone && npm ci && npm run release:local"
'@
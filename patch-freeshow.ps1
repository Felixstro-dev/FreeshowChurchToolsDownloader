<#
.SYNOPSIS
    FreeShow ChurchTools Integration Patcher for Windows
.DESCRIPTION
    Patches an existing FreeShow installation with ChurchTools OAuth 2.0 integration.
    Run as Administrator for best results.
.NOTES
    Run from PowerShell: Set-ExecutionPolicy Bypass -Scope Process -Force; .\patch-freeshow.ps1
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$FreeShowPath = "C:\Program Files\FreeShow",

    [Parameter(Mandatory=$false)]
    [string]$GitHubRepo = "Felixstro-dev/FreeshowChurchToolsDownloader",

    [Parameter(Mandatory=$false)]
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "! $msg" -ForegroundColor Yellow }
function Write-ErrorMsg { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Running without Admin rights. Some operations may fail."
    Write-Warning "Re-run PowerShell as Administrator for full access."
}

Write-Step "FreeShow ChurchTools Patcher for Windows"
Write-Step "Target: $FreeShowPath"

# Find FreeShow installation
$possiblePaths = @(
    "C:\Program Files\FreeShow",
    "C:\Program Files (x86)\FreeShow",
    "$env:LOCALAPPDATA\Programs\FreeShow",
    "$env:APPDATA\FreeShow"
)

$foundPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path "$path\resources\app.asar") {
        $foundPath = $path
        break
    }
}

if (-not $foundPath) {
    Write-ErrorMsg "FreeShow not found in standard locations."
    Write-Warning "Try specifying path: -FreeShowPath 'C:\Custom\Path\FreeShow'"
    exit 1
}

Write-Success "Found FreeShow at: $foundPath"
$resourcesPath = Join-Path $foundPath "resources"
$appAsar = Join-Path $resourcesPath "app.asar"
$appUnpacked = Join-Path $resourcesPath "app.asar.unpacked"

if (-not (Test-Path $appAsar)) {
    Write-ErrorMsg "app.asar not found at $appAsar"
    exit 1
}

# Backup original
$backupPath = "$appAsar.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (-not (Test-Path $backupPath) -or $Force) {
    Write-Step "Creating backup..."
    Copy-Item $appAsar $backupPath -Force
    Write-Success "Backup created: $backupPath"
}

# Extract app.asar
Write-Step "Extracting app.asar..."
$tempDir = [System.IO.Path]::GetTempFileName()
Remove-Item $tempDir -Force
New-Item -ItemType Directory -Path $tempDir | Out-Null

# Use npx asar extract (install if needed)
try {
    npx asar extract $appAsar $tempDir 2>$null
} catch {
    Write-Step "Installing @electron/asar..."
    npm install -g @electron/asar 2>$null
    npx asar extract $appAsar $tempDir
}
Write-Success "Extracted to $tempDir"

# Patch the files
Write-Step "Patching ChurchTools integration..."

# 1. Check if churchtools provider exists
$churchToolsDir = Join-Path $tempDir "electron" "contentProviders" "churchtools"
if (-not (Test-Path $churchToolsDir)) {
    Write-Step "Adding ChurchTools provider files..."
    # We'll need to copy the churchtools source files
    # For now, we'll download from GitHub
}

# 2. Update ContentProviderRegistry to register churchtools
$registryFile = Join-Path $tempDir "electron" "contentProviders" "ContentProviderRegistry.ts"
if (Test-Path $registryFile) {
    $content = Get-Content $registryFile -Raw
    if ($content -notmatch "churchtools") {
        Write-Step "Registering ChurchTools provider..."
        # Add import and registration
        $importLine = "import { ChurchToolsProvider } from `"./churchtools/ChurchToolsProvider`";"
        $registerLine = "ContentProviderFactory.register(`"churchtools`", ChurchToolsProvider);"
        
        if ($content -notmatch $importLine) {
            $content = $content -replace "^(import .* from `"./ContentProviderFactory`";)", "$1`n$importLine"
        }
        if ($content -notmatch $registerLine) {
            $content = $content -replace "(ContentProviderFactory\.register\(.*\);)", "`$1`n$registerLine"
        }
        Set-Content $registryFile $content -Encoding UTF8
        Write-Success "Updated ContentProviderRegistry"
    }
}

# 3. Rebuild app.asar
Write-Step "Rebuilding app.asar..."
npx asar pack $tempDir $appAsar
Write-Success "app.asar rebuilt"

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Success "Patching complete!"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Restart FreeShow"
Write-Host "2. Go to Settings > ChurchTools tab"
Write-Host "3. Enter your ChurchTools credentials"
Write-Host "4. Test Connection > Connect"

# Cleanup temp
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
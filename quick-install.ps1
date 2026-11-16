<#
.SYNOPSIS
    FreeShow ChurchTools Quick Installer for Windows
.DESCRIPTION
    Downloads and installs FreeShow with ChurchTools integration.
    Creates desktop shortcut and start menu entry.
.NOTES
    Run: Set-ExecutionPolicy Bypass -Scope Process -Force; iwr https://raw.githubusercontent.com/YOUR_USERNAME/freeshow-churchtools/main/quick-install.ps1 -UseBasicParsing | iex
#>

$ErrorActionPreference = "Stop"

$GITHUB_REPO = "YOUR_USERNAME/freeshow-churchtools"
$APPIMAGE_NAME = "FreeShow-1.6.8-beta.4-win.exe"
$INSTALL_DIR = "$env:PROGRAMFILES\FreeShow"
$DESKTOP_DIR = [Environment]::GetFolderPath("Desktop")
$START_MENU_DIR = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"

function Write-Step { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "! $msg" -ForegroundColor Yellow }
function Write-ErrorMsg { param($msg) Write-Host "✗ $msg" -ForegroundColor Red }

Write-Step "FreeShow ChurchTools Quick Installer for Windows"

# Check for admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Not running as Administrator. Installing to user directory instead."
    $INSTALL_DIR = "$env:LOCALAPPDATA\Programs\FreeShow"
}

# Create directories
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $START_MENU_DIR | Out-Null

# Download
Write-Step "Downloading FreeShow installer..."
$DOWNLOAD_URL = "https://github.com/$GITHUB_REPO/releases/latest/download/$APPIMAGE_NAME"
$TEMP_FILE = [System.IO.Path]::GetTempFileName() + ".exe"

try {
    Invoke-WebRequest -Uri $DOWNLOAD_URL -OutFile $TEMP_FILE -ErrorAction Stop
    Write-Success "Downloaded"
} catch {
    Write-ErrorMsg "Failed to download: $_"
    exit 1
}

# Install
Write-Step "Installing to $INSTALL_DIR..."
Move-Item $TEMP_FILE -Destination "$INSTALL_DIR\FreeShow.exe" -Force
Write-Success "Installed"

# Create shortcuts
Write-Step "Creating shortcuts..."
$WSH = New-Object -ComObject WScript.Shell

$desktopShortcut = $WSH.CreateShortcut("$DESKTOP_DIR\FreeShow.lnk")
$desktopShortcut.TargetPath = "$INSTALL_DIR\FreeShow.exe"
$desktopShortcut.WorkingDirectory = $INSTALL_DIR
$desktopShortcut.Description = "FreeShow with ChurchTools integration"
$desktopShortcut.Save()

$startMenuShortcut = $WSH.CreateShortcut("$START_MENU_DIR\FreeShow.lnk")
$startMenuShortcut.TargetPath = "$INSTALL_DIR\FreeShow.exe"
$startMenuShortcut.WorkingDirectory = $INSTALL_DIR
$startMenuShortcut.Description = "FreeShow with ChurchTools integration"
$startMenuShortcut.Save()

Write-Success "Shortcuts created"

# Download icon
try {
    Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$GITHUB_REPO/main/build/public/icon.ico" -OutFile "$INSTALL_DIR\freeshow.ico" -ErrorAction SilentlyContinue
    Write-Success "Icon downloaded"
} catch {
    Write-Warning "Could not download icon"
}

Write-Success "FreeShow installed successfully!"
Write-Host ""
Write-Host "Run FreeShow from Desktop or Start Menu" -ForegroundColor Cyan
Write-Host ""
Write-Host "To configure ChurchTools:" -ForegroundColor Cyan
Write-Host "  1. Open FreeShow → Settings → ChurchTools tab"
Write-Host "  2. Enter Base URL, Client ID, Client Secret"
Write-Host "  3. Test Connection → Connect (OAuth)"
Write-Host "  4. Import → ChurchTools → Select service → Import"
#!/bin/bash
# FreeShow ChurchTools Installer - Auto-detects repo from git remote

set -e

# Auto-detect repo from git remote
REPO_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")
if [[ "$REPO_URL" =~ github\.com[:/]([^/]+/[^/]+)(\.git)?$ ]]; then
    GITHUB_REPO="${BASH_REMATCH[1]}"
else
    GITHUB_REPO="Felixstro-dev/FreeshowChurchToolsDownloader"
fi

APPIMAGE_NAME="FreeShow-1.6.8-beta.4-x86_64.AppImage"
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" ]]; then print_error "Only x86_64 supported"; exit 1; fi

print_step "Installing FreeShow with ChurchTools from $GITHUB_REPO..."

mkdir -p "$INSTALL_DIR" "$HOME/.local/share/applications" "$ICON_DIR"

print_step "Downloading AppImage..."
DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/latest/download/FreeShow-1.6.8-beta.4-x86_64.AppImage"
TEMP_FILE=$(mktemp --suffix=.AppImage)

if curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL" 2>/dev/null; then
    print_success "Downloaded"
else
    print_error "Download failed. Build from source?"
    exit 1
fi

print_step "Installing to $INSTALL_DIR..."
chmod +x "$TEMP_FILE"
cp "$TEMP_FILE" "$INSTALL_DIR/freeshow"
rm "$TEMP_FILE"
print_success "Installed"

print_step "Installing icon..."
curl -fsSL "https://raw.githubusercontent.com/$GITHUB_REPO/main/build/public/512x512.png" -o "$ICON_DIR/freeshow.png" 2>/dev/null || print_warning "Icon download failed"

cat > "$DESKTOP_DIR/freeshow.desktop" << EOF
[Desktop Entry]
Name=FreeShow
Exec=$INSTALL_DIR/freeshow %U
Icon=freeshow
Type=Application
Categories=AudioVideo;Audio;
Comment=Show song lyrics and more for free!
StartupWMClass=FreeShow
X-AppImage-Version=1.6.8-beta.4
EOF

command -v update-desktop-database &>/dev/null && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    print_warning "Add to PATH: echo 'export PATH=\"\$PATH:$INSTALL_DIR\"' >> ~/.bashrc"
fi

print_success "FreeShow installed! Run 'freeshow' or find in app menu"
echo ""
echo "Configure ChurchTools: Settings → ChurchTools → Enter credentials → Test → Connect"
echo "Import: Import → ChurchTools → Select service → Preview → Import"
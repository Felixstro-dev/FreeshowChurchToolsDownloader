#!/bin/bash
# FreeShow Installer Script with ChurchTools Integration
# Usage: curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/install.sh | bash

set -e

# ===== CONFIGURATION - UPDATE THESE =====
GITHUB_REPO="Felixstro-dev/FreeshowChurchToolsDownloader"
APPIMAGE_NAME="FreeShow-1.6.8-beta.4-x86_64.AppImage"
# ========================================

INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Detect architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" ]]; then
    print_error "Only x86_64 is supported currently"
    exit 1
fi

print_step "Installing FreeShow with ChurchTools integration..."

# Create directories
mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$ICON_DIR"

# Download AppImage
print_step "Downloading FreeShow AppImage..."
DOWNLOAD_URL="https://github.com/$GITHUB_REPO/releases/latest/download/FreeShow-1.6.8-beta.4-x86_64.AppImage"
TEMP_FILE=$(mktemp --suffix=.AppImage)

if curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL" 2>/dev/null; then
    print_success "Downloaded successfully"
else
    print_error "Failed to download from GitHub releases"
    print_warning "Trying alternative: building from source..."
    print_step "Cloning repository..."
    TEMP_DIR=$(mktemp -d)
    git clone "https://github.com/$GITHUB_REPO.git" "$TEMP_DIR"
    cd "$TEMP_DIR"
    npm ci
    npm run release:local
    cp dist/*.AppImage "$TEMP_FILE"
    cd - > /dev/null
    rm -rf "$TEMP_DIR"
fi

# Install AppImage
print_step "Installing to $INSTALL_DIR..."
chmod +x "$TEMP_FILE"
cp "$TEMP_FILE" "$INSTALL_DIR/freeshow"
rm "$TEMP_FILE"
print_success "AppImage installed"

# Download icon
print_step "Installing icon..."
curl -fsSL "https://raw.githubusercontent.com/$GITHUB_REPO/main/build/public/512x512.png" -o "$ICON_DIR/freeshow.png" 2>/dev/null || print_warning "Could not download icon"

# Create desktop entry
print_step "Creating desktop entry..."
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

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

# Create symlink for CLI
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    print_warning "Add $INSTALL_DIR to your PATH for CLI access:"
    echo "  echo 'export PATH=\"\$PATH:$INSTALL_DIR\"' >> ~/.bashrc"
fi

print_success "FreeShow installed successfully!"
echo ""
echo "Run 'freeshow' from terminal or find 'FreeShow' in your application menu"
echo ""
echo "To configure ChurchTools:"
echo "  1. Open FreeShow → Settings → ChurchTools tab"
echo "  2. Enter your ChurchTools Base URL, Client ID, Client Secret"
echo "  3. Test Connection → Connect (OAuth flow)"
echo "  4. Import → ChurchTools → Select service → Preview → Import"
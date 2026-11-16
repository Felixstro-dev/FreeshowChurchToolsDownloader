#!/bin/bash
# Quick Install - Run on second PC
# Usage: curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/freeshow-churchtools/main/quick-install.sh | bash

set -e

GITHUB_REPO="YOUR_USERNAME/freeshow-churchtools"
INSTALL_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/512x512/apps"

echo "🚀 Installing FreeShow with ChurchTools..."

mkdir -p "$INSTALL_DIR" "$DESKTOP_DIR" "$ICON_DIR"

echo "📥 Downloading AppImage..."
curl -L -o "$INSTALL_DIR/freeshow" \
  "https://github.com/$GITHUB_REPO/releases/latest/download/FreeShow-1.6.8-beta.4-x86_64.AppImage"

chmod +x "$INSTALL_DIR/freeshow"

echo "🎨 Installing icon..."
curl -fsSL "https://raw.githubusercontent.com/$GITHUB_REPO/main/build/public/512x512.png" -o "$ICON_DIR/freeshow.png" 2>/dev/null

cat > "$HOME/.local/share/applications/freeshow.desktop" << EOF
[Desktop Entry]
Name=FreeShow
Exec=$INSTALL_DIR/freeshow %U
Icon=freeshow
Type=Application
Categories=AudioVideo;Audio;
Comment=Show song lyrics and more for free!
StartupWMClass=FreeShow
EOF

command -v update-desktop-database &>/dev/null && update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

echo "✅ FreeShow installed!"
echo "Run 'freeshow' or find it in your app menu"
echo ""
echo "🔧 Configure ChurchTools:"
echo "  1. Settings → ChurchTools tab"
echo "  2. Enter Base URL, Client ID, Client Secret"
echo "  3. Test Connection → Connect"
echo "  4. Import → ChurchTools"
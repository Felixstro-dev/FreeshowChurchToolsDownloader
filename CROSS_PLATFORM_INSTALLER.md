# Cross-Platform FreeShow ChurchTools Installer/Patcher

This toolkit provides multiple ways to install or patch FreeShow with ChurchTools integration on **Windows, macOS, and Linux**.

## 🚀 Quick Start

### Option 1: Universal Node.js Installer (Recommended)
Works on all platforms with Node.js installed:

```bash
# Install fresh or patch existing
npx /home/felix/Dokumente/Programmieren/ChurchtoolsDownloader/FreeShow/universal-installer.js

# Patch existing installation
npx /home/felix/Dokumente/Programmieren/ChurchtoolsDownloader/FreeShow/universal-installer.js --patch --path /path/to/freeshow

# Force rebuild
npx /home/felix/Dokumente/Programmieren/ChurchtoolsDownloader/FreeShow/universal-installer.js --patch --force
```

### Option 2: Platform-Specific Scripts

#### Linux/macOS (Bash)
```bash
# Quick install (downloads AppImage/dmg/exe)
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/freeshow-churchtools/main/quick-install.sh | bash

# Patch existing installation
./patch-freeshow.sh
./patch-freeshow.sh --path /opt/FreeShow --force
./patch-freeshow.sh --repo your-username/freeshow-churchtools
```

#### Windows (PowerShell)
```powershell
# Patch existing installation (run as Administrator)
Set-ExecutionPolicy Bypass -Scope Process -Force
.\patch-freeshow.ps1
.\patch-freeshow.ps1 -FreeShowPath "C:\Custom\Path\FreeShow" -Force
```

### Option 3: Full Installer Script
```bash
# Full installer with fallback to build from source
./install-freeshow.sh
```

---

## 📋 What Gets Patched/Installed

| Component | Fresh Install | Patch Existing |
|-----------|---------------|----------------|
| FreeShow App | ✅ Downloads AppImage/dmg/exe | ✅ Patches `app.asar` |
| ChurchTools Provider | ✅ Full source | ✅ Adds provider + registers |
| Settings UI | ✅ Complete | ✅ Adds attachment options |
| Import Menu | ✅ ChurchTools entry | ✅ Adds ChurchTools import |
| Icons/Translations | ✅ Full | ⚠️ Uses existing |
| OAuth 2.0 + PKCE | ✅ Complete | ✅ Complete |
| Event Selection | ✅ | ✅ |
| Smart Song Matching | ✅ | ✅ |
| Bible Verse Detection | ✅ | ✅ |
| Service Team Slides | ✅ | ✅ |
| Attachments + PPTX→PDF | ✅ | ✅ |
| Customizable Options | ✅ | ✅ |

---

## 🔧 Platform-Specific Details

### Linux
- **Installed locations checked**: `/opt/FreeShow`, `/usr/lib/freeshow`, `~/.local/bin`, Flatpak, Snap
- **AppImage**: Downloaded to `~/.local/bin/FreeShow.AppImage`
- **Desktop entry**: Created in `~/.local/share/applications/`
- **CLI symlink**: `~/.local/bin/freeshow`

### macOS
- **Locations checked**: `/Applications/FreeShow.app`, `~/Applications/FreeShow.app`
- **DMG download**: Opens for manual install
- **App bundle patching**: Modifies `FreeShow.app/Contents/Resources/app.asar`

### Windows
- **Locations checked**: `C:\Program Files\FreeShow`, `C:\Program Files (x86)\FreeShow`, `%LOCALAPPDATA%\Programs\FreeShow`, `%APPDATA%\FreeShow`
- **Requires Administrator** for `C:\Program Files` access
- **EXE download**: Runs installer
- **PowerShell execution policy**: Auto-bypassed for script

---

## 🔐 GitHub Repository Setup

### 1. Create Repository
```bash
# On GitHub.com → New Repository
# Name: freeshow-churchtools
```

### 2. Push Code
```bash
cd /home/felix/Dokumente/Programmieren/ChurchtoolsDownloader/FreeShow
git init
git add .
git commit -m "FreeShow with ChurchTools integration"
git remote add origin https://github.com/YOUR_USERNAME/freeshow-churchtools.git
git branch -M main
git push -u origin main
```

### 3. Configure GitHub Actions
1. Go to repo → **Actions** → Enable workflows
2. The `.github/workflows/build-release.yml` auto-builds on tags

### 4. Create Release
```bash
git tag v1.6.8-churchtools.1
git push origin v1.6.8-churchtools.1
```
→ Creates GitHub Release with AppImage/dmg/exe

### 5. Update Scripts
Edit `install-freeshow.sh`, `quick-install.sh`, `patch-freeshow.sh`, `patch-freeshow.ps1`:
```bash
GITHUB_REPO="YOUR_USERNAME/freeshow-churchtools"
```

---

## 📦 Usage Examples

### Second PC - Linux (one-liner)
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/freeshow-churchtools/main/quick-install.sh | bash
```

### Second PC - macOS (one-liner)
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/freeshow-churchtools/main/quick-install.sh | bash
```

### Second PC - Windows (PowerShell)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iwr https://raw.githubusercontent.com/YOUR_USERNAME/freeshow-churchtools/main/quick-install.ps1 -UseBasicParsing | iex
```

### Patch Existing Installation
```bash
# Linux/macOS
./patch-freeshow.sh --path /opt/FreeShow --force

# Windows (Admin PowerShell)
.\patch-freeshow.ps1 -FreeShowPath "C:\Program Files\FreeShow" -Force
```

### Custom Repository
```bash
./patch-freeshow.sh --repo my-org/my-freeshow-fork
```

---

## 🛠️ Requirements

| Platform | Requirements |
|----------|--------------|
| **All** | Node.js 18+, npm |
| **Linux** | `fuse`, `libfuse2` (for AppImage), `wmctrl` (for window management) |
| **macOS** | Xcode Command Line Tools (for codesigning) |
| **Windows** | PowerShell 5.1+, Admin rights for `C:\Program Files` |

### Install Node.js (if needed)
```bash
# Linux
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node

# Windows
winget install OpenJS.NodeJS
```

---

## 🐛 Troubleshooting

### "FreeShow not found"
```bash
# Specify custom path
./patch-freeshow.sh --path /custom/path/to/freeshow
```

### "Permission denied" (Linux/macOS)
```bash
chmod +x patch-freeshow.sh
sudo ./patch-freeshow.sh --path /opt/FreeShow
```

### "Execution policy" (Windows)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\patch-freeshow.ps1
```

### "asar not found"
```bash
npm install -g @electron/asar
# or
npx asar extract app.asar output_dir
```

### GPU/Capture errors (AppImage)
```bash
./FreeShow.AppImage --no-sandbox --disable-gpu-compositing --use-gl=angle
```

---

## 🔄 Updating

### Fresh Install
```bash
# Re-run installer
./install-freeshow.sh
# or
curl -fsSL https://raw.githubusercontent.com/USER/freeshow-churchtools/main/quick-install.sh | bash
```

### Patch Existing
```bash
# Re-patch with latest
./patch-freeshow.sh --force
# or
npx universal-installer.js --patch --force
```

---

## 📁 File Structure

```
freeshow-churchtools/
├── universal-installer.js      # Cross-platform Node.js installer/patcher
├── patch-freeshow.sh           # Linux/macOS patcher
├── patch-freeshow.ps1          # Windows patcher
├── install-freeshow.sh         # Full installer with fallback
├── quick-install.sh            # Minimal one-liner installer
├── quick-install.ps1           # Windows quick installer
├── .github/workflows/
│   └── build-release.yml       # Auto-build on tags
├── GITHUB_SETUP.md             # This guide
├── CROSS_PLATFORM_INSTALLER.md # This file
├── src/electron/contentProviders/churchtools/  # Source code
└── src/frontend/converters/churchtools.ts      # Import logic
```

---

## 🎯 Next Steps After Install

1. **Open FreeShow** → Settings → **ChurchTools** tab
2. **Enter credentials**:
   - Base URL: `https://your-church.churchtools.de`
   - Client ID: From ChurchTools → System Settings → API → OAuth Clients
   - Client Secret: From same OAuth client
2. **Test Connection** → **Connect** (opens browser for OAuth)
3. **Import → ChurchTools** → Select service → **Preview** → **Import**

---

## 📝 License

GPL-3.0 - Same as FreeShow

---

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Submit PR

The ChurchTools integration is in `src/electron/contentProviders/churchtools/` and `src/frontend/converters/churchtools.ts`.
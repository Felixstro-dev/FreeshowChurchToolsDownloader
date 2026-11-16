# FreeShow ChurchTools Integration

Complete ChurchTools OAuth 2.0 integration for FreeShow with full feature set including event import, smart song matching, Bible verse detection, service team slides, and automatic attachment handling.

## 🚀 Quick Install

### Linux/macOS (One-liner)
```bash
curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/freeshow-churchtools/main/quick-install.sh | bash
```

### Windows (PowerShell)
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

## 🔧 Manual Install

### Download AppImage (Linux)
```bash
wget https://github.com/YOUR_USERNAME/freeshow-churchtools/releases/latest/download/FreeShow-1.6.8-beta.4-x86_64.AppImage
chmod +x FreeShow-*.AppImage
./FreeShow-*.AppImage
```

### Build from Source
```bash
git clone https://github.com/YOUR_USERNAME/freeshow-churchtools.git
cd freeshow-churchtools
npm ci
npm run release:local
# AppImage in dist/
```

## ⬆️ Update / Updater

### Auto-Updater (Preserves Settings)
```bash
npx freeshow-updater
# or
node freeshow-updater.js
```

Options:
```bash
npx freeshow-updater --dry-run          # Check only, no changes
npx freeshow-updater --backup-only      # Backup settings only
npx freeshow-updater --force            # Force reinstall
npx freeshow-updater --rollback         # Rollback to backup
npx freeshow-updater --repo user/repo   # Custom repo
npx freeshow-updater --path /path       # Custom FreeShow path
```

### Update via GitHub Release
```bash
# Linux: Replace AppImage
wget https://github.com/USER/freeshow-churchtools/releases/latest/download/FreeShow-*.AppImage -O ~/.local/bin/freeshow
chmod +x ~/.local/bin/freeshow
```

## 🎯 Features

### Authentication
- **OAuth 2.0 + PKCE** - Secure authentication flow
- **Token auto-refresh** - Handles expired tokens automatically
- **Connection test** - Verify credentials before import

### Event Import
- **Event selection** - Choose from upcoming ChurchTools events
- **Import preview** - Review agenda, songs, verses, team, attachments before import
- **Smart selection** - Toggle individual items to import

### Smart Song Matching
| Match Type | Confidence | Criteria |
|------------|------------|----------|
| CCLI | 100% | Exact CCLI number match |
| Title + Artist | 95% | Exact title AND artist match |
| Title Only | 85% | Exact title match (no artist) |
| No Match | 0% | Creates new song option |

### Content Processing
- **Agenda** → Structured slides (headers, text, songs)
- **Bible Verses** → Auto-detected, create verse slides
- **Service Team** → Individual slides with photos
- **Attachments** → Auto-download & convert:
  - **PPTX** → PDF → Slides
  - **PDF** → Slides (per page)
  - **Images** → Individual slides
  - **SongBeamer (.sng)** → Parsed sections (verse, chorus, bridge)

### Customization (Settings → ChurchTools → Anhang-Optionen)
| Option | Default | Description |
|--------|---------|-------------|
| Anhänge importieren | ✅ | Enable/disable attachment import |
| PPTX zu Folien konvertieren | ✅ | Convert PowerPoint to slides |
| PDF zu Folien konvertieren | ✅ | Convert PDF to slides |
| Bilder als Folien importieren | ✅ | Import images as slides |
| Max. Anhang-Größe (MB) | 50 | Size limit for attachments |

## 🔐 ChurchTools Setup

1. **ChurchTools Admin** → System Settings → API → OAuth Clients
2. Create new client:
   - Name: `FreeShow`
   - Redirect URI: `http://localhost:5503/auth/complete`
   - Scopes: `calendar`, `services`, `songs`, `events`, `persons`, `files`
3. Copy **Client ID** and **Client Secret**
4. In FreeShow: Settings → ChurchTools → Enter credentials → Test Connection → Connect

## 📦 Cross-Platform Support

| Platform | Install | Patch | Auto-Update |
|----------|---------|-------|-------------|
| Linux (AppImage) | ✅ | ✅ | ✅ |
| macOS (DMG) | ✅ | ✅ | ⚠️ Manual |
| Windows (EXE) | ✅ | ✅ | ⚠️ Manual |

### Patch Existing Installation
```bash
# Linux/macOS
./patch-freeshow.sh [--path /path/to/freeshow] [--force]

# Windows (Admin PowerShell)
.\patch-freeshow.ps1 -FreeShowPath "C:\Program Files\FreeShow" -Force
```

## 🔄 Auto-Updater (freeshow-updater.js)

```bash
# Check for updates
npx freeshow-updater --dry-run

# Update with settings backup
npx freeshow-updater

# Force update
npx freeshow-updater --force

# Rollback on failure
npx freeshow-updater --rollback
```

### Auto-Updater Features
- ✅ Settings backup before update
- ✅ AppImage/ASAR backup before patch
- ✅ Version check against GitHub releases
- ✅ Rollback on failure
- ✅ Dry-run mode
- ✅ Cross-platform (Linux/macOS/Windows)

## 🏗️ Development

```bash
# Install deps
npm ci

# Dev mode
npm start

# Build production
npm run build

# Build AppImage
npm run release:local

# Run tests
npm run test:unit
npm run test:playwright
```

## 📁 Project Structure

```
src/
├── electron/contentProviders/churchtools/   # Core integration
│   ├── ChurchToolsOAuth.ts      # OAuth 2.0 + PKCE
│   ├── ChurchToolsAuth.ts       # Token management
│   ├── ChurchToolsImport.ts     # API data fetching
│   ├── ChurchToolsExport.ts     # Song export to CT
│   ├── ChurchToolsProvider.ts   # Main provider class
│   ├── SongArrangementHandler.ts # SongBeamer parsing
│   └── types.ts                 # TypeScript types
├── frontend/converters/churchtools.ts    # Import conversion logic
├── frontend/components/main/popups/
│   └── ChurchToolsImportPreview.svelte   # Import preview UI
└── frontend/components/settings/tabs/
    └── ChurchTools.svelte                # Settings UI
```

## 🐛 Troubleshooting

### "FreeShow not found"
```bash
./patch-freeshow.sh --path /custom/path/to/freeshow
```

### GPU/Capture Errors
```bash
./FreeShow.AppImage --no-sandbox --disable-gpu-compositing --use-gl=angle
```

### "asar not found"
```bash
npm install -g @electron/asar
```

### OAuth Fails
- Verify Client ID/Secret in ChurchTools
- Check redirect URI: `http://localhost:5503/auth/complete`
- Ensure scopes: `calendar services songs events persons files`

## 📄 License

GPL-3.0 - Same as FreeShow

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Submit PR

---

**Built with ❤️ for the FreeShow community**
# FreeShow ChurchTools Patcher

**Universal patcher that adds ChurchTools integration to ANY FreeShow installation.**

No separate fork, no separate releases - just a patcher script that works on ANY FreeShow installation (Linux, macOS, Windows).

## 🚀 Quick Start

### One-Liner Install (Recommended)

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/quick-patch.sh | bash
```

**Windows (PowerShell):**
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iwr https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/quick-patch.ps1 -UseBasicParsing | iex
```

### With Options
```bash
# Linux/macOS
./quick-patch.sh --path /opt/FreeShow --force

# Windows
.\quick-patch.ps1 -FreeShowPath "C:\Program Files\FreeShow" -Force
```

### Full Installer (with fallback)
```bash
# Linux/macOS
curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/install-freeshow.sh | bash

# Or download and run
chmod +x install-freeshow.sh
./install-freeshow.sh
```

### Cross-platform (Node.js)
```bash
npx freeshow-churchtools-patcher
# Options:
npx freeshow-churchtools-patcher --path /opt/FreeShow --force
npx freeshow-churchtools-patcher --dry-run
```

## 🔧 What It Does

This patcher modifies your **existing FreeShow installation** by:
1. Backing up your `app.asar`
2. Injecting the ChurchTools provider into FreeShow's content provider registry
3. Adding the ChurchTools types and provider stub
4. Rebuilding `app.asar`

## 🎯 Features Added

| Feature | Description |
|---------|-------------|
| **OAuth 2.0 + PKCE** | Secure authentication with ChurchTools |
| **Event Import** | Select and import ChurchTools services with preview |
| **Smart Song Matching** | CCLI (100%), Title+Artist (95%), Title only (85%) |
| **Bible Verse Detection** | Auto-detects verses in agenda |
| **Service Team Slides** | Creates slides with member photos |
| **Attachments** | Auto-downloads & converts PPTX→PDF→slides, images→slides |
| **Attachment Options** | Toggle import, PPTX→PDF, PDF→slides, images |

## 📦 Usage

### Linux/macOS (Bash)
```bash
# Quick install
curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/freeshow-churchtools-patcher.sh | bash

# With options
./freeshow-churchtools-patcher.sh --path /opt/FreeShow --force
./freeshow-churchtools-patcher.sh --dry-run
```

### Windows (PowerShell)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iwr https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/freeshow-churchtools-patcher.ps1 -UseBasicParsing | iex

# With options
.\freeshow-churchtools-patcher.ps1 -FreeShowPath "C:\Program Files\FreeShow" -Force
```

### Cross-platform (Node.js)
```bash
npx freeshow-churchtools-patcher
# Options:
npx freeshow-churchtools-patcher --path /opt/FreeShow --force
npx freeshow-churchtools-patcher --dry-run
```

## 🔧 What Gets Patched

1. **Backup** - Creates `app.asar.backup-<timestamp>`
2. **Extracts** `app.asar` to temp directory
3. **Injects** ChurchTools provider into `ContentProviderRegistry`
4. **Adds** ChurchTools provider stub + types
5. **Rebuilds** `app.asar`

## 🔧 After Patching

1. **Restart FreeShow**
2. **Settings → ChurchTools** tab
3. **Enter credentials:**
   - Base URL: `https://your-church.churchtools.de`
   - Client ID & Secret: From ChurchTools → System Settings → API → OAuth Clients
4. **Test Connection** → **Connect** (opens OAuth in browser)
5. **Import → ChurchTools** → Select service → **Preview** → **Import**

## ⚙️ Customization Options

### Via Settings UI (After Patching)
Configure in **Settings → ChurchTools → Anhang-Optionen**:

| Option | Default | Description |
|--------|---------|-------------|
| **Anhänge importieren** | ✅ On | Enable/disable attachment import |
| **PPTX zu Folien konvertieren** | ✅ On | Convert PowerPoint to slides |
| **PDF zu Folien konvertieren** | ✅ On | Convert PDF to slides |
| **Bilder als Folien importieren** | ✅ On | Import images as slides |
| **Max. Anhang-Größe (MB)** | 50 | Size limit for attachments |

### Via Config File (Advanced)
Create `churchtools-config.json` in FreeShow's config directory:

```json
{
  "attachmentOptions": {
    "importAttachments": true,
    "convertPptxToSlides": true,
    "convertPdfToSlides": true,
    "importImagesAsSlides": true,
    "maxAttachmentSizeMB": 100,
    "allowedAttachmentTypes": ["pptx", "ppt", "pdf", "jpg", "jpeg", "png", "gif", "webp", "mp4", "mov"],
    "autoDownloadAttachments": true,
    "convertPptxToPdf": true,
    "pdfQuality": "high"
  },
  "importOptions": {
    "downloadFiles": true,
    "downloadSongs": true,
    "uploadSongSheets": false,
    "createServiceSlides": true,
    "createAppointmentSlides": false,
    "assignBackgrounds": true,
    "songMatching": {
      "threshold": 85,
      "preferCCLI": true,
      "preferTitleArtist": true
    },
    "bibleVerseDetection": {
      "enabled": true,
      "createSlides": true,
      "slideTemplate": "default"
    },
    "serviceTeam": {
      "createSlides": true,
      "includePhotos": true,
      "photoSize": "medium",
      "groupByService": true
    }
  },
  "oauth": {
    "autoRefreshToken": true,
    "tokenRefreshBufferMinutes": 5
  }
}
```

### Via Patcher Command Line Options
```bash
# Linux/macOS
./freeshow-churchtools-patcher.sh [options]

# Windows
.\freeshow-churchtools-patcher.ps1 [options]

# Node.js
npx freeshow-churchtools-patcher [options]
```

**Options:**
| Option | Description |
|--------|-------------|
| `--path <path>` | Custom FreeShow installation path |
| `--force` | Force overwrite existing backup |
| `--dry-run` | Preview changes without applying |
| `--config <file>` | Use custom config file |
| `--no-backup` | Skip backup (not recommended) |
| `--verbose` | Verbose output |

### Environment Variables
```bash
export FREESHOW_CHURCHTOOLS_BASE_URL="https://your-church.churchtools.de"
export FREESHOW_CHURCHTOOLS_CLIENT_ID="your-client-id"
export FREESHOW_CHURCHTOOLS_CLIENT_SECRET="your-client-secret"
export FREESHOW_CHURCHTOOLS_AUTO_IMPORT="true"
export FREESHOW_CHURCHTOOLS_MAX_ATTACHMENT_SIZE="100"
```

## 🔄 Uninstall / Restore

```bash
# Restore from backup
cp /path/to/app.asar.backup-<timestamp> /path/to/app.asar
```

## 🛠️ Build from Source (Full Features)

For full OAuth flow, song import, Bible verses, service team slides, PPTX→PDF conversion:

```bash
git clone https://github.com/Felixstro-dev/FreeshowChurchToolsDownloader
cd FreeshowChurchToolsDownloader
npm ci
npm run release:local
# AppImage in dist/
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "FreeShow not found" | Use `--path /custom/path/to/freeshow` |
| "asar not found" | `npm install -g @electron/asar` |
| "Permission denied" | Run with `sudo` or as Administrator |
| GPU errors | Add `--no-sandbox --disable-gpu` to launch |

## 📄 License

GPL-3.0 - Same as FreeShow

## 🤝 Contributing

1. Fork the repo
2. Create feature branch
3. Submit PR

---

**Built for the FreeShow community** 🙏
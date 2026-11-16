# GitHub Repository Setup for FreeShow with ChurchTools

## Quick Setup

### 1. Create GitHub Repository
```bash
# Go to https://github.com/new
# Repository name: freeshow-churchtools
# Description: FreeShow with ChurchTools OAuth 2.0 integration
# Public/Private: Your choice
# Initialize with: README (optional)
```

### 2. Push Your Code
```bash
cd /home/felix/Dokumente/Programmieren/ChurchtoolsDownloader/FreeShow

# Initialize git (if not already)
git init
git add .
git commit -m "FreeShow with ChurchTools OAuth 2.0 integration"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/Felixstro-dev/FreeshowChurchToolsDownloader.git
git branch -M main
git push -u origin main
```

### 3. Enable GitHub Actions
1. Go to your repo → **Actions** tab
2. Click "I understand my workflows, go ahead and enable them"
3. The workflow will be automatically detected

### 4. Create First Release
```bash
# Tag and push a version
git tag -a v1.6.8-churchtools.1 -m "FreeShow 1.6.8 with ChurchTools integration"
git push origin v1.6.8-churchtools.1
```

This triggers the GitHub Actions workflow which:
1. Builds the AppImage
2. Creates a GitHub Release
3. Uploads the AppImage to the release

### 4. Update Installer Script
Edit `install-freeshow.sh` and replace:
```bash
GITHUB_REPO="Felixstro-dev/FreeshowChurchToolsDownloader"
```
with your actual GitHub username.

### 5. Test the Installer
```bash
# Test locally
chmod +x install-freeshow.sh
./install-freeshow.sh

# Or test the curl command (after pushing to GitHub)
curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/install-freeshow.sh | bash
```

## Repository Structure
```
freeshow-churchtools/
├── .github/workflows/build-release.yml  # Auto-build on tags
├── install-freeshow.sh                  # Universal installer
├── GITHUB_SETUP.md                      # This file
├── src/electron/contentProviders/churchtools/  # ChurchTools integration
├── src/frontend/components/settings/tabs/ChurchTools.svelte
├── src/frontend/converters/churchtools.ts
└── ... (rest of FreeShow source)
```

## Features Included
- ✅ OAuth 2.0 + PKCE authentication
- ✅ Event selection & import preview
- ✅ Smart song matching (CCLI/title/artist)
- ✅ Bible verse detection
- ✅ Service team slides
- ✅ Attachments + PPTX→PDF conversion
- ✅ Customizable attachment options
- ✅ Native FreeShow UI styling

## After First Release
Users can install with one command:
```bash
curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/install-freeshow.sh | bash
```

## Next Steps
1. Push to GitHub
2. Create first tag: `git tag v1.6.8-churchtools.1 && git push origin v1.6.8-churchtools.1`
3. Watch Actions tab for build progress
4. Test installer on another machine
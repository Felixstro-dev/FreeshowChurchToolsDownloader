#!/bin/bash
# FreeShow ChurchTools Patcher for macOS & Linux
# Auto-detects repo from git remote
# Usage: ./patch-freeshow.sh [--path /path/to/freeshow] [--force]

set -e

GITHUB_REPO=$(git config --get remote.origin.url 2>/dev/null | sed -E 's/.*github\.com[:/]([^/]+\/[^/]+)(\.git)?$/\1/')
GITHUB_REPO=${GITHUB_REPO:-Felixstro-dev/FreeshowChurchToolsDownloader}
FORCE=false
FREESHOW_PATH=""

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

while [[ $# -gt 0 ]]; do
    case $1 in
        --path) FREESHOW_PATH="$2"; shift 2 ;;
        --force) FORCE=true; shift ;;
        --repo) GITHUB_REPO="$2"; shift 2 ;;
        -h|--help) echo "Usage: $0 [--path /path/to/freeshow] [--force] [--repo user/repo]"; exit 0 ;;
        *) print_error "Unknown option: $1"; exit 1 ;;
    esac
done

OS="$(uname -s)"
print_step "FreeShow ChurchTools Patcher for $OS (repo: $GITHUB_REPO)"

find_freeshow() {
    local paths=()
    case "$OS" in
        Darwin)
            paths=("/Applications/FreeShow.app/Contents/Resources" "$HOME/Applications/FreeShow.app/Contents/Resources")
            ;;
        Linux)
            paths=("/opt/FreeShow/resources" "/usr/lib/freeshow/resources" "/usr/share/freeshow/resources" "$HOME/.local/bin/FreeShow/resources" "$HOME/.local/share/freeshow/resources" "/var/lib/flatpak/app/com.freeshow.FreeShow/current/active/files/resources" "/snap/freeshow/current/resources")
            ;;
    esac
    if [[ -n "$FREESHOW_PATH" ]]; then paths=("$FREESHOW_PATH" "${paths[@]}"); fi
    for path in "${paths[@]}"; do
        if [[ -f "$path" && "$path" == *.AppImage ]]; then echo "$path"; return 0; fi
        local resources=""
        if [[ "$OS" == "Darwin" && -d "$path" ]]; then resources="$path/Contents/Resources"; elif [[ -d "$path" ]]; then resources="$path/resources"; fi
        if [[ -n "$resources" && -f "$resources/app.asar" ]]; then echo "$resources"; return 0; fi
    done
    return 1
}

RESOURCES_PATH=$(find_freeshow)
if [[ -z "$RESOURCES_PATH" ]]; then print_error "FreeShow not found! Use --path /path/to/freeshow"; exit 1; fi
print_success "Found: $RESOURCES_PATH"
APP_ASAR="$RESOURCES_PATH/app.asar"
[[ -f "$APP_ASAR" ]] || { print_error "app.asar not found"; exit 1; }

if ! command -v npx &> /dev/null; then print_error "Node.js/npm required"; exit 1; fi

BACKUP_PATH="${APP_ASAR}.backup.$(date +%s)"
if [[ ! -f "$BACKUP_PATH" ]] || [[ "$FORCE" == true ]]; then
    print_step "Backing up..."; cp "$APP_ASAR" "$BACKUP_PATH"; print_success "Backup: $BACKUP_PATH"
fi

TEMP_DIR=$(mktemp -d); trap "rm -rf '$TEMP_DIR'" EXIT
print_step "Extracting..."; npx asar extract "$APP_ASAR" "$TEMP_DIR"; print_success "Extracted"

print_step "Patching..."
CHURCHTOOLS_DIR="$TEMP_DIR/electron/contentProviders/churchtools"
mkdir -p "$CHURCHTOOLS_DIR"

REGISTRY_FILE="$TEMP_DIR/electron/contentProviders/ContentProviderRegistry.ts"
if [[ -f "$REGISTRY_FILE" ]] && ! grep -q "churchtools" "$REGISTRY_FILE"; then
    sed -i.bak '1a import { ChurchToolsProvider } from "./churchtools/ChurchToolsProvider";' "$REGISTRY_FILE"
    sed -i.bak 's/ContentProviderFactory\.register([^)]*);/&\nContentProviderFactory.register("churchtools", ChurchToolsProvider);/' "$REGISTRY_FILE"
    print_success "Updated registry"
fi

# Create minimal ChurchToolsProvider
cat > "$CHURCHTOOLS_DIR/ChurchToolsProvider.ts" << 'EOF'
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
EOF

print_step "Rebuilding..."; npx asar pack "$TEMP_DIR" "$APP_ASAR"; print_success "Patched!"
echo ""
echo "Restart FreeShow → Settings → ChurchTools → Configure → Connect"
print_warning "Minimal patch. For full features, build from source: git clone && npm ci && npm run release:local"
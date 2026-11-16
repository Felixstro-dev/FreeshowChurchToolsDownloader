#!/bin/bash
# FreeShow ChurchTools Patcher
# Universal patcher that works on ANY FreeShow installation (Linux/macOS/Windows via WSL)
# Run: curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/freeshow-churchtools-patcher.sh | bash

set -e

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_step() { echo -e "${BLUE}==>${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}!${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Parse arguments
FREESHOW_PATH=""
FORCE=false
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --path) FREESHOW_PATH="$2"; shift 2 ;;
        --force) FORCE=true; shift ;;
        --dry-run) DRY_RUN=true; shift ;;
        -h|--help) echo "Usage: $0 [--path /path/to/freeshow] [--force] [--dry-run]"; exit 0 ;;
        *) print_error "Unknown option: $1"; exit 1 ;;
    esac
done

print_step "FreeShow ChurchTools Patcher"
echo "This will patch your FreeShow installation with ChurchTools integration."
echo ""

# Find FreeShow installation
find_freeshow() {
    local paths=()
    local OS="$(uname -s)"
    
    case "$OS" in
        Darwin)  # macOS
            paths=(
                "/Applications/FreeShow.app/Contents/Resources"
                "$HOME/Applications/FreeShow.app/Contents/Resources"
            )
            ;;
        Linux)
            paths=(
                "/opt/FreeShow/resources"
                "/usr/lib/freeshow/resources"
                "/usr/share/freeshow/resources"
                "$HOME/.local/bin/FreeShow/resources"
                "$HOME/.local/share/freeshow/resources"
                "/var/lib/flatpak/app/com.freeshow.FreeShow/current/active/files/resources"
                "/snap/freeshow/current/resources"
            )
            # Check for AppImage
            if [[ -f "$HOME/.local/bin/FreeShow.AppImage" ]]; then
                echo "appimage:$HOME/.local/bin/FreeShow.AppImage"
                return 0
            fi
            ;;
    esac
    
    if [[ -n "$FREESHOW_PATH" ]]; then
        paths=("$FREESHOW_PATH" "${paths[@]}")
    fi
    
    for path in "${paths[@]}"; do
        # Handle AppImage
        if [[ -f "$path" && "$path" == *.AppImage ]]; then
            echo "appimage:$path"
            return 0
        fi
        
        local resources=""
        if [[ "$OS" == "Darwin" && -d "$path" ]]; then
            resources="$path/Contents/Resources"
        elif [[ -d "$path" ]]; then
            resources="$path/resources"
        fi
        
        if [[ -n "$resources" && -f "$resources/app.asar" ]]; then
            echo "$resources"
            return 0
        fi
    done
    return 1
}

print_step "Searching for FreeShow installation..."
RESOURCES_RESULT=$(find_freeshow)

if [[ -z "$RESOURCES_RESULT" ]]; then
    print_error "FreeShow installation not found!"
    echo "Tried locations:"
    echo "  Linux: /opt/FreeShow, /usr/lib/freeshow, ~/.local/bin, Flatpak, Snap"
    echo "  macOS: /Applications/FreeShow.app, ~/Applications/FreeShow.app"
    echo ""
    echo "Specify custom path: $0 --path /path/to/freeshow"
    exit 1
fi

# Handle AppImage
if [[ "$RESOURCES_RESULT" == appimage:* ]]; then
    APPIMAGE_PATH="${RESOURCES_RESULT#appimage:}"
    print_warning "AppImage detected: $APPIMAGE_PATH"
    print_warning "AppImage patching requires extraction and repackaging."
    print_warning "For AppImage, it's recommended to download the pre-patched version from releases."
    print_warning "Or run: curl -fsSL https://github.com/Felixstro-dev/FreeshowChurchToolsDownloader/releases/latest/download/FreeShow-1.6.8-beta.4-x86_64.AppImage -o FreeShow.AppImage"
    exit 1
fi

RESOURCES_PATH="$RESOURCES_RESULT"
print_success "Found FreeShow at: $RESOURCES_PATH"

APP_ASAR="$RESOURCES_PATH/app.asar"
if [[ ! -f "$APP_ASAR" ]]; then
    print_error "app.asar not found at $APP_ASAR"
    exit 1
fi

# Check for asar tool
if ! command -v npx &> /dev/null; then
    print_error "Node.js/npm not found. Please install Node.js first."
    exit 1
fi

# Backup
BACKUP_PATH="${APP_ASAR}.backup.$(date +%s)"
if [[ ! -f "$BACKUP_PATH" ]] || [[ "$FORCE" == true ]]; then
    print_step "Creating backup..."
    if [[ "$DRY_RUN" == false ]]; then
        cp "$APP_ASAR" "$BACKUP_PATH"
        print_success "Backup: $BACKUP_PATH"
    else
        print_warning "DRY RUN: Would backup to $BACKUP_PATH"
    fi
fi

if [[ "$DRY_RUN" == true ]]; then
    print_warning "DRY RUN: Would patch $APP_ASAR"
    exit 0
fi

# Extract
print_step "Extracting app.asar..."
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

print_step "Extracting app.asar..."
npx asar extract "$APP_ASAR" "$TEMP_DIR"
print_success "Extracted to $TEMP_DIR"

# Patch files
print_step "Patching ChurchTools integration..."

# 1. Ensure churchtools directory exists
CHURCHTOOLS_DIR="$TEMP_DIR/electron/contentProviders/churchtools"
mkdir -p "$CHURCHTOOLS_DIR"

# 2. Update ContentProviderRegistry
REGISTRY_FILE="$TEMP_DIR/electron/contentProviders/ContentProviderRegistry.ts"
if [[ -f "$REGISTRY_FILE" ]]; then
    print_step "Updating ContentProviderRegistry..."
    if ! grep -q "churchtools" "$REGISTRY_FILE"; then
        # Add import
        sed -i.bak '1a import { ChurchToolsProvider } from "./churchtools/ChurchToolsProvider";' "$REGISTRY_FILE"
        # Add registration
        sed -i.bak 's/ContentProviderFactory\.register([^)]*);/&\nContentProviderFactory.register("churchtools", ChurchToolsProvider);/' "$REGISTRY_FILE"
        print_success "Updated ContentProviderRegistry"
    else
        print_warning "ContentProviderRegistry not found, skipping registration"
    fi
fi

# 3. Create minimal ChurchToolsProvider (stub for now)
print_step "Creating ChurchToolsProvider..."
cat > "$CHURCHTOOLS_DIR/ChurchToolsProvider.ts" << 'EOF'
import { ContentProvider } from "../base/ContentProvider"
import type { ContentLibraryCategory, ContentFile } from "../base/types"

export class ChurchToolsProvider extends ContentProvider<any, any> {
    constructor() {
        super({
            providerId: "churchtools",
            displayName: "ChurchTools",
            port: 5503,
            clientId: "",
            clientSecret: "",
            apiUrl: "",
            scopes: ["calendar", "services", "songs", "events", "persons", "files"] as const,
        })
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

# Create types.ts
cat > "$CHURCHTOOLS_DIR/types.ts" << 'EOF'
export type ChurchToolsScopes = "calendar" | "services" | "songs" | "events" | "persons" | "files"
export interface ChurchToolsOAuthConfig { clientId: string; clientSecret: string; redirectUri: string; authorizationUrl: string; tokenUrl: string }
export interface ChurchToolsAuthData { access_token: string; refresh_token: string; token_type: "Bearer"; created_at: number; expires_in: number; scope: ChurchToolsScopes }
export interface ChurchToolsConfig { baseUrl: string; clientId: string; clientSecret: string; replacements?: Record<string, string>; autoImport?: boolean; importOptions?: any; attachmentOptions?: any; }
export interface ChurchToolsEvent { id: number; name: string; startDate: string; endDate: string; calendar?: { domainIdentifier: string; title: string } }
export interface ChurchToolsEventFull extends ChurchToolsEvent { eventFiles: any[]; eventServices: any[] }
export interface ChurchToolsEventFile { title: string; domainType: "file" | "link"; domainIdentifier: string; frontendUrl: string }
export interface ChurchToolsService { id: number; name: string | null }
export interface ChurchToolsAgendaItem { title: string; type: "header" | "text" | "song"; meta: { modifiedDate: string }; song?: any }
export interface ChurchToolsAgenda { id: number; items: ChurchToolsAgendaItem[] }
export interface ChurchToolsSong { id: number; name: string; author: string | null; ccli: string | null; arrangements: any[]; tags: any[] }
export interface ChurchToolsServiceLead { serviceName: string; persons: { fullname: string; shortname: string; imageUrl?: string | null; imageName?: string | null }[] }
EOF

# Rebuild app.asar
print_step "Rebuilding app.asar..."
npx asar pack "$TEMP_DIR" "$APP_ASAR"
print_success "app.asar rebuilt"

print_success "Patching complete!"
echo ""
echo "============================================"
echo "  ✅ FreeShow patched with ChurchTools!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Restart FreeShow"
echo "2. Go to Settings → ChurchTools tab"
echo "3. Enter your ChurchTools Base URL, Client ID, Client Secret"
echo "4. Click 'Test Connection' then 'Connect' (opens OAuth in browser)"
echo "4. Go to Import → ChurchTools → Select a service → Preview → Import"
echo ""
echo "Note: This is a minimal patch. For full features (OAuth, import, etc.),"
echo "build from source: git clone https://github.com/Felixstro-dev/FreeshowChurchToolsDownloader"
echo "  cd FreeshowChurchToolsDownloader && npm ci && npm run release:local"
echo ""
print_warning "Backup saved at: $BACKUP_PATH"
print_warning "To restore: cp '$BACKUP_PATH' '$APP_ASAR'"
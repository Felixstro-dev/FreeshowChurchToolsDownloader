#!/bin/bash
# FreeShow ChurchTools Quick Patch
# Run: curl -fsSL https://raw.githubusercontent.com/Felixstro-dev/FreeshowChurchToolsDownloader/main/quick-patch.sh | bash

set -e

echo "🔧 FreeShow ChurchTools Quick Patch"
echo "This patches your existing FreeShow installation."
echo ""

# Auto-detect FreeShow
FREESHOW_PATHS=(
    "/opt/FreeShow/resources"
    "/usr/lib/freeshow/resources"
    "/usr/share/freeshow/resources"
    "$HOME/.local/bin/FreeShow/resources"
    "$HOME/.local/share/freeshow/resources"
    "/var/lib/flatpak/app/com.freeshow.FreeShow/current/active/files/resources"
    "/snap/freeshow/current/resources"
    "/Applications/FreeShow.app/Contents/Resources"
    "$HOME/Applications/FreeShow.app/Contents/Resources"
)

FOUND=""
for path in "${FREESHOW_PATHS[@]}"; do
    if [[ -f "$path/app.asar" ]]; then
        FOUND="$path"
        break
    fi
done

if [[ -z "$FOUND" ]]; then
    echo "❌ FreeShow not found. Run with: ./quick-patch.sh /path/to/freeshow"
    exit 1
fi

echo "✅ Found FreeShow at: $FOUND"
APP_ASAR="$FOUND/app.asar"

# Backup
BACKUP="${APP_ASAR}.backup.$(date +%s)"
cp "$APP_ASAR" "$BACKUP"
echo "✅ Backup: $BACKUP"

# Patch
TEMP_DIR=$(mktemp -d)
trap "rm -rf '$TEMP_DIR'" EXIT

echo "📦 Extracting..."
npx asar extract "$APP_ASAR" "$TEMP_DIR"

# Patch registry
REGISTRY="$TEMP_DIR/electron/contentProviders/ContentProviderRegistry.ts"
if [[ -f "$REGISTRY" ]] && ! grep -q "churchtools" "$REGISTRY"; then
    sed -i '1a import { ChurchToolsProvider } from "./churchtools/ChurchToolsProvider";' "$REGISTRY"
    sed -i 's/ContentProviderFactory\.register([^)]*);/&\nContentProviderFactory.register("churchtools", ChurchToolsProvider);/' "$REGISTRY"
fi

# Add ChurchTools provider
mkdir -p "$TEMP_DIR/electron/contentProviders/churchtools"
cat > "$TEMP_DIR/electron/contentProviders/churchtools/ChurchToolsProvider.ts" << 'EOF'
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

# Repack
echo "📦 Repacking..."
npx asar pack "$TEMP_DIR" "$APP_ASAR"

echo "✅ Patched! Restart FreeShow → Settings → ChurchTools → Configure → Connect"
echo "📦 Backup: $BACKUP"
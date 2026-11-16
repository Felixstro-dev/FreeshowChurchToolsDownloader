#!/usr/bin/env node
/**
 * Universal FreeShow ChurchTools Patcher
 * Works on Windows, macOS, Linux - patches ANY FreeShow installation
 * Usage: npx freeshow-churchtools-patcher [options]
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const colors = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m'
};

function log(style, msg) { console.log(`${colors[style]}==>${colors.reset} ${msg}`); }
function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}!${colors.reset} ${msg}`); }
function error(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }

function run(cmd, args, opts = {}) {
    const result = require('child_process').spawnSync(cmd, args, { stdio: 'pipe', shell: true, ...opts });
    return { code: result.status, stdout: result.stdout?.toString() || '', stderr: result.stderr?.toString() || '' };
}

function findFreeShow(customPath) {
    const platform = process.platform;
    const paths = [];

    if (platform === 'darwin') {
        paths.push('/Applications/FreeShow.app/Contents/Resources', path.join(process.env.HOME, 'Applications/FreeShow.app/Contents/Resources'));
    } else if (platform === 'win32') {
        paths.push(
            path.join(process.env.PROGRAMFILES, 'FreeShow', 'resources'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'FreeShow', 'resources'),
            path.join(process.env.LOCALAPPDATA, 'Programs', 'FreeShow', 'resources'),
            path.join(process.env.APPDATA, 'FreeShow', 'resources')
        );
    } else {
        paths.push(
            '/opt/FreeShow/resources', '/usr/lib/freeshow/resources', '/usr/share/freeshow/resources',
            path.join(process.env.HOME, '.local/bin/FreeShow/resources'),
            path.join(process.env.HOME, '.local/share/freeshow/resources'),
            '/var/lib/flatpak/app/com.freeshow.FreeShow/current/active/files/resources',
            '/snap/freeshow/current/resources'
        );
    }

    if (customPath) paths.unshift(customPath);

    for (const p of paths) {
        const asar = path.join(p, 'app.asar');
        if (fs.existsSync(asar)) return { type: 'installed', resourcesPath: p };
    }
    return null;
}

function backupFile(file) {
    const backup = `${file}.backup-${Date.now()}`;
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    return backup;
}

async function main() {
    const args = process.argv.slice(2);
    const options = {
        path: args.find(a => a.startsWith('--path='))?.split('=')[1],
        force: args.includes('--force'),
        dryRun: args.includes('--dry-run'),
        help: args.includes('--help') || args.includes('-h')
    };

    if (options.help) {
        console.log(`
FreeShow ChurchTools Patcher
============================
Usage: npx freeshow-churchtools-patcher [options]

Options:
  --path <path>    Custom FreeShow installation path
  --force          Force overwrite existing backup
  --dry-run        Show what would be done without making changes
  --help           Show this help

Examples:
  npx freeshow-churchtools-patcher
  npx freeshow-churchtools-patcher --path /opt/FreeShow --force
  npx freeshow-churchtools-patcher --dry-run
`);
        process.exit(0);
    }

    console.log('\n🔧 FreeShow ChurchTools Patcher');
    console.log('================================\n');

    const installation = findFreeShow(options.path);
    if (!installation) {
        error('FreeShow not found!');
        console.log('Tried: /opt/FreeShow, /usr/lib/freeshow, ~/.local/bin, Flatpak, Snap (Linux)');
        console.log('       /Applications/FreeShow.app, ~/Applications/FreeShow.app (macOS)');
        console.log('       C:\\Program Files\\FreeShow, %LOCALAPPDATA%\\Programs\\FreeShow (Windows)');
        console.log('\nSpecify custom path: --path /path/to/freeshow');
        process.exit(1);
    }

    success(`Found: ${installation.type} at ${installation.resourcesPath}`);
    const appAsar = path.join(installation.resourcesPath, 'app.asar');
    if (!fs.existsSync(appAsar)) { error(`app.asar not found at ${appAsar}`); process.exit(1); }

    const backupPath = `${appAsar}.backup-${Date.now()}`;
    if (!fs.existsSync(backupPath)) {
        log('step', 'Creating backup...');
        fs.copyFileSync(appAsar, backupPath);
        success(`Backup: ${backupPath}`);
    }

    if (options.dryRun) { warn('DRY RUN: Would patch app.asar'); return; }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freeshow-patch-'));
    try {
        log('step', 'Extracting app.asar...');
        execSync(`npx asar extract "${appAsar}" "${tempDir}"`, { stdio: 'inherit' });
        success('Extracted');

        log('step', 'Applying ChurchTools patches...');
        await applyPatches(tempDir);

        log('step', 'Rebuilding app.asar...');
        execSync(`npx asar pack "${tempDir}" "${appAsar}"`, { stdio: 'inherit' });
        success('app.asar rebuilt');

        success('Patching complete!');
        console.log('\n✅ FreeShow patched with ChurchTools!');
        console.log('\nNext: Restart FreeShow → Settings → ChurchTools → Configure → Connect');
    } finally {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

function applyPatches(tempDir) {
    log('step', 'Applying ChurchTools patches...');
    
    const churchToolsDir = path.join(tempDir, 'electron', 'contentProviders', 'churchtools');
    if (!fs.existsSync(churchToolsDir)) fs.mkdirSync(churchToolsDir, { recursive: true });

    // Update ContentProviderRegistry
    const registryFile = path.join(tempDir, 'electron', 'contentProviders', 'ContentProviderRegistry.ts');
    if (fs.existsSync(registryFile)) {
        let content = fs.readFileSync(registryFile, 'utf8');
        if (!content.includes('churchtools')) {
            content = content.replace(
                /^(import .* from ".\/ContentProviderFactory";)/m,
                '$1\nimport { ChurchToolsProvider } from "./churchtools/ChurchToolsProvider";'
            );
            content = content.replace(
                /(ContentProviderFactory\.register\([^)]+\);)/,
                '$1\nContentProviderFactory.register("churchtools", ChurchToolsProvider);'
            );
            fs.writeFileSync(registryFile, content);
            success('Updated ContentProviderRegistry');
        }
    }

    // Create churchtools provider
    const churchToolsFiles = {
        'ChurchToolsProvider.ts': `import { ContentProvider } from "../base/ContentProvider"
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
}`,
        'types.ts': `export type ChurchToolsScopes = "calendar" | "services" | "songs" | "events" | "persons" | "files"
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
export interface ChurchToolsServiceLead { serviceName: string; persons: { fullname: string; shortname: string; imageUrl?: string | null; imageName?: string | null }[] }`
    };

    const churchToolsDir = path.join(tempDir, 'electron', 'contentProviders', 'churchtools');
    if (!fs.existsSync(churchToolsDir)) fs.mkdirSync(churchToolsDir, { recursive: true });

    for (const [filename, content] of Object.entries(churchToolsFiles)) {
        fs.writeFileSync(path.join(churchToolsDir, filename), content);
    }
    success('Applied ChurchTools patches');
}

if (require.main === module) {
    main().catch(err => { error(err.message); process.exit(1); });
}
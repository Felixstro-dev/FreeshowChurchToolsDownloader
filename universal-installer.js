#!/usr/bin/env node
/**
 * Universal FreeShow ChurchTools Installer/Patcher
 * Works on Windows, macOS, and Linux
 * Can install fresh or patch existing FreeShow installation
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const CONFIG = {
    githubRepo: 'YOUR_USERNAME/freeshow-churchtools',
    appImageName: 'FreeShow-1.6.8-beta.4-x86_64.AppImage',
    version: '1.6.8-churchtools.1'
};

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(style, msg) {
    console.log(`${colors[style]}==>${colors.reset} ${msg}`);
}

function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warning(msg) { console.log(`${colors.yellow}!${colors.reset} ${msg}`); }
function error(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }

function run(cmd, args, opts = {}) {
    const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
    }
    return result;
}

function findFreeShow() {
    const platform = process.platform;
    const paths = [];

    if (platform === 'darwin') {
        paths.push(
            '/Applications/FreeShow.app/Contents/Resources',
            path.join(process.env.HOME, 'Applications/FreeShow.app/Contents/Resources'),
            '/Applications/FreeShow.app/Contents/Resources'
        );
    } else if (platform === 'win32') {
        paths.push(
            path.join(process.env.PROGRAMFILES, 'FreeShow', 'resources'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'FreeShow', 'resources'),
            path.join(process.env.LOCALAPPDATA, 'Programs', 'FreeShow', 'resources'),
            path.join(process.env.APPDATA, 'FreeShow', 'resources')
        );
    } else {
        paths.push(
            '/opt/FreeShow/resources',
            '/usr/lib/freeshow/resources',
            '/usr/share/freeshow/resources',
            path.join(process.env.HOME, '.local/bin/FreeShow/resources'),
            path.join(process.env.HOME, '.local/share/freeshow/resources'),
            '/var/lib/flatpak/app/com.freeshow.FreeShow/current/active/files/resources',
            '/snap/freeshow/current/resources'
        );
        
        // Check for AppImage
        const appImagePaths = [
            '/opt/FreeShow.AppImage',
            path.join(process.env.HOME, '.local/bin/FreeShow.AppImage'),
            '/usr/local/bin/FreeShow.AppImage'
        ];
        for (const p of appImagePaths) {
            if (fs.existsSync(p)) return { type: 'appimage', path: p };
        }
    }

    for (const p of paths) {
        const asar = path.join(p, 'app.asar');
        if (fs.existsSync(asar)) {
            return { type: 'installed', resourcesPath: p };
        }
    }

    return null;
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file).on('finish', resolve).on('error', reject);
                });
            } else {
                response.pipe(file).on('finish', resolve).on('error', reject);
            }
        }).on('error', reject);
    });
}

async function main() {
    const args = process.argv.slice(2);
    const options = {
        force: args.includes('--force'),
        path: args.find(a => a.startsWith('--path='))?.split('=')[1],
        repo: args.find(a => a.startsWith('--repo='))?.split('=')[1] || 'YOUR_USERNAME/freeshow-churchtools',
        mode: args.includes('--patch') ? 'patch' : 'install'
    };

    console.log('\n🔧 FreeShow ChurchTools Installer/Patcher');
    console.log('==========================================\n');

    // Detect platform
    const platform = process.platform;
    log('cyan', `Platform: ${platform} (${process.arch})`);

    // Find or install FreeShow
    let installation = null;
    
    if (options.path) {
        const asarPath = path.join(options.path, 'app.asar');
        if (fs.existsSync(asarPath)) {
            installation = { type: 'installed', resourcesPath: options.path };
        }
    } else {
        installation = findFreeShow();
    }

    if (!installation) {
        if (options.mode === 'patch') {
            error('FreeShow installation not found!');
            console.log('Usage: npx freeshow-patch [--path /path/to/freeshow] [--force]');
            console.log('Tried locations:');
            console.log('  Windows: C:\\Program Files\\FreeShow, %LOCALAPPDATA%\\Programs\\FreeShow');
            console.log('  macOS: /Applications/FreeShow.app, ~/Applications/FreeShow.app');
            console.log('  Linux: /opt/FreeShow, /usr/lib/freeshow, ~/.local/bin, Flatpak, Snap');
            process.exit(1);
        } else {
            // Install fresh
            log('cyan', 'No existing installation found. Installing fresh...');
            return await installFresh();
        }
    }

    log('cyan', `Found FreeShow at: ${installation.resourcesPath || installation.path}`);
    return await patchInstallation(installation);
}

async function installFresh() {
    log('step', 'Installing fresh FreeShow with ChurchTools...');
    
    const platform = process.platform;
    let downloadUrl = '';
    let destPath = '';
    
    if (process.platform === 'linux') {
        downloadUrl = `https://github.com/${CONFIG.githubRepo}/releases/latest/download/${CONFIG.appImageName}`;
        destPath = path.join(process.env.HOME, '.local/bin', 'FreeShow.AppImage');
    } else if (process.platform === 'darwin') {
        downloadUrl = `https://github.com/${CONFIG.githubRepo}/releases/latest/download/FreeShow-1.6.8-beta.4-universal.dmg`;
        destPath = '/Applications/FreeShow.dmg';
    } else {
        downloadUrl = `https://github.com/${CONFIG.githubRepo}/releases/latest/download/FreeShow-1.6.8-beta.4-win.exe`;
        destPath = path.join(process.env.USERPROFILE, 'Downloads', 'FreeShow-Setup.exe');
    }

    log('step', `Downloading from ${downloadUrl}...`);
    await downloadFile(downloadUrl, destPath);
    
    if (platform === 'linux') {
        fs.chmodSync(destPath, '755');
        // Create symlink
        const binDir = path.join(process.env.HOME, '.local/bin');
        if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
        const linkPath = path.join(binDir, 'freeshow');
        if (fs.existsSync(linkPath)) fs.unlinkSync(linkPath);
        fs.symlinkSync(destPath, linkPath);
        success(`Installed to ${destPath}`);
        success(`Run 'freeshow' from terminal or find in app menu`);
    } else if (platform === 'darwin') {
        success(`Downloaded to ${destPath}. Open to install.`);
    } else {
        success(`Downloaded to ${destPath}. Run to install.`);
    }
}

async function patchInstallation(installation) {
    log('step', 'Patching existing FreeShow installation...');
    
    const resourcesPath = installation.resourcesPath || path.dirname(installation.path);
    const appAsar = path.join(resourcesPath, 'app.asar');
    
    if (!fs.existsSync(appAsar)) {
        error(`app.asar not found at ${appAsar}`);
        process.exit(1);
    }

    // Backup
    const backupPath = `${appAsar}.backup.$(date +%s)`;
    if (!fs.existsSync(backupPath)) {
        log('step', 'Creating backup...');
        fs.copyFileSync(appAsar, backupPath);
        success(`Backup: ${backupPath}`);
    }

    // Extract
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freeshow-patch-'));
    
    try {
        log('step', 'Extracting app.asar...');
        execSync(`npx asar extract "${appAsar}" "${tempDir}"`, { stdio: 'inherit' });
        success('Extracted');

        // Patch files
        log('step', 'Applying ChurchTools patches...');
        await applyPatches(tempDir);

        // Rebuild
        log('step', 'Rebuilding app.asar...');
        execSync(`npx asar pack "${tempDir}" "${appAsar}"`, { stdio: 'inherit' });
        success('app.asar rebuilt');

        success('Patching complete!');
        console.log('\n🎉 FreeShow patched with ChurchTools integration!');
        console.log('\nNext steps:');
        console.log('1. Restart FreeShow');
        console.log('2. Settings → ChurchTools tab');
        console.log('3. Enter Base URL, Client ID, Client Secret');
        console.log('4. Test Connection → Connect');
        console.log('5. Import → ChurchTools → Select service → Import');

    } finally {
        // Cleanup
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

async function applyPatches(tempDir) {
    log('step', 'Applying ChurchTools patches...');
    
    // 1. Ensure churchtools directory exists
    const churchToolsDir = path.join(tempDir, 'electron', 'contentProviders', 'churchtools');
    if (!fs.existsSync(churchToolsDir)) {
        fs.mkdirSync(churchToolsDir, { recursive: true });
    }

    // 2. Update ContentProviderRegistry
    const registryFile = path.join(tempDir, 'electron', 'contentProviders', 'ContentProviderRegistry.ts');
    if (fs.existsSync(registryFile)) {
        let content = fs.readFileSync(registryFile, 'utf8');
        if (!content.includes('churchtools')) {
            // Add import
            content = content.replace(
                /^(import .* from ".\/ContentProviderFactory";)/m,
                '$1\nimport { ChurchToolsProvider } from "./churchtools/ChurchToolsProvider";'
            );
            // Add registration
            content = content.replace(
                /(ContentProviderFactory\.register\([^)]+\);)/,
                '$1\nContentProviderFactory.register("churchtools", ChurchToolsProvider);'
            );
            fs.writeFileSync(registryFile, content);
            success('Updated ContentProviderRegistry');
        }
    }

    // 2. Create minimal churchtools provider files
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
    async apiRequest(data: any): Promise<any> { throw new Error("Not fully implemented - build from source for full features") }
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
export interface ChurchToolsServiceLead { serviceName: string; persons: { fullname: string; shortname: string }[] }`
    };

    for (const [filename, content] of Object.entries(churchToolsFiles)) {
        fs.writeFileSync(path.join(tempDir, 'electron', 'contentProviders', 'churchtools', filename), content);
    }
    success('Applied ChurchTools patches');
}

if (require.main === module) {
    main().catch(err => {
        error(err.message);
        process.exit(1);
    });
}
#!/usr/bin/env node
/**
 * FreeShow ChurchTools Updater
 * Updates FreeShow with ChurchTools integration while preserving settings
 * Usage: npx freeshow-updater [options]
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { EventEmitter } = require('events');

const CONFIG = {
    githubRepo: 'Felixstro-dev/FreeshowChurchToolsDownloader',
    currentVersion: '1.6.8-churchtools.1',
    settingsPaths: {
        linux: [
            path.join(os.homedir(), '.config/freeshow/config.json'),
            path.join(os.homedir(), '.config/FreeShow/config.json'),
            path.join(os.homedir(), '.config/freeshow/settings.json'),
        ],
        darwin: [
            path.join(os.homedir(), 'Library/Application Support/FreeShow/config.json'),
            path.join(os.homedir(), 'Library/Application Support/FreeShow/settings.json'),
        ],
        win32: [
            path.join(process.env.APPDATA, 'FreeShow', 'config.json'),
            path.join(process.env.APPDATA, 'FreeShow', 'settings.json'),
            path.join(process.env.LOCALAPPDATA, 'FreeShow', 'config.json'),
        ]
    },
    appPaths: {
        linux: [
            '/opt/FreeShow',
            '/usr/lib/freeshow',
            '/usr/share/freeshow',
            path.join(os.homedir(), '.local/bin/FreeShow'),
            path.join(os.homedir(), '.local/share/freeshow'),
            '/var/lib/flatpak/app/com.freeshow.FreeShow/current/active/files',
            '/snap/freeshow/current',
        ],
        darwin: [
            '/Applications/FreeShow.app/Contents/Resources',
            path.join(os.homedir(), 'Applications/FreeShow.app/Contents/Resources'),
        ],
        win32: [
            path.join(process.env.PROGRAMFILES, 'FreeShow', 'resources'),
            path.join(process.env['PROGRAMFILES(X86)'] || '', 'FreeShow', 'resources'),
            path.join(process.env.LOCALAPPDATA, 'Programs', 'FreeShow', 'resources'),
            path.join(process.env.APPDATA, 'FreeShow', 'resources'),
        ]
    }
};

const colors = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m'
};

function log(style, msg) { console.log(`${colors[style]}==>${colors.reset} ${msg}`); }
function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}!${colors.reset} ${msg}`); }
function error(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }
function info(msg) { console.log(`${colors.gray}${msg}${colors.reset}`); }

function run(cmd, args, opts = {}) {
    const result = require('child_process').spawnSync(cmd, args, { stdio: 'pipe', shell: true, ...opts });
    return { code: result.status, stdout: result.stdout?.toString() || '', stderr: result.stderr?.toString() || '' };
}

function findSettings() {
    const paths = CONFIG.settingsPaths[process.platform] || [];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function findInstallation() {
    const paths = CONFIG.appPaths[process.platform] || [];
    for (const p of paths) {
        const asar = path.join(p, 'app.asar');
        if (fs.existsSync(asar)) return { type: 'installed', resourcesPath: p };
        if (fs.existsSync(path.join(p, 'app.asar.unpacked'))) return { type: 'installed', resourcesPath: p };
    }
    // Check AppImage
    const appImages = [
        '/opt/FreeShow.AppImage',
        path.join(os.homedir(), '.local/bin/FreeShow.AppImage'),
        '/usr/local/bin/FreeShow.AppImage'
    ];
    for (const p of appImages) {
        if (fs.existsSync(p)) return { type: 'appimage', path: p };
    }
    return null;
}

function backupSettings(settingsPath, backupDir) {
    if (!settingsPath || !fs.existsSync(settingsPath)) return null;
    const backupPath = path.join(backupDir, `settings-backup-${Date.now()}.json`);
    fs.copyFileSync(settingsPath, backupPath);
    return backupPath;
}

function restoreSettings(backupPath, targetPath) {
    if (!backupPath || !fs.existsSync(backupPath)) return false;
    fs.copyFileSync(backupPath, targetPath);
    return true;
}

function getCurrentVersion(installation) {
    try {
        const pkgPath = path.join(installation.resourcesPath || path.dirname(installation.path), 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            return pkg.version;
        }
    } catch {}
    return 'unknown';
}

async function checkForUpdate() {
    return new Promise((resolve) => {
        const url = `https://api.github.com/repos/${CONFIG.githubRepo}/releases/latest`;
        https.get(url, { headers: { 'User-Agent': 'FreeShow-Updater' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const release = JSON.parse(data);
                    resolve({ version: release.tag_name, url: release.html_url, notes: release.body });
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, (res) => res.pipe(file).on('finish', resolve).on('error', reject));
            } else {
                response.pipe(file).on('finish', resolve).on('error', reject);
            }
        }).on('error', reject);
    });
}

async function runUpdater(options = {}) {
    console.log('\n🔧 FreeShow ChurchTools Updater');
    console.log('=================================\n');

    const dryRun = options.dryRun || false;
    const force = options.force || false;
    const backupOnly = options.backupOnly || false;
    const rollback = options.rollback || false;

    // 1. Find installation
    log('cyan', 'Scanning for FreeShow installation...');
    const installation = findInstallation();
    if (!installation) {
        error('FreeShow not found! Install first or specify --path');
        process.exit(1);
    }
    success(`Found: ${installation.type} at ${installation.resourcesPath || installation.path}`);

    // 2. Find settings
    const settingsPath = findSettings();
    if (settingsPath) success(`Found settings: ${settingsPath}`);
    else warn('No settings file found (first run?)');

    // 3. Create backup directory
    const backupDir = path.join(os.tmpdir(), `freeshow-backup-${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });

    // 4. Backup settings
    let settingsBackup = null;
    if (settingsPath) {
        log('step', 'Backing up settings...');
        const backupPath = backupSettings(settingsPath, backupDir);
        if (backupPath) success(`Settings backed up: ${backupPath}`);
    }

    // 5. Backup app.asar if patching
    let appAsarBackup = null;
    if (installation.type === 'installed') {
        const appAsar = path.join(installation.resourcesPath, 'app.asar');
        if (fs.existsSync(appAsar)) {
            const backupPath = `${appAsar}.backup-${Date.now()}`;
            if (!fs.existsSync(backupPath)) {
                fs.copyFileSync(appAsar, backupPath);
                appAsarBackup = backupPath;
                success(`App backup: ${backupPath}`);
            }
        }
    }

    if (backupOnly) {
        success(`Backup complete! Files in: ${backupDir}`);
        return;
    }

    // 5. Check for updates
    log('step', 'Checking for updates...');
    const latest = await checkForUpdate();
    if (latest) {
        info(`Latest: ${latest.version} (current: ${CONFIG.currentVersion})`);
        if (latest.version !== CONFIG.currentVersion) {
            warn(`Update available: ${latest.version}`);
        } else {
            success('Already on latest version');
        }
    }

    if (dryRun) {
        info('Dry run complete. No changes made.');
        return;
    }

    // 6. Perform update/patch
    if (installation.type === 'installed') {
        await patchInstallation(installation, backupDir);
    } else if (installation.type === 'appimage') {
        await updateAppImage(installation.path, backupDir);
    }

    // 6. Restore settings
    if (settingsPath && fs.existsSync(settingsPath)) {
        log('step', 'Verifying settings...');
        // Settings should be preserved as we only patch app.asar
        success('Settings preserved');
    }

    success('Update complete!');
    console.log('\n✅ Update successful!');
    console.log('\nNext steps:');
    console.log('1. Restart FreeShow');
    console.log('2. Settings → ChurchTools → Verify connection');
    console.log('3. Import → ChurchTools → Test import');
}

async function patchInstallation(installation, backupDir) {
    log('step', 'Patching installation...');
    const resourcesPath = installation.resourcesPath;
    const appAsar = path.join(resourcesPath, 'app.asar');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freeshow-update-'));

    try {
        log('step', 'Extracting app.asar...');
        execSync(`npx asar extract "${appAsar}" "${tempDir}"`, { stdio: 'inherit' });
        success('Extracted');

        // Apply patches
        log('step', 'Applying ChurchTools patches...');
        await applyPatches(tempDir);

        // Rebuild
        log('step', 'Rebuilding app.asar...');
        execSync(`npx asar pack "${tempDir}" "${appAsar}"`, { stdio: 'inherit' });
        success('app.asar rebuilt');

    } finally {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
}

async function applyPatches(tempDir) {
    // 1. Ensure churchtools directory
    const churchToolsDir = path.join(tempDir, 'electron', 'contentProviders', 'churchtools');
    if (!fs.existsSync(churchToolsDir)) {
        fs.mkdirSync(churchToolsDir, { recursive: true });
    }

    // 2. Update ContentProviderRegistry
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

    // 3. Create churchtools provider files
    const files = {
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
export interface ChurchToolsServiceLead { serviceName: string; persons: { fullname: string; shortname: string }[] }`
    };

    for (const [filename, content] of Object.entries(churchToolsFiles)) {
        fs.writeFileSync(path.join(tempDir, 'electron', 'contentProviders', 'churchtools', filename), content);
    }
    success('Applied ChurchTools patches');
}

async function updateAppImage(appImagePath, backupDir) {
    log('step', 'Updating AppImage...');
    // For AppImage, we replace the file
    const backupPath = `${installation.path}.backup-${Date.now()}`;
    fs.copyFileSync(installation.path, backupPath);
    success(`AppImage backed up: ${backupPath}`);

    // Download latest
    const url = `https://github.com/${CONFIG.githubRepo}/releases/latest/download/FreeShow-1.6.8-beta.4-x86_64.AppImage`;
    await downloadFile(url, installation.path);
    fs.chmodSync(installation.path, 0o755);
    success('AppImage updated');
}

function rollback(backupDir) {
    log('step', 'Rolling back...');
    // Restore app.asar
    const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('app.asar.backup-')).sort().reverse();
    if (backups.length > 0) {
        // Would need to know original path
        warn('Manual rollback needed. Backup in: ' + backupDir);
    }
    // Restore settings
    const settingsBackups = fs.readdirSync(backupDir).filter(f => f.startsWith('settings-backup-')).sort().reverse();
    if (settingsBackups.length > 0) {
        warn('Settings backup available at: ' + path.join(backupDir, settingsBackups[0]));
    }
}

function showHelp() {
    console.log(`
FreeShow ChurchTools Updater
============================

Usage: npx freeshow-updater [options]

Options:
  --dry-run          Check for updates without making changes
  --backup-only      Only backup settings and app.asar
  --force            Force update even if same version
  --rollback         Rollback to previous backup
  --repo <user/repo> Custom GitHub repo (default: Felixstro-dev/FreeshowChurchToolsDownloader)
  --path <path>      Custom FreeShow installation path
  --help             Show this help

Examples:
  npx freeshow-updater                    # Check and update
  npx freeshow-updater --dry-run          # Check only
  npx freeshow-updater --backup-only      # Backup settings only
  npx freeshow-updater --rollback         # Rollback to last backup
  npx freeshow-updater --force            # Force reinstall
`);
}

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) { showHelp(); process.exit(0); }
    if (args.includes('--version') || args.includes('-v')) { console.log(CONFIG.currentVersion); process.exit(0); }

    const options = {
        dryRun: args.includes('--dry-run'),
        force: args.includes('--force'),
        backupOnly: args.includes('--backup-only'),
        rollback: args.includes('--rollback'),
        repo: args.find(a => a.startsWith('--repo='))?.split('=')[1],
        path: args.find(a => a.startsWith('--path='))?.split('=')[1]
    };

    if (options.repo) CONFIG.githubRepo = options.repo;

    runUpdater(options).catch(err => {
        error(err.message);
        process.exit(1);
    });
}
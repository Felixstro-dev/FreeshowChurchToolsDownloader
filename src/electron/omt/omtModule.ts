// Loads "openmediatransport", shared by receiver and send worker.

let pathModule: typeof import("path") | null = null
let workerThreads: { isMainThread: boolean } | null = null

function getPathModule(): typeof import("path") | null {
    if (pathModule) return pathModule
    if (typeof process !== "undefined" && process.versions?.node) {
        try {
            pathModule = require("path")
            return pathModule
        } catch {
            return null
        }
    }
    return null
}

function getWorkerThreads(): { isMainThread: boolean } | null {
    if (workerThreads) return workerThreads
    if (typeof process !== "undefined" && process.versions?.node) {
        try {
            workerThreads = require("worker_threads")
            return workerThreads
        } catch {
            return null
        }
    }
    return null
}

function getIsMainThread(): boolean {
    const wt = getWorkerThreads()
    return wt?.isMainThread ?? true // Assume main thread if not in Node.js
}

// Ensure OMT VMX codec DLL is in PATH on Windows (main thread only)
let searchPathReady = false
export function ensureOmtCodecSearchPath() {
    if (searchPathReady || process.platform !== "win32" || !getIsMainThread()) return
    searchPathReady = true

    const pathModule = getPathModule()
    if (!pathModule) return

    try {
        const moduleDir = pathModule.dirname(require.resolve("openmediatransport/package.json"))
        // packaged builds keep native modules outside the asar archive
        const addonDir = pathModule.join(moduleDir.replace(`app.asar${pathModule.sep}`, `app.asar.unpacked${pathModule.sep}`), "build", "Release")
        if (!(process.env.PATH || "").split(pathModule.delimiter).includes(addonDir)) {
            process.env.PATH = `${addonDir}${pathModule.delimiter}${process.env.PATH || ""}`
        }
    } catch {
        // not installed — the load below reports it
    }
}

let omtModule: any | null = null
let omtPromise: Promise<any | null> | null = null
let warned = false

export function loadOMT(): Promise<any | null> {
    if (omtModule) return Promise.resolve(omtModule)
    if (omtPromise) return omtPromise

    ensureOmtCodecSearchPath()

    omtPromise = import("openmediatransport")
        .then((imported: any) => {
            omtModule = imported
            return imported
        })
        .catch((err: any) => {
            if (!warned) console.warn("OMT not available:", err?.message || err)
            warned = true
            return null
        })
        .finally(() => {
            omtPromise = null
        })

    return omtPromise
}

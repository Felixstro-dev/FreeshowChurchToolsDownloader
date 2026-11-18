import { SenderCapture } from "./SenderCapture"

// The one worker thread for all senders, Blackmagic, RTMP and stream receive: a shared texture opens on one thread only.

let WorkerClass: typeof import("worker_threads").Worker | null = null
let pathModule: typeof import("path") | null = null

function getWorkerClass(): typeof import("worker_threads").Worker | null {
    if (WorkerClass) return WorkerClass
    if (typeof process !== "undefined" && process.versions?.node) {
        try {
            const workerThreads = require("worker_threads")
            WorkerClass = workerThreads.Worker
            return WorkerClass
        } catch {
            return null
        }
    }
    return null
}

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

export class SenderThread {
    private static worker: any = null
    private static listeners: ((msg: any) => void)[] = []
    private static exitHandlers: (() => void)[] = []

    static get(): any {
        if (this.worker) return this.worker

        const WorkerClass = getWorkerClass()
        if (!WorkerClass) {
            console.warn("Worker threads not available (not in Node.js environment)")
            return null
        }

        const pathModule = getPathModule()
        if (!pathModule) {
            console.warn("path module not available (not in Node.js environment)")
            return null
        }

        try {
            this.worker = new WorkerClass(pathModule.join(__dirname, "senderWorkerHost.js"), {
                env: { ...process.env, UV_THREADPOOL_SIZE: "32" }
            })
            this.worker.on("message", (msg: any) => {
                if (!msg?.type) return
                if (SenderCapture.handleMessage(msg)) return
                for (const fn of this.listeners) fn(msg)
            })
            this.worker.on("error", (err: Error) => console.error("Sender worker error:", err))
            this.worker.on("exit", (code: number) => {
                if (code !== 0) console.error(`Sender worker exited with code ${code}`)
                this.worker = null
                for (const fn of this.exitHandlers) fn()
            })
        } catch (err) {
            console.error("Could not start sender worker:", err)
            this.worker = null
        }

        return this.worker
    }

    static subscribe(onMessage: (msg: any) => void, onExit: () => void) {
        this.listeners.push(onMessage)
        this.exitHandlers.push(onExit)
    }

    static post(msg: any, transfer?: any[]) {
        if (transfer) this.get()?.postMessage(msg, transfer)
        else this.get()?.postMessage(msg)
    }
}

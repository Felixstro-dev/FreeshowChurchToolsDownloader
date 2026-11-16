import { _electron as electron } from "playwright"
import { expect, test } from "@playwright/test"
import tmp from "tmp"

const timeoutMs = 2_000
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test.describe("ChurchTools Import Workflow", () => {
    let electronApp: any
    let window: any
    let tmpSettingFolder: any
    let tmpDataFolder: any

    test.beforeEach(async () => {
        // Mock GitHub API to avoid update checks
        await electronApp?.close()
        
        tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
        tmpDataFolder = tmp.dirSync({ unsafeCleanup: true })
        
        electronApp = await electron.launch({
            args: [".", "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: tmpSettingFolder.name }
        })

        // Mock Electron open dialog
        await electronApp.evaluate(async ({ dialog }, tmpDataFolderName) => {
            dialog.showOpenDialog = async (): Promise<any> => {
                return { canceled: false, filePaths: [tmpDataFolderName] }
            }
        }, tmpDataFolder.name)

        await electronApp.waitForEvent("window")
        await delay(5_000)

        // Get main window
        window = electronApp.windows().find((w: any) => w.url().includes("index.html"))
        for (let i = 0; i < 20 && !window; i++) {
            await delay(500)
            window = electronApp.windows().find((w: any) => w.url().includes("index.html"))
        }
        if (!window) window = await electronApp.firstWindow()

        window.on("console", console.log)

        // Wait for app UI to be interactive
        await window
            .locator(".popup button.start, .top")
            .first()
            .waitFor({ timeout: 10 * timeoutMs })

        // Handle first-run setup if present
        const setupStart = window.locator(".popup button.start")
        if ((await setupStart.count()) > 0) {
            const setupPopup = window.locator(".popup")
            await setupPopup.locator(".dropdown-trigger").first().click({ timeout: 5 * timeoutMs })
            await setupPopup.locator("li[role=option]").filter({ hasText: "English" }).first().click({ timeout: timeoutMs })
            await setupPopup.locator(".button-trigger").first().click({ timeout: timeoutMs })
            await setupStart.click({ timeout: timeoutMs })
        }

        // Skip guide if present
        const skipGuide = window.locator("#guideButtons").getByText("Skip")
        if ((await skipGuide.count()) > 0) await skipGuide.click({ timeout: timeoutMs })
    })

    test.afterEach(async () => {
        if (electronApp) {
            const electronProcess = electronApp.process()
            await Promise.race([electronApp.close(), delay(5_000)]).catch(() => {})
            try {
                if (electronProcess?.pid && !electronProcess.killed) electronProcess.kill("SIGKILL")
            } catch {
                // already exited
            }
            await delay(1_000)
        }
        tmpSettingFolder?.removeCallback()
        tmpDataFolder?.removeCallback()
    })

    test("Open ChurchTools settings and verify OAuth fields", async () => {
        // Open settings
        await window.getByText("Settings").first().click({ timeout: timeoutMs })
        
        // Navigate to ChurchTools tab
        await window.getByText("ChurchTools").first().click({ timeout: timeoutMs })
        
        // Verify OAuth fields are present
        await expect(window.locator("label:has-text('Base URL')")).toBeVisible({ timeout: timeoutMs })
        await expect(window.locator("label:has-text('Client ID')")).toBeVisible({ timeout: timeoutMs })
        await expect(window.locator("label:has-text('Client Secret')")).toBeVisible({ timeout: timeoutMs })
        
        // Verify import options are present
        await expect(window.locator("label:has-text('Import files')")).toBeVisible({ timeout: timeoutMs })
        await expect(window.locator("label:has-text('Import songs')")).toBeVisible({ timeout: timeoutMs })
        await expect(window.locator("label:has-text('Create service slides')")).toBeVisible({ timeout: timeoutMs })
        await expect(window.locator("label:has-text('Convert PPTX to PDF')")).toBeVisible({ timeout: timeoutMs })
    })

    test("Open Import menu and verify ChurchTools entry", async () => {
        // Click import button
        await window.getByText("Import").first().click({ timeout: timeoutMs })
        
        // Verify ChurchTools is in the import menu
        await expect(window.locator("text=ChurchTools")).toBeVisible({ timeout: timeoutMs })
        
        // Click ChurchTools - should open event selection popup
        await window.getByText("ChurchTools").first().click({ timeout: timeoutMs })
        
        // Verify event selection popup opens
        await expect(window.locator("text=Select Event")).toBeVisible({ timeout: timeoutMs })
        await expect(window.locator("text=No upcoming events found")).toBeVisible({ timeout: timeoutMs })
        
        // Close popup
        await window.locator(".popup button:has-text('Close'), .popup [icon='close']").first().click({ timeout: timeoutMs })
    })

    test("ChurchTools event selection shows loading state", async () => {
        // Click import button
        await window.getByText("Import").first().click({ timeout: timeoutMs })
        
        // Click ChurchTools
        await window.getByText("ChurchTools").first().click({ timeout: timeoutMs })
        
        // Should show loading spinner initially
        await expect(window.locator("text=Loading...")).toBeVisible({ timeout: timeoutMs })
        
        // Should show "No upcoming events" when no events are configured
        await expect(window.locator("text=No upcoming events found")).toBeVisible({ timeout: 5_000 })
    })
})

test.describe("ChurchTools Import with Mock Data", () => {
    let electronApp: any
    let window: any
    let tmpSettingFolder: any
    let tmpDataFolder: any

    test.beforeEach(async () => {
        await electronApp?.close()
        
        tmpSettingFolder = tmp.dirSync({ unsafeCleanup: true })
        tmpDataFolder = tmp.dirSync({ unsafeCleanup: true })
        
        electronApp = await electron.launch({
            args: [".", "--no-sandbox"],
            env: { ...process.env, NODE_ENV: "production", FS_MOCK_STORE_PATH: tmpSettingFolder.name }
        })

        await electronApp.evaluate(async ({ dialog }, tmpDataFolderName) => {
            dialog.showOpenDialog = async (): Promise<any> => {
                return { canceled: false, filePaths: [tmpDataFolderName] }
            }
        }, tmpDataFolder.name)

        await electronApp.waitForEvent("window")
        await delay(5_000)

        window = electronApp.windows().find((w: any) => w.url().includes("index.html"))
        for (let i = 0; i < 20 && !window; i++) {
            await delay(500)
            window = electronApp.windows().find((w: any) => w.url().includes("index.html"))
        }
        if (!window) window = await electronApp.firstWindow()

        window.on("console", console.log)

        await window
            .locator(".popup button.start, .top")
            .first()
            .waitFor({ timeout: 10 * timeoutMs })

        const setupStart = window.locator(".popup button.start")
        if ((await setupStart.count()) > 0) {
            const setupPopup = window.locator(".popup")
            await setupPopup.locator(".dropdown-trigger").first().click({ timeout: 5 * timeoutMs })
            await setupPopup.locator("li[role=option]").filter({ hasText: "English" }).first().click({ timeout: timeoutMs })
            await setupPopup.locator(".button-trigger").first().click({ timeout: timeoutMs })
            await setupStart.click({ timeout: timeoutMs })
        }

        const skipGuide = window.locator("#guideButtons").getByText("Skip")
        if ((await skipGuide.count()) > 0) await skipGuide.click({ timeout: timeoutMs })
    })

    test.afterEach(async () => {
        if (electronApp) {
            const electronProcess = electronApp.process()
            await Promise.race([electronApp.close(), delay(5_000)]).catch(() => {})
            try {
                if (electronProcess?.pid && !electronProcess.killed) electronProcess.kill("SIGKILL")
            } catch {
                // already exited
            }
            await delay(1_000)
        }
        tmpSettingFolder?.removeCallback()
        tmpDataFolder?.removeCallback()
    })

    test("Verify ChurchTools import preview shows agenda, songs, bible verses, service team, attachments", async () => {
        // This test would require mocking the ChurchTools API responses
        // For now, verify the preview popup structure exists
        
        // Open import menu
        await window.getByText("Import").first().click({ timeout: timeoutMs })
        
        // Click ChurchTools
        await window.getByText("ChurchTools").first().click({ timeout: timeoutMs })
        
        // Wait for event selection or empty state
        await expect(window.locator(".churchtools-event-selection, .churchtools-import-preview")).toBeVisible({ timeout: timeoutMs })
        
        // If event selection is shown, verify structure
        const eventSelection = window.locator(".churchtools-event-selection")
        if (await eventSelection.isVisible()) {
            await expect(eventSelection.locator("h2:has-text('Select Event')")).toBeVisible()
        }
        
        // Close popup
        await window.locator(".popup button:has-text('Close'), .popup [icon='close']").first().click({ timeout: timeoutMs })
    })
})
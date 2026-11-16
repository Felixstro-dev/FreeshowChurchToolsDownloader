import type {
  ChurchToolsEvent,
  ChurchToolsEventFull,
  ChurchToolsAgenda,
  ChurchToolsSong,
  ChurchToolsService,
  ChurchToolsPerson,
  ChurchToolsCalendar,
  ChurchToolsCalendarAppointment,
  ChurchToolsPermissions,
  ChurchToolsInfo,
  ChurchToolsSongStatistic,
  ChurchToolsSongVerificationResult,
  ChurchToolsServiceLead,
  ChurchToolsEventFile,
} from "./types"
import { ChurchToolsProvider } from "./ChurchToolsProvider"
import { ChurchToolsAuth } from "./ChurchToolsAuth"

/**
 * ChurchTools Import Module
 * Handles fetching data from ChurchTools API
 */
export class ChurchToolsImport {
  private auth: ChurchToolsAuth

  constructor(_provider: ChurchToolsProvider) {
    this.auth = (_provider as any).auth
  }

  private getHeaders(): Record<string, string> {
    // Use Bearer token for OAuth 2.0
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.auth.getAccessToken()}`,
    }
  }

  private async fetchJson<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.auth.getBaseUrl()}${endpoint}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ChurchTools API error: ${response.status} ${errorText}`)
    }

    return response.json()
  }

  async loadServices(syncFolderIds?: string[]): Promise<void> {
    // This would sync events/services to FreeShow projects
    // For now, this is a placeholder for future implementation
    console.log("ChurchTools: loadServices called", syncFolderIds)
  }

  async getEvents(fromDate: Date, toDate?: Date): Promise<ChurchToolsEvent[]> {
    const params: Record<string, string> = {
      from: fromDate.toISOString().split("T")[0],
    }
    if (toDate) {
      params.to = toDate.toISOString().split("T")[0]
    }

    const result = await this.fetchJson<{ data: ChurchToolsEvent[] }>("/api/events", params)
    return result.data || []
  }

  async getNextEvent(fromDate: Date, agendaRequired = false): Promise<ChurchToolsEvent | null> {
    const events = await this.getEvents(fromDate)
    const now = new Date()

    for (const event of events) {
      const eventEnd = new Date(event.endDate)
      if (eventEnd > now) {
        if (agendaRequired) {
          try {
            await this.getEventAgenda(event)
          } catch {
            continue // Skip events without agenda
          }
        }
        return event
      }
    }
    return null
  }

  async getFullEvent(event: ChurchToolsEvent): Promise<ChurchToolsEventFull> {
    const result = await this.fetchJson<{ data: ChurchToolsEventFull }>(`/api/events/${event.id}`)
    return result.data
  }

  async getEventAgenda(event: ChurchToolsEvent): Promise<ChurchToolsAgenda> {
    const result = await this.fetchJson<{ data: ChurchToolsAgenda }>(`/api/events/${event.id}/agenda`)
    return result.data
  }

  async getSongs(event?: ChurchToolsEvent, requireTags = true): Promise<ChurchToolsSong[]> {
    const songs: ChurchToolsSong[] = []

    if (event) {
      // Get songs for specific event
      const result = await this.fetchJson<{ data: ChurchToolsSong[] }>(
        `/api/events/${event.id}/agenda/songs`
      )
      if (result.data) {
        for (const song of result.data) {
          if (requireTags && (!song.tags || song.tags.length === 0)) {
            song.tags = await this.getSongTags(song.id)
          }
          songs.push(song)
        }
      }
    } else {
      // Get all songs with pagination
      let page = 1
      const pageSize = 200
      let hasMore = true

      while (hasMore) {
        const result = await this.fetchJson<{
          data: ChurchToolsSong[]
          meta: { pagination?: { current: number; last_page: number } }
        }>("/api/songs", {
          "include[]": "tags,arrangements",
          limit: pageSize.toString(),
          page: page.toString(),
        })

        if (result.data) {
          songs.push(...result.data)
        }

        if (result.meta?.pagination) {
          hasMore = result.meta.pagination.current < result.meta.pagination.last_page
          page++
        } else {
          hasMore = false
        }
      }
    }

    return songs
  }

  async getAllSongs(): Promise<ChurchToolsSong[]> {
    return this.getSongs(undefined, true)
  }

  async getSong(songId: number): Promise<ChurchToolsSong> {
    const result = await this.fetchJson<{ data: ChurchToolsSong }>(`/api/songs/${songId}`, {
      "include[]": "arrangements",
    })
    return result.data
  }

  private async getSongTags(songId: number): Promise<Array<{ id: number; name: string }>> {
    try {
      const result = await this.fetchJson<{ data: ChurchToolsSong[] }>("/api/songs", {
        "ids[]": songId.toString(),
        "include[]": "tags",
      })
      return result.data?.[0]?.tags || []
    } catch {
      return []
    }
  }

  async getServices(): Promise<ChurchToolsService[]> {
    const result = await this.fetchJson<{ data: ChurchToolsService[] }>("/api/services")
    return result.data || []
  }

  async getPerson(personId: string): Promise<ChurchToolsPerson | undefined> {
    try {
      const result = await this.fetchJson<{ data: ChurchToolsPerson }>(`/api/persons/${personId}`)
      return result.data
    } catch (error) {
      if (error instanceof Error && error.message.includes("403")) {
        console.warn("Insufficient permissions to read person data")
      }
      return undefined
    }
  }

  async getCalendars(): Promise<ChurchToolsCalendar[]> {
    const result = await this.fetchJson<{ data: ChurchToolsCalendar[] }>("/api/calendars")
    return result.data || []
  }

  async getAppointments(
    fromDate: Date,
    toDate: Date,
    calendarIds: number[]
  ): Promise<ChurchToolsCalendarAppointment[]> {
    const params: Record<string, string> = {
      from: fromDate.toISOString().split("T")[0],
      to: toDate.toISOString().split("T")[0],
    }

    calendarIds.forEach((id) => {
      params[`calendar_ids[]`] = id.toString()
    })

    const result = await this.fetchJson<{ data: Array<{ appointment: { base: ChurchToolsCalendarAppointment } }> }>(
      "/api/calendars/appointments",
      params
    )

    return (
      result.data
        ?.map((item) => item.appointment.base)
        .filter((appt) => !appt.isInternal) || []
    )
  }

  async getPermissions(): Promise<ChurchToolsPermissions> {
    const result = await this.fetchJson<{ data: ChurchToolsPermissions }>("/api/permissions/global")
    return result.data
  }

  async getInfo(): Promise<ChurchToolsInfo> {
    const result = await this.fetchJson<{ data: ChurchToolsInfo }>("/api/info")
    return result.data
  }

  async downloadFile(url: string): Promise<Blob> {
    const fullUrl = url.startsWith("http") ? url : `${this.auth.getBaseUrl()}${url}`
    const response = await fetch(fullUrl, {
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`)
    }

    return response.blob()
  }

  async downloadAndConvertEventFiles(eventFiles: ChurchToolsEventFile[], importOptions: { convertPptxToPdf?: boolean } = {}): Promise<{ originalUrl: string; localPath: string; type: string }[]> {
    const results: { originalUrl: string; localPath: string; type: string }[] = []
    const fs = await import("fs")
    const path = await import("path")
    const { getDataFolderPath, sanitizeFileName } = await import("../../utils/files")
    const { execFile } = await import("child_process")
    const { promisify } = await import("util")
    const { isMac, isWindows } = await import("../..")

    const outputFolder = getDataFolderPath("imports", "ChurchTools")
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true })
    }

    const execFileAsync = promisify(execFile)

    const DEFAULT_SOFFICE_PATHS: Record<string, string[]> = {
      win32: [path.join(process.env.PROGRAMFILES || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"), path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe")],
      darwin: ["/Applications/LibreOffice.app/Contents/MacOS/soffice"],
      linux: ["/usr/bin/soffice", "/usr/bin/libreoffice"]
    }

    function getSofficePath(): string {
      const paths = DEFAULT_SOFFICE_PATHS[process.platform] || []
      return paths.find((p) => fs.existsSync(p)) || "soffice"
    }

    async function convertWithLibreOffice(inputPath: string, outputPath: string, outputFolder: string): Promise<boolean> {
      try {
        const sofficePath = getSofficePath()
        await execFileAsync(sofficePath, ["--headless", "--convert-to", "pdf", "--outdir", outputFolder, inputPath], { timeout: 120000 })
        return fs.existsSync(outputPath)
      } catch (err) {
        return false
      }
    }

    async function convertWithPowerPoint(inputPath: string, outputPath: string): Promise<boolean> {
      if (!isWindows && !isMac) return false

      try {
        if (isWindows) {
          const script = `param($in,$out); $ppt = New-Object -ComObject PowerPoint.Application; try { $ppt.DisplayAlerts = 1; $doc = $ppt.Presentations.Open([IO.Path]::GetFullPath($in), -1, 0, 0); $doc.SaveAs([IO.Path]::GetFullPath($out), 32); $doc.Close() } finally { $ppt.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null }`
          await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script, inputPath, outputPath], { timeout: 60000 })
        } else if (isMac) {
          const script = `tell application "Microsoft PowerPoint"\nset theDoc to open (POSIX file "${inputPath.replace(/"/g, '\\"')}")\nsave theDoc in (POSIX file "${outputPath.replace(/"/g, '\\"')}") as save as PDF\nclose theDoc saving no\nend tell`
          await execFileAsync("osascript", ["-e", script], { timeout: 60000 })
        }
      } catch (err) {
        // PowerPoint not available or failed
      }
      return fs.existsSync(outputPath)
    }

    for (const file of eventFiles) {
      try {
        // Download the file
        const blob = await this.downloadFile(file.frontendUrl)
        const arrayBuffer = await blob.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Determine file extension
        const urlParts = file.frontendUrl.split("/")
        const originalName = urlParts[urlParts.length - 1].split("?")[0]
        const ext = path.extname(originalName).toLowerCase() || ".bin"
        const safeName = sanitizeFileName(path.basename(originalName, ext))
        const timestamp = Date.now()
        const localPath = path.join(outputFolder, `${safeName}_${timestamp}${ext}`)
        
        // Save original file
        fs.writeFileSync(localPath, buffer)
        
        let finalPath = localPath
        let finalType = ext.slice(1)
        
        // Convert PPTX to PDF if enabled
        if (importOptions.convertPptxToPdf && (ext === ".pptx" || ext === ".ppt")) {
          const pdfPath = path.join(outputFolder, `${safeName}_${timestamp}.pdf`)
          
          // Try LibreOffice first
          let converted = await convertWithLibreOffice(localPath, pdfPath, outputFolder)
          
          // Try PowerPoint if LibreOffice failed
          if (!converted) {
            converted = await convertWithPowerPoint(localPath, pdfPath)
          }
          
          if (converted && fs.existsSync(pdfPath)) {
            // Keep both original and PDF, but return PDF as primary
            finalPath = pdfPath
            finalType = "pdf"
          }
        }
        
        results.push({
          originalUrl: file.frontendUrl,
          localPath: finalPath,
          type: finalType
        })
      } catch (error) {
        console.error(`Failed to download/convert file ${file.title}:`, error)
        // Still add to results with error info
        results.push({
          originalUrl: file.frontendUrl,
          localPath: "",
          type: "error"
        })
      }
    }

    return results
  }

  async uploadEventFile(eventId: number, filename: string, content: Blob): Promise<void> {
    const formData = new FormData()
    formData.append("files[]", content, filename)

    const response = await fetch(`${this.auth.getBaseUrl()}/api/files/service/${eventId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.auth.getAccessToken()}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.status}`)
    }
  }

  async deleteEventFile(fileId: string): Promise<void> {
    const response = await fetch(`${this.auth.getBaseUrl()}/api/files/${fileId}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.status}`)
    }
  }

  async getSongStatistics(
    _fromDate: Date,
    _toDate: Date
  ): Promise<ChurchToolsSongStatistic[]> {
    // This would require custom implementation based on ChurchTools API
    // For now, return empty array
    console.log("ChurchTools: getSongStatistics not fully implemented")
    return []
  }

  async verifySongs(
    _event?: ChurchToolsEventFull,
    _options?: {
      includeTags?: string[]
      excludeTags?: string[]
      executeChecks?: string[]
      allArrangements?: boolean
    }
  ): Promise<ChurchToolsSongVerificationResult[]> {
    // This would require custom implementation
    console.log("ChurchTools: verifySongs not fully implemented")
    return []
  }

  async getServiceLeads(event: ChurchToolsEventFull): Promise<ChurchToolsServiceLead[]> {
    const services = await this.getServices()
    const serviceMap = new Map(services.map((s) => [s.id, s.name]))
    const personCache = new Map<string, ChurchToolsPerson>()

    const leadsMap = new Map<string, { fullname: string; shortname: string; imageUrl?: string | null; imageName?: string | null }[]>()

    for (const eventService of event.eventServices) {
      const serviceName = serviceMap.get(eventService.serviceId)
      if (!serviceName) continue

      let fullname: string
      let shortname: string
      let imageUrl: string | null = null
      let imageName: string | null = null

      if (eventService.person?.domainIdentifier) {
        const personId = eventService.person.domainIdentifier
        let person = personCache.get(personId)

        if (!person) {
          person = await this.getPerson(personId)
          if (person) personCache.set(personId, person)
        }

        if (person) {
          fullname = `${person.firstName} ${person.lastName}`
          shortname = person.nickname || person.firstName
          imageUrl = person.image?.imageUrl || null
          imageName = person.image?.name || null
        } else {
          fullname = eventService.name || "Unknown"
          shortname = fullname.split(" ")[0]
        }
      } else {
        fullname = eventService.name || "Unknown"
        shortname = fullname.split(" ")[0]
      }

      // Apply replacements
      const replacements = this.auth.getReplacements()
      fullname = replacements[fullname] || fullname

      if (!leadsMap.has(serviceName)) {
        leadsMap.set(serviceName, [])
      }
      leadsMap.get(serviceName)!.push({ fullname, shortname, imageUrl, imageName })
    }

    return Array.from(leadsMap.entries()).map(([serviceName, persons]) => ({
      serviceName,
      persons: persons.sort((a, b) => a.fullname.localeCompare(b.fullname)),
    }))
  }
}
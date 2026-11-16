import { ContentProvider } from "../base/ContentProvider"
import { getKey } from "../../utils/keys"
import { getContentProviderAccess } from "../../data/contentProviders"
import { ChurchToolsAuth } from "./ChurchToolsAuth"
import { ChurchToolsImport } from "./ChurchToolsImport"
import { ChurchToolsExport } from "./ChurchToolsExport"
import { churchtoolsConnect, churchtoolsDisconnect, churchtoolsStartupLoad } from "./ChurchToolsOAuth"
import type {
  ChurchToolsScopes,
  ChurchToolsAuthData,
  ChurchToolsRequestData,
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
  ChurchToolsConfig,
  ChurchToolsSongStatistic,
  ChurchToolsSongVerificationResult,
  ChurchToolsServiceLead,
  ChurchToolsOAuthConfig,
} from "./types"
import type { ContentLibraryCategory, ContentFile } from "../base/types"

// Re-export types
export type { ChurchToolsScopes } from "./types"
export type { ChurchToolsAuthData } from "./types"
export type { ChurchToolsConfig } from "./types"
export type { ChurchToolsOAuthConfig } from "./types"

/**
 * ChurchTools provider that acts as the sole interface to ChurchTools functionality.
 *
 * This is the ONLY class that should import from ChurchToolsAuth.ts, ChurchToolsImport.ts, ChurchToolsExport.ts, and ChurchToolsOAuth.ts.
 * All external code should use this provider through ContentProviderRegistry.
 */
export class ChurchToolsProvider extends ContentProvider<
  ChurchToolsScopes,
  ChurchToolsAuthData
> {
  private auth: ChurchToolsAuth
  private importModule: ChurchToolsImport
  private exportModule: ChurchToolsExport
  private oauthConfig: ChurchToolsOAuthConfig | null = null

  constructor() {
    super({
      providerId: "churchtools",
      displayName: "ChurchTools",
      port: 5503,
      clientId: getKey("churchtools_id") || "",
      clientSecret: getKey("churchtools_secret") || "",
      apiUrl: "", // Will be set from config
      scopes: ["calendar", "services", "songs", "events", "persons", "files"] as const,
    })

    this.auth = new ChurchToolsAuth(this.config)
    this.importModule = new ChurchToolsImport(this)
    this.exportModule = new ChurchToolsExport(this)
  }

  /**
   * Initialize the provider with configuration from settings
   */
  async initialize(config: ChurchToolsConfig): Promise<void> {
    this.config.apiUrl = config.baseUrl
    await this.auth.initialize(config)
    
    // Set up OAuth config
    this.oauthConfig = {
      clientId: getKey("churchtools_id") || "",
      clientSecret: getKey("churchtools_secret") || "",
      redirectUri: `http://localhost:5503/auth/complete`,
      authorizationUrl: "/oauth/authorize",
      tokenUrl: "/oauth/token"
    }
  }

  isConnected(scope: ChurchToolsScopes): boolean {
    // Check both OAuth and login token
    const oauthConnected = this.oauthConfig ? !!getContentProviderAccess("churchtools", scope) : false
    const tokenConnected = this.auth.isConnected(scope)
    return oauthConnected || tokenConnected
  }

  async connect(scope: ChurchToolsScopes, _data?: any): Promise<ChurchToolsAuthData | null> {
    // Try OAuth first if configured
    if (this.oauthConfig && this.oauthConfig.clientId && this.oauthConfig.clientSecret) {
      const result = await churchtoolsConnect(this.config.apiUrl, scope, this.oauthConfig)
      if (result) {
        this.access = result
        return result
      }
    }
    
    // Fall back to login token
    const result = await this.auth.connect(scope)
    this.access = result
    return result
  }

  disconnect(scope?: ChurchToolsScopes): void {
    const scopeToDisconnect = scope || "events"
    churchtoolsDisconnect(scopeToDisconnect)
    this.auth.disconnect(scopeToDisconnect)
    this.access = null
  }

  async apiRequest(data: ChurchToolsRequestData & { scope: ChurchToolsScopes }): Promise<any> {
    // Try OAuth first if available
    if (this.oauthConfig && this.access) {
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${this.access.access_token}`,
      }
      
      const options: RequestInit = {
        method: data.method || "GET",
        headers,
      }

      if (data.data) {
        options.body = JSON.stringify(data.data)
        headers["Content-Type"] = "application/json"
      }

      let fullUrl = `${this.config.apiUrl}${data.endpoint}`
      if (data.params) {
        const searchParams = new URLSearchParams()
        Object.entries(data.params).forEach(([key, value]) => {
          searchParams.append(key, value)
        })
        fullUrl += `?${searchParams.toString()}`
      }

      try {
        const response = await fetch(fullUrl, options)
        
        if (response.status === 401 && this.oauthConfig) {
          // Token expired, try to refresh
          await this.connect(data.authenticated ? "events" : data.scope)
          return this.apiRequest(data)
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`ChurchTools API error: ${response.status} ${errorText}`)
        }

        const contentType = response.headers.get("content-type")
        if (contentType?.includes("application/json")) {
          return response.json()
        }
        return response.text()
      } catch (error) {
        console.error("ChurchTools API request failed:", error)
        throw error
      }
    }
    
    // Fall back to login token auth
    return this.auth.apiRequest(data)
  }

  async loadServices(data?: { syncFolderIds?: string[] }): Promise<void> {
    return this.importModule.loadServices(data?.syncFolderIds)
  }

  async startupLoad(scope: ChurchToolsScopes, data?: any): Promise<void> {
    if (this.oauthConfig) {
      await churchtoolsStartupLoad(this.config.apiUrl, scope, this.oauthConfig)
    } else {
      await this.auth.initialize(data?.config)
      const connected = await this.connect(scope)
      if (!connected) return
    }

    // Export songs to ChurchTools if data provided
    if (data?.exportSongs) {
      await this.exportModule.sendSongsToChurchTools(data.exportSongs)
    }

    // Load services/events from ChurchTools
    await this.importModule.loadServices(data?.syncFolderIds)
  }

  /**
   * Get upcoming events from ChurchTools
   */
  async getEvents(fromDate: Date, toDate?: Date): Promise<ChurchToolsEvent[]> {
    return this.importModule.getEvents(fromDate, toDate)
  }

  /**
   * Get the next event with agenda
   */
  async getNextEvent(fromDate: Date, agendaRequired = false): Promise<ChurchToolsEvent | null> {
    return this.importModule.getNextEvent(fromDate, agendaRequired)
  }

  /**
   * Get full event details including agenda and files
   */
  async getFullEvent(event: ChurchToolsEvent): Promise<ChurchToolsEventFull> {
    return this.importModule.getFullEvent(event)
  }

  /**
   * Get event agenda
   */
  async getEventAgenda(event: ChurchToolsEvent): Promise<ChurchToolsAgenda> {
    return this.importModule.getEventAgenda(event)
  }

  /**
   * Get songs for an event
   */
  async getSongs(event?: ChurchToolsEvent, requireTags = true): Promise<ChurchToolsSong[]> {
    return this.importModule.getSongs(event, requireTags)
  }

  /**
   * Get all songs from ChurchTools
   */
  async getAllSongs(): Promise<ChurchToolsSong[]> {
    return this.importModule.getAllSongs()
  }

  /**
   * Get a specific song by ID
   */
  async getSong(songId: number): Promise<ChurchToolsSong> {
    return this.importModule.getSong(songId)
  }

  /**
   * Get all services (service types)
   */
  async getServices(): Promise<ChurchToolsService[]> {
    return this.importModule.getServices()
  }

  /**
   * Get person details (for nicknames)
   */
  async getPerson(personId: string): Promise<ChurchToolsPerson | undefined> {
    return this.importModule.getPerson(personId)
  }

  /**
   * Get all calendars
   */
  async getCalendars(): Promise<ChurchToolsCalendar[]> {
    return this.importModule.getCalendars()
  }

  /**
   * Get appointments for a time range
   */
  async getAppointments(
    fromDate: Date,
    toDate: Date,
    calendarIds: number[]
  ): Promise<ChurchToolsCalendarAppointment[]> {
    return this.importModule.getAppointments(fromDate, toDate, calendarIds)
  }

  /**
   * Get permissions
   */
  async getPermissions(): Promise<ChurchToolsPermissions> {
    return this.importModule.getPermissions()
  }

  /**
   * Get ChurchTools version info
   */
  async getInfo(): Promise<ChurchToolsInfo> {
    return this.importModule.getInfo()
  }

  /**
   * Download a file from ChurchTools
   */
  async downloadFile(url: string): Promise<Blob> {
    return this.importModule.downloadFile(url)
  }

  /**
   * Upload a file to a ChurchTools event
   */
  async uploadEventFile(eventId: number, filename: string, content: Blob): Promise<void> {
    return this.importModule.uploadEventFile(eventId, filename, content)
  }

  /**
   * Delete an event file
   */
  async deleteEventFile(fileId: string): Promise<void> {
    return this.importModule.deleteEventFile(fileId)
  }

  /**
   * Get song usage statistics
   */
  async getSongStatistics(
    fromDate: Date,
    toDate: Date
  ): Promise<ChurchToolsSongStatistic[]> {
    return this.importModule.getSongStatistics(fromDate, toDate)
  }

  /**
   * Verify songs for consistency
   */
  async verifySongs(
    _event?: ChurchToolsEventFull,
    _options?: {
      includeTags?: string[]
      excludeTags?: string[]
      executeChecks?: string[]
      allArrangements?: boolean
    }
  ): Promise<ChurchToolsSongVerificationResult[]> {
    return this.importModule.verifySongs(_event, _options)
  }

  /**
   * Get service leads for PowerPoint slide generation
   */
  async getServiceLeads(event: ChurchToolsEventFull): Promise<ChurchToolsServiceLead[]> {
    return this.importModule.getServiceLeads(event)
  }

  /**
   * Export data to ChurchTools (e.g., songs)
   */
  async exportData(data: any): Promise<void> {
    return this.exportModule.sendSongsToChurchTools(data)
  }

  /**
   * Check if a media URL should be encrypted
   */
  shouldEncrypt(_url: string, _pingbackUrl?: string): boolean {
    // ChurchTools doesn't use encrypted media
    return false
  }

  /**
   * Get content library categories (not applicable for ChurchTools)
   */
  async getContentLibrary(): Promise<ContentLibraryCategory[]> {
    return []
  }

  /**
   * Get content files for a category (not applicable for ChurchTools)
   */
  async getContent(_key: string): Promise<ContentFile[]> {
    return []
  }

  protected handleAuthCallback(req: any, res: any): void {
    this.auth.handleAuthCallback(req, res)
  }

  protected async refreshToken(scope: ChurchToolsScopes): Promise<ChurchToolsAuthData | null> {
    return this.auth.refreshToken(scope)
  }

  protected async authenticate(scope: ChurchToolsScopes): Promise<ChurchToolsAuthData | null> {
    return this.auth.authenticate(scope)
  }
}
import express from "express"
import type { ChurchToolsAuthData, ChurchToolsScopes, ChurchToolsRequestData } from "./types"
import { ContentProviderError, ContentProviderErrorType } from "../base/types"

/**
 * ChurchTools Authentication Handler
 * Handles OAuth 2.0 authentication for ChurchTools
 */
export class ChurchToolsAuth {
  private config: ChurchToolsAuthData | null = null
  private baseUrl: string = ""
  private replacements: Record<string, string> = {}

  constructor(private providerConfig: {
    apiUrl: string
    scopes: readonly string[]
  }) {}

  async initialize(config: {
    baseUrl: string
    replacements?: Record<string, string>
  }): Promise<void> {
    this.baseUrl = config.baseUrl.replace(/\/$/, "")
    this.replacements = config.replacements || {}
    this.providerConfig.apiUrl = this.baseUrl
  }

  isConnected(_scope: ChurchToolsScopes): boolean {
    // Check if we have valid OAuth tokens
    return !!this.config?.access_token && !!this.baseUrl
  }

  async connect(_scope: ChurchToolsScopes): Promise<ChurchToolsAuthData | null> {
    // For ChurchTools with OAuth, we rely on the OAuth flow handled by ChurchToolsOAuth
    // This method is kept for compatibility but OAuth flow is handled separately
    if (this.config?.access_token) {
      // Validate existing token
      const isValid = await this.validateToken()
      if (isValid) {
        return this.config
      }
    }
    return null
  }

  disconnect(_scope?: ChurchToolsScopes): void {
    this.config = null
  }

  private async validateToken(): Promise<boolean> {
    if (!this.config?.access_token) return false
    try {
      const response = await fetch(`${this.baseUrl}/api/info`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.config.access_token}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  }

  async apiRequest(data: ChurchToolsRequestData): Promise<any> {
    if (!this.config?.access_token) {
      throw new ContentProviderError(
        ContentProviderErrorType.NETWORK_ERROR,
        "No valid access token available",
        401
      )
    }

    const url = `${this.baseUrl}${data.endpoint}`
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${this.config.access_token}`,
    }

    if (data.authenticated) {
      headers.Authorization = `Bearer ${this.config.access_token}`
    }

    const options: RequestInit = {
      method: data.method || "GET",
      headers,
    }

    if (data.data) {
      options.body = JSON.stringify(data.data)
      headers["Content-Type"] = "application/json"
    }

    let fullUrl = url
    if (data.params) {
      const searchParams = new URLSearchParams()
      Object.entries(data.params).forEach(([key, value]) => {
        searchParams.append(key, value)
      })
      fullUrl += `?${searchParams.toString()}`
    }

    try {
      const response = await fetch(fullUrl, options)

      if (response.status === 401) {
        throw new ContentProviderError(
          ContentProviderErrorType.NETWORK_ERROR,
          "Token expired or invalid",
          401
        )
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new ContentProviderError(
          ContentProviderErrorType.NETWORK_ERROR,
          `ChurchTools API error: ${response.status} ${errorText}`,
          response.status
        )
      }

      const contentType = response.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        return response.json()
      }
      return response.text()
    } catch (error) {
      if (error instanceof ContentProviderError) throw error
      throw new ContentProviderError(
        ContentProviderErrorType.NETWORK_ERROR,
        `ChurchTools API request failed: ${error}`,
        0
      )
    }
  }

  async refreshToken(_scope: ChurchToolsScopes): Promise<ChurchToolsAuthData | null> {
    // Token refresh is handled by ChurchToolsOAuth
    return null
  }

  async authenticate(_scope: ChurchToolsScopes): Promise<ChurchToolsAuthData | null> {
    // Authentication is handled by ChurchToolsOAuth
    return null
  }

  handleAuthCallback(_req: express.Request, res: express.Response): void {
    // Not used - OAuth handled by ChurchToolsOAuth
    res.send(`
      <html>
        <body>
          <h1>ChurchTools Authentication</h1>
          <p>OAuth authentication is handled automatically.</p>
        </body>
      </html>
    `)
  }

  getAccessToken(): string {
    return this.config?.access_token || ""
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  getReplacements(): Record<string, string> {
    return this.replacements
  }

  applyReplacements(text: string): string {
    let result = text
    for (const [key, value] of Object.entries(this.replacements)) {
      result = result.replace(new RegExp(key, "g"), value)
    }
    return result
  }
}
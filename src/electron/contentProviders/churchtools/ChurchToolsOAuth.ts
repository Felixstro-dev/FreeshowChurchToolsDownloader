/**
 * WARNING: This file should ONLY be accessed through ChurchToolsProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or ChurchToolsProvider instead.
 * 
 * ChurchTools OAuth 2.0 Implementation
 * Based on ChurchTools REST API documentation:
 * - Authorization: GET /oauth/authorize (standard OAuth 2.0 Authorization Code flow)
 * - Token: POST /oauth/token
 * - Public clients must use PKCE (S256)
 * 
 * Reference: https://churchtools.academy/en/help/system-settings/api-en/api-authentication
 */

import express from "express"
import { randomFillSync, createHash } from "crypto"

import { ToMain } from "../../../types/IPC/ToMain"
import { getContentProviderAccess, setContentProviderAccess } from "../../data/contentProviders"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { getKey } from "../../utils/keys"
import { httpsRequest } from "../../utils/requests"
import type { ChurchToolsOAuthConfig, ChurchToolsAuthData, ChurchToolsScopes } from "./types"

export const DEFAULT_CHURCHTOOLS_OAUTH_CONFIG: ChurchToolsOAuthConfig = {
  clientId: getKey("churchtools_id") || "",
  clientSecret: getKey("churchtools_secret") || "",
  redirectUri: "",
  authorizationUrl: "/oauth/authorize",
  tokenUrl: "/oauth/token"
}

const HTML_success = `
    <head>
        <title>Success!</title>
    </head>
    <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1 style="color: #f0008c;">Success!</h1>
        <p>You can close this page</p>
    </body>
`
const HTML_error = `
    <head>
        <title>Error!</title>
    </head>
    <body style="padding: 80px;background: #242832;color: #f0f0ff;font-family: system-ui;font-size: 1.2em;">
        <h1>Could not complete authentication!</h1>
        <p>{error_msg}</p>
    </body>
`

let CT_ACCESS: ChurchToolsAuthData | null = null

function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  randomFillSync(array)
  return Buffer.from(array).toString("base64url")
}

function generateCodeChallenge(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest()
  return Buffer.from(hash).toString("base64url")
}

function churchtoolsAuthenticate(
  baseUrl: string,
  scope: ChurchToolsScopes,
  oauthConfig: ChurchToolsOAuthConfig
): Promise<ChurchToolsAuthData | null> {
  const path = "/auth/complete"
  const port = 5503
  const redirect_uri = `http://localhost:${port}${path}`

  // Generate PKCE values (required for public clients)
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  const app = express()
  app.use(express.json())

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.info(`Listening for ChurchTools OAuth response at port ${port}`)
    })

    server.once("error", (err: Error) => {
      if ((err as any).code === "EADDRINUSE") server.close()
    })

    app.get(path, async (req, res) => {
      const code = req.query.code?.toString() || ""
      console.info(`OAuth code received: ${code}`)
      if (!code) {
        server.close()
        return resolve(null)
      }

      const params = {
        grant_type: "authorization_code",
        code,
        client_id: oauthConfig.clientId,
        redirect_uri,
        code_verifier: codeVerifier
      }

      httpsRequest(baseUrl, oauthConfig.tokenUrl || "/oauth/token", "POST", {}, params, (err, data: ChurchToolsAuthData) => {
        if (err) {
          res.setHeader("Content-Type", "text/html")
          const errorPage = HTML_error.replace("{error_msg}", err.message)
          res.send(errorPage)

          server.close()
          sendToMain(ToMain.ALERT, "Could not authorize! " + err.message)
          return resolve(null)
        }

        // AUTHORIZED
        console.info("ChurchTools OAuth completed!")

        res.setHeader("Content-Type", "text/html")
        res.send(HTML_success)

        // close when request is completed!
        server.close()

        if (data) {
          data.scope = scope
          setContentProviderAccess("churchtools", scope, data)
          CT_ACCESS = data
          connectionInitialized(true)
        }
        resolve(data)
      })
    })

    // ChurchTools uses standard OAuth 2.0 Authorization Code flow with GET /oauth/authorize
    const authUrl = `${baseUrl}${oauthConfig.authorizationUrl || "/oauth/authorize"}`
    const URL = `${authUrl}?client_id=${oauthConfig.clientId}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${scope}&code_challenge=${codeChallenge}&code_challenge_method=S256`

    // Open URL in browser for user to authenticate
    openURL(URL)
  })
}

function hasExpired(access: ChurchToolsAuthData | null): boolean {
  if (!access?.created_at || !access?.expires_in) return true

  const expirationTime = (access.created_at + access.expires_in) * 1000
  const currentTime = Date.now()

  return currentTime >= expirationTime
}

async function refreshChurchToolsToken(
  baseUrl: string,
  access: ChurchToolsAuthData,
  oauthConfig: ChurchToolsOAuthConfig
): Promise<ChurchToolsAuthData | null> {
  return new Promise((resolve) => {
    if (!access?.refresh_token) {
      console.warn("No refresh token available, cannot refresh ChurchTools OAuth token")
      return resolve(null)
    }

    console.info("refreshToken: Refreshing ChurchTools OAuth token")

    const params = {
      grant_type: "refresh_token",
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
      refresh_token: access.refresh_token
    }

    httpsRequest(baseUrl, oauthConfig.tokenUrl || "/oauth/token", "POST", {}, params, (err: any, data: ChurchToolsAuthData) => {
      if (err || data === null) {
        // If refresh fails, fallback to full authentication flow
        return handleRefreshFailure(baseUrl, access.scope, oauthConfig).then(resolve)
      }

      if (data) {
        data.scope = access.scope
        setContentProviderAccess("churchtools", data.scope, data)
      }

      return resolve(data)
    })
  })
}

async function handleRefreshFailure(
  baseUrl: string,
  scope: ChurchToolsScopes,
  oauthConfig: ChurchToolsOAuthConfig
): Promise<ChurchToolsAuthData | null> {
  try {
    const newData = await churchtoolsAuthenticate(baseUrl, scope, oauthConfig)
    return newData
  } catch (authErr: any) {
    sendToMain(ToMain.ALERT, "Could not refresh token! " + String(authErr?.message))
    return null
  }
}

export function churchtoolsInitialize(): void {
  CT_ACCESS = null
}

export async function churchtoolsConnect(
  baseUrl: string,
  scope: ChurchToolsScopes,
  oauthConfig: ChurchToolsOAuthConfig
): Promise<ChurchToolsAuthData | null> {
  let accessData = CT_ACCESS || getContentProviderAccess("churchtools", scope)

  if (hasExpired(accessData)) accessData = await refreshChurchToolsToken(baseUrl, accessData, oauthConfig)
  if (!accessData) accessData = await churchtoolsAuthenticate(baseUrl, scope, oauthConfig)
  if (!accessData) return null

  if (!CT_ACCESS) connectionInitialized()
  CT_ACCESS = accessData

  return accessData
}

export function churchtoolsDisconnect(scope: ChurchToolsScopes = "events"): void {
  setContentProviderAccess("churchtools", scope, null)
  CT_ACCESS = null
}

function connectionInitialized(isFirstConnection = false): void {
  sendToMain(ToMain.PROVIDER_CONNECT, { providerId: "churchtools", success: true, isFirstConnection })
}

export async function churchtoolsStartupLoad(
  _baseUrl: string,
  _scope: ChurchToolsScopes,
  _oauthConfig: ChurchToolsOAuthConfig
): Promise<void> {
  // Load services/events will be handled by the provider
}
/**
 * Lógica cruda de OAuth delegado contra Microsoft Entra ID (login.microsoftonline.com),
 * extraída para no repetirla a mano una tercera vez: hoy ya existía duplicada
 * en el flujo de Planner (cuenta de servicio compartida, ver
 * src/app/api/admin/planner/cloud-auth/**) y en el de OneDrive (backups). El
 * paso de GUARDADO del token no se unifica aquí a propósito — Planner/OneDrive
 * escriben una sola fila global en system_settings, mientras que Microsoft To
 * Do (por usuario) escribe una fila por usuario en oauth_accounts; es una
 * diferencia real, no una duplicación accidental.
 */
import type { OAuthCredentials } from '@/lib/oauth-config'

export interface MicrosoftTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type: string
}

export function buildMicrosoftAuthorizeUrl(params: {
  credentials: OAuthCredentials
  redirectUri: string
  scope: string
  state: string
}): string {
  const tenant = params.credentials.tenantId ?? 'common'
  const query = new URLSearchParams({
    client_id: params.credentials.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: params.scope,
    state: params.state,
  })
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${query}`
}

export async function exchangeMicrosoftCodeForTokens(params: {
  credentials: OAuthCredentials
  redirectUri: string
  code: string
  scope: string
}): Promise<MicrosoftTokenResponse> {
  const tenant = params.credentials.tenantId ?? 'common'
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.credentials.clientId,
      client_secret: params.credentials.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
      scope: params.scope,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Microsoft token error: ${err.error_description ?? err.error ?? res.status}`)
  }
  return res.json()
}

export async function refreshMicrosoftAccessToken(params: {
  credentials: OAuthCredentials
  refreshToken: string
  scope: string
}): Promise<MicrosoftTokenResponse> {
  const tenant = params.credentials.tenantId ?? 'common'
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: params.credentials.clientId,
      client_secret: params.credentials.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: 'refresh_token',
      scope: params.scope,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Microsoft token refresh error: ${err.error_description ?? err.error ?? res.status}`
    )
  }
  return res.json()
}

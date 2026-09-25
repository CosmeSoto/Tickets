/**
 * PersonalDriveGraphService — resuelve y refresca el access token del Drive
 * PERSONAL de cada usuario para adjuntos (no una cuenta de servicio
 * compartida, a diferencia de CloudStorageService.uploadToOneDrive). Mismo
 * patrón que MsTodoGraphService.getAccessToken: token cifrado por usuario en
 * oauth_accounts, mismo App Registration ('azure-ad') que login/OneDrive/
 * Planner/To Do — ver el comentario de OAuthProviderKey en oauth-config.ts.
 *
 * Las llamadas de Graph en sí (subir/descargar/borrar bytes) NO viven acá —
 * ya existen en CloudStorageService.uploadToPersonalDrive/downloadFrom.../
 * deleteFrom... (reusan las mismas primitivas *DriveLike que usa OneDrive
 * org-wide). Este servicio solo entrega el token correcto para pasarles.
 */
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { refreshMicrosoftAccessToken } from '@/lib/oauth/microsoft-authorize'

// User.Read para poder mostrar en /profile qué cuenta quedó conectada
// (getConnectedAccountEmail) — mismo motivo que MS_TODO_SCOPE.
export const PERSONAL_DRIVE_SCOPE =
  'https://graph.microsoft.com/Files.ReadWrite https://graph.microsoft.com/User.Read offline_access'
export const PERSONAL_DRIVE_PROVIDER = 'onedrive-personal'

export class PersonalDriveNotConnectedError extends Error {
  constructor() {
    super('Este usuario no tiene un Drive personal conectado.')
  }
}

export class PersonalDriveGraphService {
  /** Igual que MsTodoGraphService.getAccessToken — cachea el access token
   *  vigente (evita un refresh por cada subida/descarga/borrado) y rota el
   *  refresh token cifrado en oauth_accounts cuando hace falta. */
  static async getAccessToken(userId: string): Promise<string> {
    // providerId = el propio userId de la app: el índice único
    // [provider, providerId] ya garantiza un solo Drive personal por usuario.
    const account = await prisma.oauth_accounts.findUnique({
      where: { provider_providerId: { provider: PERSONAL_DRIVE_PROVIDER, providerId: userId } },
    })
    if (!account?.refreshToken) throw new PersonalDriveNotConnectedError()

    if (account.expiresAt && account.expiresAt.getTime() - Date.now() > 2 * 60 * 1000) {
      return decrypt(account.accessToken)
    }

    const creds = await getOAuthCredentials('azure-ad')
    if (!creds) {
      throw new Error(
        'La integración con Microsoft OAuth no está configurada por el administrador.'
      )
    }

    const data = await refreshMicrosoftAccessToken({
      credentials: creds,
      refreshToken: decrypt(account.refreshToken),
      scope: PERSONAL_DRIVE_SCOPE,
    })

    await prisma.oauth_accounts.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token ? encrypt(data.refresh_token) : account.refreshToken,
        scope: data.scope ?? account.scope,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        updatedAt: new Date(),
      },
    })

    return data.access_token
  }

  static async getConnectedAccountEmail(accessToken: string): Promise<string | null> {
    const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.mail ?? data.userPrincipalName ?? null
  }

  /** Guarda por primera vez el token de una cuenta recién conectada. */
  static async saveNewAccount(params: {
    userId: string
    accessToken: string
    refreshToken: string
    scope?: string | null
    expiresIn: number
  }): Promise<void> {
    await prisma.oauth_accounts.upsert({
      where: {
        provider_providerId: { provider: PERSONAL_DRIVE_PROVIDER, providerId: params.userId },
      },
      update: {
        accessToken: encrypt(params.accessToken),
        refreshToken: encrypt(params.refreshToken),
        scope: params.scope ?? null,
        expiresAt: new Date(Date.now() + params.expiresIn * 1000),
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        provider: PERSONAL_DRIVE_PROVIDER,
        providerId: params.userId,
        userId: params.userId,
        accessToken: encrypt(params.accessToken),
        refreshToken: encrypt(params.refreshToken),
        scope: params.scope ?? null,
        expiresAt: new Date(Date.now() + params.expiresIn * 1000),
        updatedAt: new Date(),
      },
    })
  }
}

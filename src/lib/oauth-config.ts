import prisma from './prisma'
import { decrypt } from './crypto'

export interface OAuthCredentials {
  clientId: string
  clientSecret: string
  tenantId?: string
  isEnabled: boolean
}

/**
 * 'azure-ad' es UN solo App Registration en Entra ID que cubre TODOS los
 * flujos delegados de Microsoft (el usuario autoriza vía popup/redirect),
 * para no pedir el mismo Client ID/Secret en varias pantallas:
 *   - Login ("iniciar sesión con Microsoft", NextAuth, /api/auth/callback/azure-ad)
 *   - OneDrive como destino de adjuntos y de backups (ver cloud-storage-service.ts,
 *     backup-cloud-service.ts) — cada uno con su propio callback aparte.
 *   - La cuenta de servicio compartida de Planner (Configuración de Tareas,
 *     conectada una vez por el Super Admin).
 *   - Microsoft To Do por usuario (cada usuario conecta su propia cuenta
 *     desde /profile) — token guardado en `oauth_accounts` (una fila por
 *     usuario), nunca en `system_settings`.
 * Planner y Microsoft To Do comparten además un único callback
 * (/api/planner/oauth-callback, ver oauth-shared.ts) — `state` es lo que
 * distingue uno del otro. Las demás rutas (login, adjuntos, backups) tienen
 * cada una su propio callback fijo, pero TODAS leen la misma fila
 * `oauth_configs` con provider='azure-ad' — solo ese Client ID/Secret se
 * configura, en Ajustes → OAuth, sin repetirlo en cada pantalla de función.
 *
 * 'azure-ad-sharepoint' usa credenciales de APLICACIÓN (client_credentials +
 * permiso Sites.Selected), un flujo sin usuario ni popup de consentimiento —
 * por eso, a diferencia de 'azure-ad', puede convenir una app de Azure
 * dedicada, distinta de la de login (least-privilege: no conviene que la
 * misma app con permisos de aplicación tenant-wide sea también la de login).
 * Pero también puede ser, a propósito, LA MISMA app: si el admin activa
 * `reuseAzureAdCredentials` en esta fila (checkbox en Ajustes → OAuth),
 * `getOAuthCredentials('azure-ad-sharepoint')` resuelve el Client ID/Secret
 * en vivo desde la fila 'azure-ad' en vez de pedirlos duplicados acá — el
 * Tenant ID de esta fila SIEMPRE es el propio (nunca el de 'azure-ad', que
 * puede ser "common"; SharePoint exige el GUID real). No hay `redirectUri`
 * real ni token de usuario que guardar — ver
 * `CloudStorageService.getSharePointAccessToken`.
 */
export type OAuthProviderKey = 'google' | 'azure-ad' | 'azure-ad-sharepoint'

/**
 * Obtiene las credenciales OAuth de un proveedor desde la base de datos
 */
export async function getOAuthCredentials(
  provider: OAuthProviderKey
): Promise<OAuthCredentials | null> {
  try {
    const config = await prisma.oauth_configs.findUnique({
      where: { provider },
    })

    if (!config || !config.isEnabled) {
      return null
    }

    if (provider === 'azure-ad-sharepoint' && config.reuseAzureAdCredentials) {
      const azureAd = await prisma.oauth_configs.findUnique({
        where: { provider: 'azure-ad' },
      })
      if (!azureAd?.clientId || !azureAd?.clientSecret) return null

      return {
        clientId: azureAd.clientId,
        clientSecret: decrypt(azureAd.clientSecret),
        // El Tenant ID es siempre el propio de esta fila, nunca el de
        // 'azure-ad' — ese puede ser "common", inválido para client_credentials.
        tenantId: config.tenantId || undefined,
        isEnabled: config.isEnabled,
      }
    }

    if (!config.clientId || !config.clientSecret) return null

    return {
      clientId: config.clientId,
      clientSecret: decrypt(config.clientSecret),
      tenantId: config.tenantId || undefined,
      isEnabled: config.isEnabled,
    }
  } catch (error) {
    console.error(`Error getting OAuth credentials for ${provider}:`, error)
    return null
  }
}

/**
 * Verifica si un proveedor OAuth está configurado y habilitado
 */
export async function isOAuthProviderEnabled(provider: OAuthProviderKey): Promise<boolean> {
  try {
    const config = await prisma.oauth_configs.findUnique({
      where: { provider },
      select: { isEnabled: true },
    })

    return config?.isEnabled ?? false
  } catch (error) {
    console.error(`Error checking OAuth provider ${provider}:`, error)
    return false
  }
}

/**
 * Obtiene todos los proveedores OAuth habilitados
 */
export async function getEnabledOAuthProviders(): Promise<string[]> {
  try {
    const configs = await prisma.oauth_configs.findMany({
      where: { isEnabled: true },
      select: { provider: true },
    })

    return configs.map(c => c.provider)
  } catch (error) {
    console.error('Error getting enabled OAuth providers:', error)
    return []
  }
}

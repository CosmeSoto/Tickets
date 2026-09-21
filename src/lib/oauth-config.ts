import prisma from './prisma'
import { decrypt } from './crypto'

export interface OAuthCredentials {
  clientId: string
  clientSecret: string
  tenantId?: string
  isEnabled: boolean
}

/**
 * 'azure-ad-planner', 'azure-ad-sharepoint' y 'azure-ad-todo' son filas
 * independientes de 'azure-ad' (login) — mismo App Registration en Entra ID
 * puede reusarse, pero cada permiso/alcance se administra (habilitar/revocar)
 * sin tocar el login de Microsoft ni entre sí.
 *
 * 'azure-ad-sharepoint' es distinto en un punto clave: usa credenciales de
 * APLICACIÓN (client_credentials + permiso Sites.Selected), no el flujo
 * delegado (usuario autoriza vía popup) que usan los otros tres. No hay
 * `redirectUri` real ni token de usuario que guardar — ver
 * `CloudStorageService.getSharePointAccessToken`.
 *
 * 'azure-ad-todo' es delegado como 'azure-ad-planner', pero NO es una cuenta
 * de servicio compartida: cada usuario consiente por su cuenta desde su
 * propio perfil (ver /api/planner/ms-todo/**) y su token se guarda en
 * oauth_accounts, una fila por usuario — no en system_settings.
 */
export type OAuthProviderKey =
  | 'google'
  | 'azure-ad'
  | 'azure-ad-planner'
  | 'azure-ad-sharepoint'
  | 'azure-ad-todo'

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

    // Desencriptar client secret
    const clientSecret = decrypt(config.clientSecret)

    return {
      clientId: config.clientId,
      clientSecret,
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

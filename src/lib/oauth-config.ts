import prisma from './prisma'
import { decrypt } from './crypto'

export interface OAuthCredentials {
  clientId: string
  clientSecret: string
  tenantId?: string
  isEnabled: boolean
}

/**
 * Obtiene las credenciales OAuth de un proveedor desde la base de datos
 */
export async function getOAuthCredentials(provider: 'google' | 'azure-ad'): Promise<OAuthCredentials | null> {
  try {
    const config = await prisma.oauth_configs.findUnique({
      where: { provider }
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
export async function isOAuthProviderEnabled(provider: 'google' | 'azure-ad'): Promise<boolean> {
  try {
    const config = await prisma.oauth_configs.findUnique({
      where: { provider },
      select: { isEnabled: true }
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
      select: { provider: true }
    })

    return configs.map(c => c.provider)
  } catch (error) {
    console.error('Error getting enabled OAuth providers:', error)
    return []
  }
}

import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import type { UserRole } from '@prisma/client'

import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

type Provider = NextAuthOptions['providers'][number]

type ResolvedCreds = {
  clientId: string
  clientSecret: string
  tenantId?: string
} | null

async function resolveOAuthCredentials(
  provider: 'google' | 'azure-ad'
): Promise<ResolvedCreds> {
  const row = await prisma.oauth_configs.findUnique({ where: { provider } })

  if (row) {
    if (!row.isEnabled || !row.clientId || !row.clientSecret) return null
    try {
      return {
        clientId: row.clientId,
        clientSecret: decrypt(row.clientSecret),
        tenantId: row.tenantId || undefined,
      }
    } catch (error) {
      console.error(`[AUTH] Error desencriptando secret OAuth (${provider}):`, error)
      return null
    }
  }

  // Fallback legacy: variables de entorno si aún no hay fila en BD
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (clientId && clientSecret) return { clientId, clientSecret }
  }

  if (provider === 'azure-ad') {
    const clientId = process.env.AZURE_AD_CLIENT_ID
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
    if (clientId && clientSecret) {
      return {
        clientId,
        clientSecret,
        tenantId: process.env.AZURE_AD_TENANT_ID || 'common',
      }
    }
  }

  return null
}

/**
 * Carga proveedores OAuth desde oauth_configs (Admin UI).
 * Fallback a variables de entorno solo si no existe fila en BD.
 */
export async function loadOAuthProvidersFromDb(): Promise<Provider[]> {
  const providers: Provider[] = []

  const google = await resolveOAuthCredentials('google')
  if (google) {
    providers.push(
      GoogleProvider({
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        authorization: {
          params: {
            prompt: 'consent',
            access_type: 'offline',
            response_type: 'code',
          },
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name,
            email: profile.email,
            image: profile.picture,
            role: 'CLIENT' as UserRole,
            emailVerified: profile.email_verified,
          }
        },
      })
    )
  }

  const azure = await resolveOAuthCredentials('azure-ad')
  if (azure) {
    providers.push(
      AzureADProvider({
        clientId: azure.clientId,
        clientSecret: azure.clientSecret,
        tenantId: azure.tenantId || 'common',
        authorization: {
          params: {
            scope: 'openid profile email User.Read',
          },
        },
        profile(profile) {
          return {
            id: profile.sub || profile.oid,
            name: profile.name,
            email: profile.email || profile.preferred_username,
            image: profile.picture,
            role: 'CLIENT' as UserRole,
            emailVerified: true,
          }
        },
      })
    )
  }

  return providers
}

let cachedProviders: Provider[] | null = null
let cacheExpiresAt = 0
const CACHE_MS = 60_000

export async function getCachedOAuthProviders(): Promise<Provider[]> {
  const now = Date.now()
  if (cachedProviders && now < cacheExpiresAt) {
    return cachedProviders
  }
  cachedProviders = await loadOAuthProvidersFromDb()
  cacheExpiresAt = now + CACHE_MS
  return cachedProviders
}

export function invalidateOAuthProvidersCache(): void {
  cachedProviders = null
  cacheExpiresAt = 0
}

/**
 * Branding dinámico del sistema (solo servidor — usa Prisma).
 *
 * Caché en 2 capas:
 * 1. Memoria del proceso (rápida, evita DB en cada generateMetadata)
 * 2. Redis (compartida entre instancias, si está disponible)
 */

import prisma from '@/lib/prisma'
import { getCached, setCache, deleteCache } from '@/lib/server'
import {
  DEFAULT_SYSTEM_NAME,
  DEFAULT_HERO_TITLE,
  DEFAULT_PAGE_TITLE,
} from '@/lib/branding-constants'

export {
  DEFAULT_SYSTEM_NAME,
  DEFAULT_HERO_TITLE,
  DEFAULT_PAGE_TITLE,
} from '@/lib/branding-constants'

const BRANDING_CACHE_KEY = 'system:branding'
/** Redis TTL — branding cambia poco */
const BRANDING_REDIS_TTL_SEC = 300
/** Caché en memoria del proceso — evita golpear DB/Redis en cada navegación */
const BRANDING_MEMORY_TTL_MS = 60_000

export interface SystemBranding {
  systemName: string
  heroTitle: string
  companyName: string
  pageTitle: string
  metaDescription: string
}

const DEFAULT_DESCRIPTION =
  'Sistema profesional de gestión multi-área: tickets, inventario, rondas y más'

const DEFAULT_BRANDING: SystemBranding = {
  systemName: DEFAULT_SYSTEM_NAME,
  heroTitle: DEFAULT_HERO_TITLE,
  companyName: DEFAULT_SYSTEM_NAME,
  pageTitle: DEFAULT_PAGE_TITLE,
  metaDescription: DEFAULT_DESCRIPTION,
}

type MemoryEntry = { data: SystemBranding; expiresAt: number }
let memoryCache: MemoryEntry | null = null
/** Evita thundering herd si varios generateMetadata coinciden en un miss */
let inflight: Promise<SystemBranding> | null = null

function readMemory(): SystemBranding | null {
  if (!memoryCache) return null
  if (Date.now() >= memoryCache.expiresAt) {
    memoryCache = null
    return null
  }
  return memoryCache.data
}

function writeMemory(data: SystemBranding) {
  memoryCache = { data, expiresAt: Date.now() + BRANDING_MEMORY_TTL_MS }
}

/**
 * Lee el branding completo del sistema.
 * Preferencia: systemName (settings) → companyName (landing) → default.
 */
export async function getSystemBranding(): Promise<SystemBranding> {
  const fromMemory = readMemory()
  if (fromMemory) return fromMemory

  if (inflight) return inflight

  inflight = (async () => {
    try {
      const fromRedis = await getCached<SystemBranding>(BRANDING_CACHE_KEY)
      if (fromRedis) {
        writeMemory(fromRedis)
        return fromRedis
      }

      const [systemNameSetting, landing] = await Promise.all([
        prisma.system_settings.findUnique({
          where: { key: 'systemName' },
          select: { value: true },
        }),
        // id es PK → findUnique (más barato que findFirst)
        prisma.landing_page_content.findUnique({
          where: { id: 'default' },
          select: { companyName: true, heroTitle: true, metaDescription: true },
        }),
      ])

      const systemName =
        systemNameSetting?.value?.trim() || landing?.companyName?.trim() || DEFAULT_SYSTEM_NAME

      const heroTitle = landing?.heroTitle?.trim() || DEFAULT_HERO_TITLE
      const companyName = landing?.companyName?.trim() || systemName

      const result: SystemBranding = {
        systemName,
        heroTitle,
        companyName,
        pageTitle: `${systemName} - ${heroTitle}`,
        metaDescription: landing?.metaDescription?.trim() || DEFAULT_DESCRIPTION,
      }

      writeMemory(result)
      await setCache(BRANDING_CACHE_KEY, result, BRANDING_REDIS_TTL_SEC)
      return result
    } catch {
      writeMemory(DEFAULT_BRANDING)
      return DEFAULT_BRANDING
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/**
 * Invalida caché de branding (memoria + Redis).
 * Llamar al guardar Configuración General o Página Pública.
 */
export async function invalidateBrandingCache(): Promise<void> {
  memoryCache = null
  inflight = null
  try {
    await deleteCache(BRANDING_CACHE_KEY)
  } catch {
    /* silencioso */
  }
}

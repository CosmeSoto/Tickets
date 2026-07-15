/**
 * Caché de branding accesible en cliente sin depender de React.
 * useLandingData() lo actualiza; getCachedBranding() lo lee en exports/print.
 */

import {
  DEFAULT_SYSTEM_NAME,
  DEFAULT_HERO_TITLE,
} from '@/lib/branding-constants'

let cachedSystemName: string | null = null
let cachedHeroTitle: string | null = null

export function setCachedBranding(partial: {
  systemName?: string | null
  heroTitle?: string | null
}) {
  if (partial.systemName != null && partial.systemName.trim()) {
    cachedSystemName = partial.systemName.trim()
  }
  if (partial.heroTitle != null && partial.heroTitle.trim()) {
    cachedHeroTitle = partial.heroTitle.trim()
  }
}

export function clearCachedBranding() {
  cachedSystemName = null
  cachedHeroTitle = null
}

/** Lectura síncrona — usa defaults del seeder si aún no hay caché. */
export function getCachedBranding(): { systemName: string; heroTitle: string } {
  return {
    systemName: cachedSystemName || DEFAULT_SYSTEM_NAME,
    heroTitle: cachedHeroTitle || DEFAULT_HERO_TITLE,
  }
}

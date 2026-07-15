/**
 * Constantes de branding (seguras para cliente y servidor).
 * Deben coincidir con prisma/seed.ts.
 *
 * Fuentes de verdad en BD:
 * - systemName / companyName → "Nombre del sistema" (Configuración General)
 * - heroTitle → "Título principal" (Página Pública)
 */

/** Coincide con seed: system_settings / landing companyName */
export const DEFAULT_SYSTEM_NAME = 'Gestión Operaciones'

/** Coincide con seed: landing_page_content.heroTitle */
export const DEFAULT_HERO_TITLE = 'Soporte Multi-Área'

export const DEFAULT_PAGE_TITLE = `${DEFAULT_SYSTEM_NAME} - ${DEFAULT_HERO_TITLE}`

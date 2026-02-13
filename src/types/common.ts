/**
 * Tipos comunes para el sistema de estandarización de UI
 * Re-exporta tipos consolidados desde views.ts y hooks
 * Fase 11.1.3 - Consolidación de tipos
 */

// Re-exportar tipos de hooks desde el index centralizado
export type { ViewMode, FilterConfig } from '@/hooks/common'

// Re-exportar todos los tipos consolidados desde views.ts
export * from './views'

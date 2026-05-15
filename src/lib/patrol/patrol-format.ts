/**
 * Utilidades de formateo del módulo de rondas.
 * Este archivo es CLIENT-SAFE — no importa prisma, ioredis, ni módulos de Node.
 * Puede usarse en componentes 'use client' sin problemas.
 */

/**
 * Convierte minutos a etiqueta legible: "1h 30min", "45min", "2h".
 * Retorna `fallback` si `minutes` es 0 o negativo.
 *
 * @example
 * formatDurationMinutes(90)   // "1h 30min"
 * formatDurationMinutes(60)   // "1h"
 * formatDurationMinutes(45)   // "45min"
 * formatDurationMinutes(0)    // "—"
 */
export function formatDurationMinutes(minutes: number, fallback = '—'): string {
  if (!minutes || minutes <= 0) return fallback
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

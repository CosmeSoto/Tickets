/**
 * Helpers del módulo de rondas (SERVER-ONLY).
 *
 * Este archivo importa prisma — NO puede usarse en Client Components.
 * Para funciones client-safe (formateo), usar @/lib/patrol/patrol-format.
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Re-exportar formatDurationMinutes para que los API routes puedan usarlo desde aquí
export { formatDurationMinutes } from './patrol-format'

// ── Supervisores de familia ───────────────────────────────────────────────────

/**
 * Devuelve los IDs de supervisores (ADMIN con familia asignada + TECHNICIAN con patrolsEnabled)
 * asignados a una familia específica.
 *
 * ADMIN: no requiere patrolsEnabled — si tiene la familia asignada, es supervisor.
 * TECHNICIAN: requiere patrolsEnabled + familia asignada.
 *
 * Usado en notificaciones de check-in rechazado, ronda incompleta, novedad creada, etc.
 */
export async function getPatrolSupervisors(familyId: string): Promise<{ id: string }[]> {
  const [admins, technicians] = await Promise.all([
    // Admins: solo necesitan tener la familia asignada (o ser super admin)
    prisma.users.findMany({
      where: {
        isActive: true,
        role: 'ADMIN',
        OR: [
          { isSuperAdmin: true },
          { adminFamilyAssignments: { some: { familyId, isActive: true } } },
          { departments: { familyId } },
        ],
      },
      select: { id: true },
    }),
    // Técnicos: necesitan patrolsEnabled + familia asignada
    prisma.users.findMany({
      where: {
        isActive: true,
        role: 'TECHNICIAN',
        patrolsEnabled: true,
        technicianFamilyAssignments: { some: { familyId, isActive: true } },
      },
      select: { id: true },
    }),
  ])

  // Deduplicar
  const ids = new Set<string>()
  const result: { id: string }[] = []
  for (const u of [...admins, ...technicians]) {
    if (!ids.has(u.id)) {
      ids.add(u.id)
      result.push(u)
    }
  }
  return result
}

// ── Verificación de acceso al módulo ─────────────────────────────────────────

/**
 * Verifica si un TECHNICIAN tiene el módulo de patrullas habilitado.
 * Para ADMIN siempre retorna true.
 *
 * @returns true si puede acceder, false si no.
 */
export async function hasPatrolModuleAccess(userId: string, role: string): Promise<boolean> {
  if (role === 'ADMIN') return true
  if (role !== 'TECHNICIAN') return false

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { patrolsEnabled: true },
  })
  return user?.patrolsEnabled === true
}

/**
 * Verifica acceso al módulo y devuelve una respuesta 403 lista si no tiene acceso.
 * Retorna `null` si el acceso está permitido (continuar con la lógica normal).
 *
 * Uso típico en API routes:
 * ```ts
 * const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
 * if (denied) return denied
 * ```
 */
export async function checkPatrolModuleAccess(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null
  if (role !== 'TECHNICIAN') return patrolForbidden()

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { patrolsEnabled: true },
  })
  if (!user?.patrolsEnabled) return patrolModuleDisabled()
  return null
}

// ── Respuestas de error estándar ──────────────────────────────────────────────

/** 401 — No autenticado */
export const patrolUnauthorized = () =>
  NextResponse.json({ error: 'No autenticado' }, { status: 401 })

/** 403 — No autorizado (rol insuficiente) */
export const patrolForbidden = (msg = 'No autorizado') =>
  NextResponse.json({ error: msg }, { status: 403 })

/** 403 — Módulo no habilitado */
export const patrolModuleDisabled = () =>
  NextResponse.json({ error: 'Módulo de patrullas no habilitado' }, { status: 403 })

/** 404 — Recurso no encontrado */
export const patrolNotFound = (resource = 'Recurso') =>
  NextResponse.json({ error: `${resource} no encontrado` }, { status: 404 })

/** 409 — Conflicto de estado */
export const patrolConflict = (msg: string) => NextResponse.json({ error: msg }, { status: 409 })

/** 422 — Datos inválidos */
export const patrolUnprocessable = (msg: string, code?: string) =>
  NextResponse.json({ error: msg, ...(code ? { code } : {}) }, { status: 422 })

/** 500 — Error interno */
export const patrolInternalError = () =>
  NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })

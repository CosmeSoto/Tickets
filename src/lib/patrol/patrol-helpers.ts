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
 * ADMIN: super admin + admin cuya familia nativa coincide (no admins con asignación adicional).
 * TECHNICIAN: requiere patrolsEnabled + familia asignada.
 *
 * Usado en notificaciones de check-in rechazado, ronda incompleta, novedad creada, etc.
 */
export async function getPatrolSupervisors(familyId: string): Promise<{ id: string }[]> {
  const [admins, agents] = await Promise.all([
    // Admins: super admin + admin nativo de la familia de la ronda
    prisma.users.findMany({
      where: {
        isActive: true,
        role: 'ADMIN',
        OR: [
          { isSuperAdmin: true },
          {
            patrolsEnabled: true,
            departments: { familyId, isActive: true },
          },
        ],
      },
      select: { id: true },
    }),
    // Agentes/supervisores: TECH o CLIENT con patrolsEnabled + grants patrols
    prisma.users.findMany({
      where: {
        isActive: true,
        role: { in: ['TECHNICIAN', 'CLIENT'] },
        patrolsEnabled: true,
        OR: [
          { departments: { familyId, isActive: true } },
          {
            userFamilyAccess: {
              some: { familyId, module: 'patrols', isActive: true },
            },
          },
        ],
      },
      select: { id: true },
    }),
  ])

  const ids = new Set<string>()
  const result: { id: string }[] = []
  for (const u of [...admins, ...agents]) {
    if (!ids.has(u.id)) {
      ids.add(u.id)
      result.push(u)
    }
  }
  return result
}

// ── Verificación de acceso al módulo ─────────────────────────────────────────

/**
 * Acceso de supervisión/configuración del módulo (dashboard, schedules, routes, reports).
 * Super Admin / ADMIN con patrolsEnabled; TECHNICIAN con patrolsEnabled.
 * CLIENT nunca: ejecutan rondas en APIs de agente.
 */
export async function hasPatrolModuleAccess(userId: string, role: string): Promise<boolean> {
  if (role !== 'ADMIN' && role !== 'TECHNICIAN') return false

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { patrolsEnabled: true, isSuperAdmin: true },
  })
  if (!user) return false
  if (user.isSuperAdmin) return true
  return user.patrolsEnabled === true
}

/**
 * Gate de supervisión/configuración. Retorna 403 listo o `null` si puede continuar.
 */
export async function checkPatrolModuleAccess(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role !== 'ADMIN' && role !== 'TECHNICIAN') return patrolForbidden()

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { patrolsEnabled: true, isSuperAdmin: true },
  })
  if (!user) return patrolForbidden()
  if (user.isSuperAdmin) return null
  if (!user.patrolsEnabled) return patrolModuleDisabled()
  return null
}

/**
 * Acceso de agente (ejecutar rondas asignadas).
 * Super Admin / ADMIN con módulo ON pueden monitorear; TECH/CLIENT requieren patrolsEnabled.
 */
export async function checkPatrolAgentAccess(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role !== 'ADMIN' && role !== 'TECHNICIAN' && role !== 'CLIENT') return patrolForbidden()

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { patrolsEnabled: true, isSuperAdmin: true },
  })
  if (!user) return patrolForbidden()
  if (user.isSuperAdmin) return null
  if (!user.patrolsEnabled) return patrolModuleDisabled()
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

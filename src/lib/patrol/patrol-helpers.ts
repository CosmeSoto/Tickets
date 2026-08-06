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
        OR: [{ isSuperAdmin: true }, { departments: { familyId, isActive: true } }],
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
 * ADMIN siempre; TECHNICIAN solo con patrolsEnabled.
 * CLIENT nunca: los clientes ejecutan rondas en /api/patrols (agente), no en APIs de config.
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
 * Gate de supervisión/configuración. Retorna 403 listo o `null` si puede continuar.
 * No usar en rutas de agente (listar/iniciar/check-in); ahí usar checkPatrolAgentAccess.
 *
 * Uso típico:
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

/**
 * Acceso de agente (ejecutar rondas asignadas).
 * ADMIN puede monitorear; TECHNICIAN/CLIENT requieren patrolsEnabled.
 */
export async function checkPatrolAgentAccess(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null
  if (role !== 'TECHNICIAN' && role !== 'CLIENT') return patrolForbidden()

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

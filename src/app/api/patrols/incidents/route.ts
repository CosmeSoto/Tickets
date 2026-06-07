/**
 * GET  /api/patrols/incidents — Lista novedades de patrol_incidents
 *   - Agente (TECHNICIAN/CLIENT): solo sus propias novedades
 *   - Admin: todas con filtros (family scope)
 *
 * POST /api/patrols/incidents — Crea una novedad durante ejecución de ronda
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { PatrolIncidentService } from '@/lib/services/patrol-incident.service'
import { getPatrolAccessibleFamilyIds } from '@/lib/patrol/patrol-access'

// ── Esquema de validación POST ────────────────────────────────────────────────

const createIncidentSchema = z.object({
  patrolId: z.string().uuid('patrolId debe ser un UUID válido'),
  checkpointId: z.string().uuid('checkpointId debe ser un UUID válido'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    errorMap: () => ({ message: 'Severidad debe ser LOW, MEDIUM, HIGH o CRITICAL' }),
  }),
  photoBase64: z.string().optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const familyId = searchParams.get('familyId') ?? undefined
    const severity = searchParams.get('severity') ?? undefined
    const status = searchParams.get('status') ?? undefined
    const dateFrom = searchParams.get('dateFrom') ?? undefined
    const dateTo = searchParams.get('dateTo') ?? undefined
    const patrolId = searchParams.get('patrolId') ?? undefined
    const agentIdParam = searchParams.get('agentId') ?? undefined

    const userRole = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    // Determinar modo: agente vs admin
    const isAdminMode = userRole === 'ADMIN' || (userRole === 'TECHNICIAN' && await hasPatrolSupervisorAccess(session.user.id))

    let filters: any = {
      page,
      limit,
      severity,
      status,
      patrolId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    }

    if (isAdminMode) {
      // Admin: filtrar por familia accesible (scope)
      const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
        session.user.id,
        userRole,
        isSuperAdmin
      )

      // Si se solicita un familyId específico, verificar que está en el scope
      if (familyId) {
        if (accessibleFamilyIds !== undefined && !accessibleFamilyIds.includes(familyId)) {
          return NextResponse.json({ error: 'No autorizado para esta familia' }, { status: 403 })
        }
        filters.familyId = familyId
      } else if (accessibleFamilyIds !== undefined) {
        // Filtrar por todas las familias accesibles
        filters.familyId = accessibleFamilyIds.length === 1
          ? accessibleFamilyIds[0]
          : undefined // Se manejará abajo

        // Si tiene múltiples familias y no se especifica una, no filtrar por familia
        // (PatrolIncidentService.list filtrará por familyId si se pasa)
        if (accessibleFamilyIds.length === 0) {
          return NextResponse.json({
            success: true,
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          })
        }
      }
      // SuperAdmin (accessibleFamilyIds === undefined): sin restricción de familia

      // Filtro explícito de agente para admin
      if (agentIdParam) {
        filters.agentId = agentIdParam
      }
    } else {
      // Modo agente: solo sus propias novedades
      filters.agentId = session.user.id
    }

    const result = await PatrolIncidentService.list(filters)

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    })
  } catch (error) {
    console.error('[patrols/incidents] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = createIncidentSchema.parse(body)

    const incident = await PatrolIncidentService.create({
      ...validated,
      agentId: session.user.id,
    })

    return NextResponse.json({ success: true, data: incident }, { status: 201 })
  } catch (error) {
    console.error('[patrols/incidents] POST:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    // Errores de negocio del servicio
    if (error instanceof Error) {
      const message = error.message

      if (message === 'Patrulla no encontrada') {
        return NextResponse.json({ error: message }, { status: 404 })
      }
      if (message === 'La patrulla no está en progreso') {
        return NextResponse.json({ error: message }, { status: 409 })
      }
      if (message.includes('No autorizado') || message.includes('no es el agente')) {
        return NextResponse.json({ error: message }, { status: 403 })
      }
      if (message.includes('no pertenece a la ruta')) {
        return NextResponse.json({ error: message }, { status: 422 })
      }
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Verifica si un TECHNICIAN tiene acceso como supervisor de patrullas
 * (tiene asignaciones de familia para el módulo de patrullas).
 */
async function hasPatrolSupervisorAccess(userId: string): Promise<boolean> {
  const { default: prisma } = await import('@/lib/prisma')
  const count = await prisma.patrol_family_assignments.count({
    where: { userId, isActive: true },
  })
  return count > 0
}

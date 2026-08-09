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
import { hasPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'

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

    // Determinar modo: agente vs admin/supervisor (TECH con módulo habilitado)
    const isAdminMode =
      userRole === 'ADMIN' ||
      (userRole === 'TECHNICIAN' && (await hasPatrolModuleAccess(session.user.id, userRole)))

    const filters: any = {
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

      if (familyId) {
        if (accessibleFamilyIds !== undefined && !accessibleFamilyIds.includes(familyId)) {
          return NextResponse.json({ error: 'No autorizado para esta familia' }, { status: 403 })
        }
        filters.familyId = familyId
      } else if (accessibleFamilyIds !== undefined) {
        if (accessibleFamilyIds.length === 0) {
          return NextResponse.json({
            success: true,
            data: [],
            pagination: { page, limit, total: 0, totalPages: 0 },
          })
        }
        filters.familyIds = accessibleFamilyIds
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

    // Enriquecer con isEditable: el agente puede editar/eliminar dentro de la ventana de gracia
    let enrichedData = result.data
    if (!isAdminMode && result.data.length > 0) {
      // Solo para modo agente — verificar ventana de edición de cada novedad
      const { default: prisma } = await import('@/lib/prisma')
      const familyIds = [
        ...new Set(result.data.map((d: any) => d.patrol?.familyId).filter(Boolean)),
      ]

      // Cargar gracePeriodMinutes de cada familia involucrada
      const familyConfigs =
        familyIds.length > 0
          ? await prisma.patrol_family_config.findMany({
              where: { familyId: { in: familyIds as string[] } },
              select: { familyId: true, gracePeriodMinutes: true },
            })
          : []
      const graceMap = new Map(familyConfigs.map(c => [c.familyId, c.gracePeriodMinutes ?? 5]))

      enrichedData = result.data.map((incident: any) => {
        const familyId = incident.patrol?.familyId
        const gracePeriodMs = (graceMap.get(familyId) ?? 5) * 60 * 1000
        const elapsed = Date.now() - new Date(incident.createdAt).getTime()
        const isEditable = incident.agentId === session.user.id && elapsed <= gracePeriodMs
        return { ...incident, isEditable }
      })
    }

    return NextResponse.json({
      success: true,
      data: enrichedData,
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
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
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

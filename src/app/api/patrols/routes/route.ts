/**
 * GET  /api/patrols/routes?familyId=  — Lista rutas de una familia
 * POST /api/patrols/routes             — Crea una ruta con checkpoints ordenados
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { randomUUID } from 'crypto'

const createRouteSchema = z.object({
  familyId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  estimatedDurationMinutes: z.number().int().min(1).max(1440),
  checkpoints: z
    .array(
      z.object({
        checkpointId: z.string().uuid(),
        order: z.number().int().min(1),
        isRequired: z.boolean().default(true),
      })
    )
    .min(1, 'La ruta debe tener al menos un checkpoint'),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')
    const search = searchParams.get('search') ?? ''
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where = {
      ...(familyId ? { familyId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    }

    const [routes, total] = await Promise.all([
      prisma.patrol_routes.findMany({
        where,
        select: {
          id: true,
          familyId: true,
          family: { select: { id: true, name: true } },
          name: true,
          description: true,
          estimatedDurationMinutes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { routeCheckpoints: true } },
          routeCheckpoints: {
            select: {
              order: true,
              isRequired: true,
              checkpoint: {
                select: { id: true, name: true, location: true, isActive: true, qrType: true },
              },
            },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patrol_routes.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: routes,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('[patrol/routes] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (session.user.role === 'TECHNICIAN') {
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { patrolsEnabled: true },
      })
      if (!user?.patrolsEnabled) {
        return NextResponse.json({ error: 'Módulo de patrullas no habilitado' }, { status: 403 })
      }
    }

    const body = await request.json()
    const data = createRouteSchema.parse(body)

    // Validar que todos los checkpoints existen y están activos
    const checkpointIds = data.checkpoints.map(c => c.checkpointId)
    const existingCheckpoints = await prisma.patrol_checkpoints.findMany({
      where: { id: { in: checkpointIds }, familyId: data.familyId },
      select: { id: true, isActive: true, name: true },
    })

    if (existingCheckpoints.length !== checkpointIds.length) {
      return NextResponse.json(
        { error: 'Uno o más checkpoints no existen o no pertenecen a esta familia' },
        { status: 422 }
      )
    }

    const inactiveCheckpoints = existingCheckpoints.filter(c => !c.isActive)
    // Advertencia pero no bloqueo — se puede crear con checkpoints inactivos (warning en UI)

    const route = await prisma.$transaction(async tx => {
      const newRoute = await tx.patrol_routes.create({
        data: {
          id: randomUUID(),
          familyId: data.familyId,
          name: data.name,
          description: data.description,
          estimatedDurationMinutes: data.estimatedDurationMinutes,
        },
      })

      await tx.patrol_route_checkpoints.createMany({
        data: data.checkpoints.map(c => ({
          id: randomUUID(),
          routeId: newRoute.id,
          checkpointId: c.checkpointId,
          order: c.order,
          isRequired: c.isRequired,
        })),
      })

      return newRoute
    })

    await AuditServiceComplete.log({
      action: 'PATROL_ROUTE_CREATED',
      entityType: 'patrol',
      entityId: route.id,
      userId: session.user.id,
      newValues: {
        name: route.name,
        familyId: route.familyId,
        checkpointCount: data.checkpoints.length,
      },
      request,
    })

    return NextResponse.json(
      {
        success: true,
        data: { id: route.id, name: route.name },
        warnings:
          inactiveCheckpoints.length > 0
            ? [`${inactiveCheckpoints.length} checkpoint(s) inactivo(s) en la ruta`]
            : [],
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[patrol/routes] POST:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

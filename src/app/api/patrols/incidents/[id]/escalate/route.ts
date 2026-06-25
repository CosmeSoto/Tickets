/**
 * POST /api/patrols/incidents/[id]/escalate — Escala novedad a ticket
 * GET  /api/patrols/incidents/[id]/escalate — Devuelve las familias disponibles
 *      para que el cliente muestre el selector de familia destino.
 *
 * Lógica de familias por rol:
 *   - TECHNICIAN/supervisor : sin selector — siempre hereda la familia de la ronda
 *   - Admin normal          : puede elegir entre sus admin_family_assignments + nativa
 *   - Super admin           : puede elegir entre TODAS las familias activas del sistema
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PatrolIncidentService } from '@/lib/services/patrol-incident.service'
import { checkPatrolFamilyAccess, checkPatrolFamilyOperate } from '@/lib/patrol/patrol-access'

// Acceso al modelo patrol_incidents hasta regenerar el Prisma Client
const db = prisma as any

// ── GET: familias disponibles para el selector ──────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const sessionUser = session.user as any
    const isSuperAdmin: boolean = sessionUser.isSuperAdmin ?? false

    // Obtener el incidente para saber la familia de origen
    const incident = await db.patrol_incidents.findUnique({
      where: { id },
      include: {
        patrol: {
          select: {
            familyId: true,
            family: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!incident) {
      return NextResponse.json({ error: 'Novedad no encontrada' }, { status: 404 })
    }

    // Verificar acceso a la familia de la patrulla
    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      incident.patrol.familyId,
      session.user.role,
      isSuperAdmin
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const originFamily = {
      id: incident.patrol.family.id,
      name: incident.patrol.family.name,
    }

    // TECHNICIAN: no tiene selector — devuelve solo la familia de origen
    if (session.user.role === 'TECHNICIAN') {
      return NextResponse.json({
        data: {
          canSelectFamily: false,
          families: [originFamily],
          defaultFamilyId: originFamily.id,
        },
      })
    }

    // Super admin: todas las familias activas del sistema
    if (isSuperAdmin) {
      const allFamilies = await prisma.families.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json({
        data: {
          canSelectFamily: true,
          families: allFamilies,
          defaultFamilyId: originFamily.id,
        },
      })
    }

    // Admin normal: sus familias en admin_family_assignments + nativa
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: session.user.id, isActive: true },
      select: { family: { select: { id: true, name: true } } },
    })

    const assignedFamilies = assignments.map((a: any) => a.family)

    // Asegurar que la familia nativa (de origen) siempre esté en la lista
    const allIds = new Set(assignedFamilies.map((f: any) => f.id))
    if (!allIds.has(originFamily.id)) {
      assignedFamilies.unshift(originFamily)
    }

    // Ordenar alfabéticamente
    assignedFamilies.sort((a: any, b: any) => a.name.localeCompare(b.name))

    const canSelectFamily = assignedFamilies.length > 1

    return NextResponse.json({
      data: {
        canSelectFamily,
        families: assignedFamilies,
        defaultFamilyId: originFamily.id,
      },
    })
  } catch (error: any) {
    console.error('[patrols/incidents/[id]/escalate] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── POST: ejecutar escalado ─────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo ADMIN o TECHNICIAN pueden escalar
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const sessionUser = session.user as any
    const isSuperAdmin: boolean = sessionUser.isSuperAdmin ?? false

    // Body opcional: { familyId?: string }
    let requestedFamilyId: string | undefined
    try {
      const body = await request.json()
      if (body?.familyId && typeof body.familyId === 'string') {
        requestedFamilyId = body.familyId
      }
    } catch {
      // Body vacío — comportamiento original: hereda familia de la ronda
    }

    // Obtener el incidente para verificar acceso a la familia
    const incident = await db.patrol_incidents.findUnique({
      where: { id },
      include: { patrol: { select: { familyId: true } } },
    })

    if (!incident) {
      return NextResponse.json({ error: 'Novedad no encontrada' }, { status: 404 })
    }

    // Verificar acceso a la familia de la patrulla (origen)
    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      incident.patrol.familyId,
      session.user.role,
      isSuperAdmin
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Validar familia destino si fue especificada
    if (requestedFamilyId && requestedFamilyId !== incident.patrol.familyId) {
      // TECHNICIAN: no puede cambiar la familia destino
      if (session.user.role === 'TECHNICIAN') {
        return NextResponse.json(
          { error: 'Los supervisores no pueden redirigir el ticket a otra familia' },
          { status: 403 }
        )
      }

      if (!isSuperAdmin) {
        // Admin normal: verificar que la familia destino esté en su scope
        const assignment = await prisma.admin_family_assignments.findFirst({
          where: {
            adminId: session.user.id,
            familyId: requestedFamilyId,
            isActive: true,
          },
        })

        // También aceptar la familia nativa
        const user = await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { departments: { select: { familyId: true } } },
        })
        const nativeFamilyId = user?.departments?.familyId

        if (!assignment && nativeFamilyId !== requestedFamilyId) {
          return NextResponse.json(
            { error: 'No tienes acceso a la familia destino seleccionada' },
            { status: 403 }
          )
        }
      } else {
        // Super admin: verificar que la familia exista y esté activa
        const targetFamily = await prisma.families.findUnique({
          where: { id: requestedFamilyId },
          select: { id: true, isActive: true },
        })

        if (!targetFamily || !targetFamily.isActive) {
          return NextResponse.json(
            { error: 'La familia destino no existe o está inactiva' },
            { status: 404 }
          )
        }
      }
    }

    // Escalar la novedad a ticket con la familia destino (o la de origen si no se especificó)
    const result = await PatrolIncidentService.escalateToTicket(
      id,
      session.user.id,
      requestedFamilyId
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    console.error('[patrols/incidents/[id]/escalate] POST:', error)

    const message = error?.message ?? ''

    if (message === 'Novedad no encontrada') {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    if (message === 'La novedad ya fue resuelta o escalada') {
      return NextResponse.json({ error: message }, { status: 409 })
    }

    if (message === 'No hay categorías configuradas para escalar la novedad') {
      return NextResponse.json({ error: message }, { status: 422 })
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

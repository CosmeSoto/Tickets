import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssignmentService } from '@/lib/services/assignment.service'
import {
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { hasAccessToEquipment } from '@/lib/middleware/family-filter'
import { UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/inventory/assignments/[id]
 * Devuelve un equipo — cierra la asignación activa y lo regresa a bodega (AVAILABLE)
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permisos para devolver equipos' },
        { status: 403 }
      )
    }

    const { id } = await params

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'ASSIGNMENT', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const assignmentRecord = await prisma.equipment_assignments.findUnique({
      where: { id },
      include: { deliveryAct: { select: { id: true, status: true } } },
    })
    if (!assignmentRecord) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }
    if (assignmentRecord.deliveryAct) {
      if (assignmentRecord.deliveryAct.status !== 'ACCEPTED') {
        return NextResponse.json(
          {
            error:
              'El acta de entrega aún no está aceptada. Espera la firma antes de registrar la devolución.',
          },
          { status: 422 }
        )
      }
      return NextResponse.json(
        {
          error:
            'Esta asignación requiere acta de devolución. Usa el flujo formal de devolución desde el detalle del equipo.',
        },
        { status: 422 }
      )
    }

    const body = await request.json()
    const { returnDate, observations, condition } = body

    if (!returnDate) {
      return NextResponse.json({ error: 'La fecha de devolución es requerida' }, { status: 400 })
    }

    const assignment = await AssignmentService.returnEquipment(
      id,
      new Date(returnDate),
      session.user.id,
      observations,
      condition
    )

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error en PATCH /api/inventory/assignments/[id]:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al devolver equipo' }, { status: 500 })
  }
}

/**
 * GET /api/inventory/assignments/[id]
 * Obtiene detalles de una asignación
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const assignment = await AssignmentService.getAssignmentDetail(id)

    if (!assignment) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    const isInvolved =
      assignment.assignment.receiverId === session.user.id ||
      assignment.assignment.delivererId === session.user.id

    if (session.user.role === 'CLIENT') {
      if (!isInvolved) {
        return NextResponse.json(
          { error: 'No tienes permisos para ver esta asignación' },
          { status: 403 }
        )
      }
      return NextResponse.json(assignment)
    }

    const equipmentId = assignment.assignment.equipmentId
    const user = toInventoryAccessUser(session.user)
    try {
      if (session.user.role === 'TECHNICIAN' || session.user.role === 'ADMIN') {
        const hasEq = await hasAccessToEquipment(
          user.id,
          user.role as UserRole,
          user.isSuperAdmin,
          equipmentId
        )
        if (!hasEq) {
          await assertInventoryResourceRead(user, 'ASSIGNMENT', id)
        }
      } else {
        await assertInventoryResourceRead(user, 'ASSIGNMENT', id)
      }
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error en GET /api/inventory/assignments/[id]:', error)
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener asignación' }, { status: 500 })
  }
}

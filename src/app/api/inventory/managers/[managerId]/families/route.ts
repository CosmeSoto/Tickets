import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationEvents } from '@/lib/notification-events'

/**
 * GET /api/inventory/managers/[managerId]/families
 * Retorna las familias asignadas al gestor.
 * Solo ADMIN.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ managerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo el administrador puede gestionar familias de inventario' },
        { status: 403 }
      )
    }

    const { managerId } = await params

    const assignments = await prisma.inventory_manager_families.findMany({
      where: { managerId },
      include: { family: true },
    })

    const families = assignments.map((a) => a.family)

    return NextResponse.json({ families })
  } catch {
    return NextResponse.json(
      { error: 'Error al obtener familias del gestor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/managers/[managerId]/families
 * Reemplaza el conjunto completo de familias asignadas al gestor.
 * Solo ADMIN.
 * Body: { familyIds: string[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ managerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo el administrador puede gestionar familias de inventario' },
        { status: 403 }
      )
    }

    const { managerId } = await params
    const body = await request.json()
    const { familyIds } = body as { familyIds: string[] }

    if (!Array.isArray(familyIds)) {
      return NextResponse.json(
        { error: 'familyIds debe ser un arreglo' },
        { status: 400 }
      )
    }

    // Validar que todos los familyIds existan
    if (familyIds.length > 0) {
      const existingFamilies = await prisma.families.findMany({
        where: { id: { in: familyIds } },
        select: { id: true },
      })

      if (existingFamilies.length !== familyIds.length) {
        return NextResponse.json(
          { error: 'La familia especificada no existe' },
          { status: 400 }
        )
      }
    }

    // Operación atómica: delete + createMany
    await prisma.$transaction(async (tx) => {
      await tx.inventory_manager_families.deleteMany({
        where: { managerId },
      })

      if (familyIds.length > 0) {
        await tx.inventory_manager_families.createMany({
          data: familyIds.map((familyId) => ({
            id: randomUUID(),
            managerId,
            familyId,
          })),
        })
      }
    })

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'UPDATE',
        entityType: 'manager_families',
        entityId: managerId,
        userId: session.user.id,
        details: { familyIds },
        createdAt: new Date(),
      },
    })

    // Retornar las familias asignadas con datos completos
    const assignments = await prisma.inventory_manager_families.findMany({
      where: { managerId },
      include: { family: true },
    })

    const families = assignments.map((a) => a.family)

    // Notificar al gestor para que refresque su sesión
    NotificationEvents.emit(managerId, { type: 'session_refresh', reason: 'permissions_changed' })

    return NextResponse.json({ families })
  } catch {
    return NextResponse.json(
      { error: 'Error al actualizar familias del gestor' },
      { status: 500 }
    )
  }
}

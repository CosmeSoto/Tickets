import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationEvents } from '@/lib/notification-events'
import { invalidateCache } from '@/lib/api-cache'
import { getUserModuleFamilyGrantIds, setUserModuleFamilies } from '@/lib/auth/user-family-access'

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

    const familyIds = await getUserModuleFamilyGrantIds(managerId, 'inventory')
    const families =
      familyIds.length > 0
        ? await prisma.families.findMany({
            where: { id: { in: familyIds } },
          })
        : []

    return NextResponse.json({ families })
  } catch {
    return NextResponse.json({ error: 'Error al obtener familias del gestor' }, { status: 500 })
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
      return NextResponse.json({ error: 'familyIds debe ser un arreglo' }, { status: 400 })
    }

    if (familyIds.length > 0) {
      const existingFamilies = await prisma.families.findMany({
        where: { id: { in: familyIds } },
        select: { id: true },
      })

      if (existingFamilies.length !== familyIds.length) {
        return NextResponse.json({ error: 'La familia especificada no existe' }, { status: 400 })
      }
    }

    const manager = await prisma.users.findUnique({
      where: { id: managerId },
      select: { role: true },
    })

    await setUserModuleFamilies({
      userId: managerId,
      moduleInput: 'inventory',
      familyIds,
      role: manager?.role,
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

    const savedIds = await getUserModuleFamilyGrantIds(managerId, 'inventory')
    const families =
      savedIds.length > 0 ? await prisma.families.findMany({ where: { id: { in: savedIds } } }) : []

    await invalidateCache(`user:modules:${managerId}`)
    await invalidateCache(`perm:inv:${managerId}`)

    NotificationEvents.emit(managerId, { type: 'session_refresh', reason: 'permissions_changed' })

    return NextResponse.json({ families })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar familias del gestor' }, { status: 500 })
  }
}

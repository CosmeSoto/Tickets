import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationEvents } from '@/lib/notification-events'

/**
 * POST /api/admin/families/[id]/managers
 * Body: { userId: string }
 * Crea registro en inventory_manager_families
 * HTTP 409 si ya existe el par (managerId, familyId)
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id } = await params

    const family = await prisma.families.findUnique({ where: { id } })
    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const { userId } = await request.json()

    const existing = await prisma.inventory_manager_families.findUnique({
      where: { managerId_familyId: { managerId: userId, familyId: id } },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'El gestor ya está asignado a esta familia' },
        { status: 409 }
      )
    }

    const assignment = await prisma.$transaction(async tx => {
      // Crear la asignación a la familia
      const created = await tx.inventory_manager_families.create({
        data: {
          id: randomUUID(),
          managerId: userId,
          familyId: id,
        },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              canManageInventory: true,
              isActive: true,
            },
          },
        },
      })

      // Activar canManageInventory automáticamente si no lo tiene
      // (ADMIN siempre lo tiene implícito, pero actualizamos igual para consistencia)
      if (!created.manager.canManageInventory) {
        await tx.users.update({
          where: { id: userId },
          data: { canManageInventory: true },
        })
      }

      return created
    })

    // Notificar al usuario para que refresque su sesión y vea el menú de gestor
    NotificationEvents.emit(userId, { type: 'session_refresh', reason: 'permissions_changed' })

    // Invalidar caché de módulos del gestor asignado
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await Promise.all([
        invalidateCache(`admin:family:id=${id}`),
        invalidateCache(`user:modules:${userId}`),
        invalidateCache(`perm:inv:${userId}`),
      ])
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error assigning manager:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

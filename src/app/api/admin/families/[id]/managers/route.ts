import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * POST /api/admin/families/[id]/managers
 * Body: { userId: string }
 * Crea registro en inventory_manager_families
 * HTTP 409 si ya existe el par (managerId, familyId)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

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

    const assignment = await prisma.inventory_manager_families.create({
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

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error assigning manager:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

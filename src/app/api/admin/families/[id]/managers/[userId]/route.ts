import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * DELETE /api/admin/families/[id]/managers/[userId]
 * Elimina registro de inventory_manager_families
 * HTTP 404 si no existe
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id, userId } = await params

    const existing = await prisma.inventory_manager_families.findUnique({
      where: { managerId_familyId: { managerId: userId, familyId: id } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    await prisma.inventory_manager_families.delete({
      where: { managerId_familyId: { managerId: userId, familyId: id } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing manager assignment:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

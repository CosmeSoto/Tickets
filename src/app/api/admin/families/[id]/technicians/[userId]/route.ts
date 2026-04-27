import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * DELETE /api/admin/families/[id]/technicians/[userId]
 * Elimina registro de technician_family_assignments
 * HTTP 404 si no existe
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id, userId } = await params

    const existing = await prisma.technician_family_assignments.findUnique({
      where: { technicianId_familyId: { technicianId: userId, familyId: id } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
    }

    await prisma.technician_family_assignments.delete({
      where: { technicianId_familyId: { technicianId: userId, familyId: id } },
    })

    // Invalidar caché de módulos del técnico desasignado
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await Promise.all([
        invalidateCache(`admin:family:id=${id}`),
        invalidateCache(`user:modules:${userId}`),
      ])
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing technician assignment:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * POST /api/admin/families/[id]/technicians
 * Body: { userId: string }
 * Crea registro en technician_family_assignments con isActive: true
 * HTTP 409 si ya existe el par (technicianId, familyId)
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

    const existing = await prisma.technician_family_assignments.findUnique({
      where: { technicianId_familyId: { technicianId: userId, familyId: id } },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'El técnico ya está asignado a esta familia' },
        { status: 409 }
      )
    }

    const assignment = await prisma.technician_family_assignments.create({
      data: {
        id: randomUUID(),
        technicianId: userId,
        familyId: id,
        isActive: true,
      },
      include: {
        technician: {
          select: { id: true, name: true, email: true, role: true, isActive: true },
        },
      },
    })

    // Invalidar caché de la familia
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(`admin:family:id=${id}`)
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json(assignment, { status: 201 })
  } catch (error) {
    console.error('Error assigning technician:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

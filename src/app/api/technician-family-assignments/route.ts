import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

// GET /api/technician-family-assignments — Lista asignaciones; solo ADMIN
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const technicianId = searchParams.get('technicianId')
    const familyId = searchParams.get('familyId')

    const assignments = await prisma.technician_family_assignments.findMany({
      where: {
        ...(technicianId && { technicianId }),
        ...(familyId && { familyId }),
      },
      include: {
        technician: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        family: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
      orderBy: [{ family: { order: 'asc' } }, { technician: { name: 'asc' } }],
    })

    return NextResponse.json({ success: true, data: assignments })
  } catch (error) {
    console.error('[GET /api/technician-family-assignments]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener asignaciones' },
      { status: 500 }
    )
  }
}

// POST /api/technician-family-assignments — Crea asignación; solo ADMIN
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { technicianId, familyId } = body

    if (!technicianId || !familyId) {
      return NextResponse.json(
        { success: false, message: 'Los campos "technicianId" y "familyId" son requeridos' },
        { status: 400 }
      )
    }

    // Validar que el usuario tenga rol TECHNICIAN
    const user = await prisma.users.findUnique({
      where: { id: technicianId },
      select: { id: true, name: true, role: true, isActive: true },
    })

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { success: false, message: 'El usuario debe tener rol TECHNICIAN' },
        { status: 400 }
      )
    }

    // Verificar que la familia existe
    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, name: true },
    })

    if (!family) {
      return NextResponse.json(
        { success: false, message: 'Familia no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que no exista ya la asignación
    const existing = await prisma.technician_family_assignments.findUnique({
      where: { technicianId_familyId: { technicianId, familyId } },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'El técnico ya está asignado a esta familia' },
        { status: 400 }
      )
    }

    const assignment = await prisma.technician_family_assignments.create({
      data: { id: randomUUID(), technicianId, familyId },
      include: {
        technician: { select: { id: true, name: true, email: true } },
        family: { select: { id: true, name: true, code: true, color: true } },
      },
    })

    return NextResponse.json(
      { success: true, data: assignment, message: 'Asignación creada exitosamente' },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/technician-family-assignments]', error)
    return NextResponse.json(
      { success: false, message: 'Error al crear asignación' },
      { status: 500 }
    )
  }
}

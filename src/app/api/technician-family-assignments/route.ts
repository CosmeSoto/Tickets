import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'
import { assignUserModuleFamily } from '@/lib/auth/user-family-access'

/**
 * @deprecated Preferir `/api/admin/users/:id/family-access` (module=tickets).
 * Thin wrapper sobre user_family_access.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const technicianId = searchParams.get('technicianId')
    const familyId = searchParams.get('familyId')

    const rows = await prisma.user_family_access.findMany({
      where: {
        module: 'tickets',
        isActive: true,
        user: { role: 'TECHNICIAN' },
        ...(technicianId && { userId: technicianId }),
        ...(familyId && { familyId }),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        family: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
      orderBy: [{ family: { order: 'asc' } }, { user: { name: 'asc' } }],
    })

    const assignments = rows.map(row => ({
      id: row.id,
      technicianId: row.userId,
      familyId: row.familyId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      technician: row.user,
      family: row.family,
    }))

    return NextResponse.json({ success: true, data: assignments })
  } catch (error) {
    console.error('[GET /api/technician-family-assignments]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener asignaciones' },
      { status: 500 }
    )
  }
}

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

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, name: true, code: true, color: true },
    })

    if (!family) {
      return NextResponse.json(
        { success: false, message: 'Familia no encontrada' },
        { status: 404 }
      )
    }

    const existing = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: technicianId, familyId, module: 'tickets' },
      },
    })

    if (existing?.isActive) {
      return NextResponse.json(
        { success: false, message: 'El técnico ya está asignado a esta familia' },
        { status: 400 }
      )
    }

    await assignUserModuleFamily({
      userId: technicianId,
      familyId,
      moduleInput: 'tickets',
      role: 'TECHNICIAN',
    })

    const row = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId: technicianId, familyId, module: 'tickets' },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        family: { select: { id: true, name: true, code: true, color: true } },
      },
    })

    await invalidateCache(`user:modules:${technicianId}`)

    const assignment = row
      ? {
          id: row.id,
          technicianId: row.userId,
          familyId: row.familyId,
          isActive: row.isActive,
          technician: row.user,
          family: row.family,
        }
      : { technicianId, familyId, technician: user, family }

    return NextResponse.json(
      { success: true, data: assignment, message: 'Asignación creada exitosamente' },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[POST /api/technician-family-assignments]', error)
    const message = error?.message?.includes('nativa') ? error.message : 'Error al crear asignación'
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}

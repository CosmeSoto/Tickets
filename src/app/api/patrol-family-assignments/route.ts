import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { invalidateCache } from '@/lib/api-cache'

/**
 * GET /api/patrol-family-assignments?userId=xxx
 * Lista las familias asignadas a un usuario para el módulo de rondas.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

    const assignments = await prisma.patrol_family_assignments.findMany({
      where: { userId, isActive: true },
      include: {
        family: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: assignments.map(a => ({ ...a, familyId: a.familyId })),
    })
  } catch (error) {
    console.error('[GET /api/patrol-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/patrol-family-assignments
 * Body: { userId, familyId }
 * Asigna una familia al usuario para el módulo de rondas.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { userId, familyId } = await request.json()
    if (!userId || !familyId)
      return NextResponse.json({ error: 'userId y familyId son requeridos' }, { status: 400 })

    // Validar que el usuario existe y tiene patrolsEnabled
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, patrolsEnabled: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (!user.patrolsEnabled)
      return NextResponse.json(
        { error: 'El usuario no tiene el módulo de rondas habilitado' },
        { status: 400 }
      )
    // ADMIN no necesita asignación de familias de rondas (usa admin_family_assignments)
    if (user.role === 'ADMIN')
      return NextResponse.json(
        { error: 'Los administradores gestionan rondas según sus familias de administración' },
        { status: 400 }
      )

    // Validar que la familia existe y está activa
    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, isActive: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    if (!family.isActive)
      return NextResponse.json({ error: 'La familia no está activa' }, { status: 400 })

    // Verificar duplicado — reactivar si existe inactiva
    const existing = await prisma.patrol_family_assignments.findUnique({
      where: { userId_familyId: { userId, familyId } },
    })
    if (existing) {
      if (!existing.isActive) {
        const reactivated = await prisma.patrol_family_assignments.update({
          where: { userId_familyId: { userId, familyId } },
          data: { isActive: true },
        })
        await invalidateCache(`user:modules:${userId}`)
        return NextResponse.json({ success: true, data: reactivated })
      }
      return NextResponse.json(
        { error: 'El usuario ya está asignado a esta familia para rondas' },
        { status: 409 }
      )
    }

    const assignment = await prisma.patrol_family_assignments.create({
      data: { id: randomUUID(), userId, familyId, isActive: true },
      include: {
        family: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
    })

    await invalidateCache(`user:modules:${userId}`)

    return NextResponse.json({ success: true, data: assignment }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/patrol-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/patrol-family-assignments?userId=xxx&familyId=yyy
 * Desasigna una familia del usuario para rondas (soft delete).
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const familyId = searchParams.get('familyId')

    if (!userId || !familyId)
      return NextResponse.json({ error: 'userId y familyId son requeridos' }, { status: 400 })

    await prisma.patrol_family_assignments.updateMany({
      where: { userId, familyId },
      data: { isActive: false },
    })

    await invalidateCache(`user:modules:${userId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/patrol-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

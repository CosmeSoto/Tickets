import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'
import { assignUserModuleFamily, unassignUserModuleFamily } from '@/lib/auth/user-family-access'

/**
 * @deprecated Preferir `/api/admin/users/:id/family-access` (module=patrols).
 * Thin wrapper sobre user_family_access.
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

    const rows = await prisma.user_family_access.findMany({
      where: { userId, module: 'patrols', isActive: true },
      include: {
        family: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const assignments = rows.map(row => ({
      id: row.id,
      userId: row.userId,
      familyId: row.familyId,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      family: row.family,
    }))

    return NextResponse.json({ success: true, data: assignments })
  } catch (error) {
    console.error('[GET /api/patrol-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { userId, familyId } = await request.json()
    if (!userId || !familyId)
      return NextResponse.json({ error: 'userId y familyId son requeridos' }, { status: 400 })

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, patrolsEnabled: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    if (!viewer?.isSuperAdmin) {
      const { getUserFamilyScope } = await import('@/lib/auth/admin-scope')
      const scope = await getUserFamilyScope(session.user.id, 'ADMIN', false)
      if (scope.familyIds && !scope.familyIds.includes(familyId)) {
        return NextResponse.json({ error: 'No tienes acceso a esta familia' }, { status: 403 })
      }
    }

    const family = await prisma.families.findUnique({
      where: { id: familyId },
      select: { id: true, isActive: true, name: true, code: true, color: true },
    })
    if (!family) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    if (!family.isActive)
      return NextResponse.json({ error: 'La familia no está activa' }, { status: 400 })

    const existing = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId, familyId, module: 'patrols' },
      },
    })
    if (existing?.isActive) {
      return NextResponse.json(
        { error: 'El usuario ya está asignado a esta familia para rondas' },
        { status: 409 }
      )
    }

    await assignUserModuleFamily({
      userId,
      familyId,
      moduleInput: 'patrols',
      role: user.role,
    })

    const row = await prisma.user_family_access.findUnique({
      where: {
        userId_familyId_module: { userId, familyId, module: 'patrols' },
      },
      include: {
        family: { select: { id: true, name: true, code: true, color: true, isActive: true } },
      },
    })

    await invalidateCache(`user:modules:${userId}`)

    const assignment = row
      ? {
          id: row.id,
          userId: row.userId,
          familyId: row.familyId,
          isActive: row.isActive,
          family: row.family,
        }
      : { userId, familyId, isActive: true, family }

    return NextResponse.json({ success: true, data: assignment }, { status: 201 })
  } catch (error: any) {
    console.error('[POST /api/patrol-family-assignments]', error)
    return NextResponse.json(
      { error: error?.message ?? 'Error interno del servidor' },
      { status: 400 }
    )
  }
}

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

    const target = await prisma.users.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    await unassignUserModuleFamily({
      userId,
      familyId,
      moduleInput: 'patrols',
      role: target?.role,
    })

    await invalidateCache(`user:modules:${userId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/patrol-family-assignments]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

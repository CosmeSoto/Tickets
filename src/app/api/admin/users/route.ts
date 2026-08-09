/**
 * API: Users
 * GET /api/admin/users
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getAdminUnionDepartmentIds } from '@/lib/auth/admin-scope'

/**
 * GET - Obtener usuarios (scoped para admin no-super)
 * Query params:
 * - canManageInventory: filtrar usuarios que pueden gestionar inventario
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    const isSuperAdmin = viewer?.isSuperAdmin === true

    const { searchParams } = new URL(request.url)
    const canManageInventory = searchParams.get('canManageInventory') === 'true'

    const where: Record<string, unknown> = {
      isSuperAdmin: false,
    }

    if (canManageInventory) {
      where.canManageInventory = true
    }

    if (!isSuperAdmin) {
      const deptIds = await getAdminUnionDepartmentIds(session.user.id, false)
      if (deptIds !== undefined) {
        if (deptIds.length === 0) {
          return NextResponse.json({ users: [] })
        }
        where.departmentId = { in: deptIds }
      }
    }

    const users = await prisma.users.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        canManageInventory: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error obteniendo usuarios:', error)
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 })
  }
}

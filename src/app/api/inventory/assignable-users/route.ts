import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

/**
 * GET /api/inventory/assignable-users?familyId=&departmentId=
 *
 * Devuelve usuarios asignables a un activo de inventario según el rol del solicitante:
 *   - super_admin : todos los usuarios activos (sin restricción de familia)
 *   - admin       : usuarios de las familias asignadas al admin
 *                   (si no tiene asignaciones explícitas → todos)
 *   - gestor      : usuarios de las familias asignadas al gestor
 *
 * Si se pasa ?departmentId= se filtra adicionalmente por departamento.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    const { searchParams } = request.nextUrl
    const familyId = searchParams.get('familyId') || undefined
    const departmentId = searchParams.get('departmentId') || undefined
    const search = searchParams.get('search') || undefined

    const userId = session.user.id
    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    // Construir filtro base
    const where: Record<string, unknown> = {
      isActive: true,
    }

    // Filtro de búsqueda por nombre o email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Filtrar por departamento si se especifica
    if (departmentId) {
      where.departmentId = departmentId
    }

    // Aplicar restricción de familia según rol
    if (!isSuperAdmin && familyId) {
      if (role === 'ADMIN') {
        const { getUserFamilyScope } = await import('@/lib/auth/admin-scope')
        const scope = await getUserFamilyScope(userId, 'ADMIN', false)
        if (scope.familyIds && scope.familyIds.length > 0) {
          if (!scope.familyIds.includes(familyId)) {
            return NextResponse.json({ users: [] })
          }
          if (!departmentId) {
            where.departments = { familyId: { in: scope.familyIds } }
          }
        }
      } else {
        const { resolveModuleFamilyScopeIds } = await import('@/lib/auth/user-family-access')
        const allowedFamilyIds = await resolveModuleFamilyScopeIds(
          userId,
          'inventory',
          'canOperate'
        )

        if (!allowedFamilyIds.includes(familyId)) {
          return NextResponse.json({ users: [] })
        }

        if (!departmentId) {
          where.departments = { familyId: { in: allowedFamilyIds } }
        }
      }
    } else if (!isSuperAdmin && !familyId && !departmentId) {
      if (role === 'ADMIN') {
        const { getUserFamilyScope } = await import('@/lib/auth/admin-scope')
        const scope = await getUserFamilyScope(userId, 'ADMIN', false)
        if (scope.familyIds && scope.familyIds.length > 0) {
          where.departments = { familyId: { in: scope.familyIds } }
        }
      } else {
        const { resolveModuleFamilyScopeIds } = await import('@/lib/auth/user-family-access')
        const allowedFamilyIds = await resolveModuleFamilyScopeIds(
          userId,
          'inventory',
          'canOperate'
        )
        if (allowedFamilyIds.length > 0) {
          where.departments = { familyId: { in: allowedFamilyIds } }
        }
      }
    }

    const users = await prisma.users.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        departments: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
      take: 500,
    })

    const result = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      department: u.departments ? { id: u.departments.id, name: u.departments.name } : null,
    }))

    return NextResponse.json({ users: result })
  } catch (error) {
    console.error('[assignable-users] Error:', error)
    return NextResponse.json({ error: 'Error al obtener usuarios asignables' }, { status: 500 })
  }
}

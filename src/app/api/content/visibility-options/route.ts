/**
 * GET /api/content/visibility-options
 * Opciones de visibilidad acotadas al rol/alcance del usuario
 * (Documentos y Noticias).
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getContentVisibilityScope,
  serializeVisibilityScopeForClient,
} from '@/lib/content/visibility-scope'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const scope = await getContentVisibilityScope(session.user.id, session.user.role, isSuperAdmin)

    const familyWhere =
      scope.allowedFamilyIds === undefined
        ? { isActive: true }
        : { isActive: true, id: { in: scope.allowedFamilyIds } }

    const families = await prisma.families.findMany({
      where: familyWhere,
      select: {
        id: true,
        name: true,
        color: true,
        departments: {
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Usuarios del módulo: preferir los del alcance (deptos de familias permitidas)
    const userWhere: Record<string, unknown> = {
      isActive: true,
      id: { not: session.user.id },
    }
    if (scope.allowedDepartmentIds !== undefined) {
      if (scope.allowedDepartmentIds.length === 0) {
        return NextResponse.json({
          scope: serializeVisibilityScopeForClient(scope),
          families,
          users: [],
        })
      }
      userWhere.OR = [
        { departmentId: { in: scope.allowedDepartmentIds } },
        ...(scope.allowedFamilyIds
          ? [{ departments: { familyId: { in: scope.allowedFamilyIds } } }]
          : []),
      ]
    }

    const users = await prisma.users.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
      take: 500,
    })

    return NextResponse.json({
      scope: serializeVisibilityScopeForClient(scope),
      families,
      users,
    })
  } catch (error) {
    console.error('[visibility-options]', error)
    return NextResponse.json({ error: 'Error al obtener opciones de visibilidad' }, { status: 500 })
  }
}

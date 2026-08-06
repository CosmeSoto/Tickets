import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey } from '@/lib/api-cache'

async function countFamilyAccessByModule(
  familyId: string,
  module: string,
  userRole?: string
): Promise<number> {
  return prisma.user_family_access.count({
    where: {
      familyId,
      module,
      isActive: true,
      ...(userRole ? { user: { role: userRole as 'ADMIN' | 'TECHNICIAN' | 'CLIENT' } } : {}),
    },
  })
}

/**
 * GET /api/admin/families/[id]
 * Retorna datos unificados de la familia (configuración + departamentos).
 * Los arrays de personal (técnicos, gestores, admins, clientes) fueron eliminados —
 * las asignaciones se gestionan desde el módulo de Usuarios.
 * Se conservan los _count para el InformationalNotice.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id } = await params

    const requesterIsSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const familyScope = await (
      await import('@/lib/auth/admin-scope')
    ).assertAdminCanAccessFamily(session.user.id, requesterIsSuperAdmin, id)
    if (!familyScope.allowed) {
      return NextResponse.json({ error: familyScope.error }, { status: familyScope.status })
    }

    const cacheKey = buildCacheKey('admin:family', { id })
    const data = await withCache(cacheKey, 30, async () => {
      const [family, departments, technicianCount, managerCount, clientCount] = await Promise.all([
        prisma.families.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                departments: true,
                tickets: true,
              },
            },
          },
        }),
        prisma.departments.findMany({
          where: { familyId: id },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        }),
        countFamilyAccessByModule(id, 'tickets', 'TECHNICIAN'),
        countFamilyAccessByModule(id, 'inventory'),
        countFamilyAccessByModule(id, 'tickets', 'CLIENT'),
      ])

      if (!family) return null

      return {
        family: {
          ...family,
          _count: {
            ...family._count,
            technicianFamilyAssignments: technicianCount,
            managerFamilies: managerCount,
            clientFamilyAssignments: clientCount,
          },
        },
        departments,
      }
    })

    if (!data) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/admin/families/[id]]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

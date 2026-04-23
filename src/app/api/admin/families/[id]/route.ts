import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey, invalidateCache } from '@/lib/api-cache'

/**
 * GET /api/admin/families/[id]
 * Retorna datos unificados de la familia (sin configs de tickets/inventario)
 * Las configuraciones se gestionan desde /admin/settings/tickets y /admin/settings/inventory
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id } = await params

    // Caché 30 segundos — datos de familia con personal, se invalida en mutaciones
    const cacheKey = buildCacheKey('admin:family', { id })
    const data = await withCache(cacheKey, 30, async () => {
      const currentUser = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { isSuperAdmin: true },
      })

      const [family, departments, technicians, managers, admins] = await Promise.all([
        prisma.families.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                departments: true,
                tickets: true,
                technicianFamilyAssignments: true,
                managerFamilies: true,
              },
            },
          },
        }),
        prisma.departments.findMany({
          where: { familyId: id },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
        }),
        prisma.technician_family_assignments.findMany({
          where: { familyId: id },
          include: {
            technician: {
              select: { id: true, name: true, email: true, role: true, isActive: true },
            },
          },
        }),
        prisma.inventory_manager_families.findMany({
          where: { familyId: id },
          include: {
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                canManageInventory: true,
                isActive: true,
              },
            },
          },
        }),
        prisma.admin_family_assignments.findMany({
          where: { familyId: id, isActive: true },
          include: {
            admin: {
              select: { id: true, name: true, email: true, isSuperAdmin: true },
            },
          },
        }),
      ])

      return {
        family,
        departments,
        technicians,
        managers,
        admins,
        currentUserIsSuperAdmin: currentUser?.isSuperAdmin ?? false,
      }
    })

    if (!data.family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching family:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

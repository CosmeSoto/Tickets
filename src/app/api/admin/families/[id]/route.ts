import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/admin/families/[id]
 * Retorna FamilyUnifiedResponse con todos los datos de la familia
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const { id } = await params

    // Verificar si el usuario actual es super admin
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    const [family, departments, technicians, managers, admins] = await Promise.all([
      prisma.families.findUnique({
        where: { id },
        include: {
          ticketFamilyConfig: true,
          formConfig: true,
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

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      family,
      ticketConfig: family.ticketFamilyConfig,
      inventoryConfig: family.formConfig,
      departments,
      technicians,
      managers,
      admins,
      currentUserIsSuperAdmin: currentUser?.isSuperAdmin ?? false,
    })
  } catch (error) {
    console.error('Error fetching family:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

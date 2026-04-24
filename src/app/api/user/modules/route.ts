import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withCache } from '@/lib/api-cache'
/**
 * GET /api/user/modules
 * Devuelve los módulos activos para el usuario autenticado según sus familias asignadas.
 * Usado por el layout de navegación para mostrar/ocultar secciones dinámicamente.
 *
 * Respuesta:
 * {
 *   tickets: boolean,    // al menos una familia del usuario tiene ticketsEnabled=true
 *   inventory: boolean,  // al menos una familia del usuario tiene inventoryEnabled=true
 *   families: Array<{ id, name, modules: { tickets, inventory } }>
 * }
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  // Admin puede consultar módulos de otro usuario (para el modal de edición)
  const targetUserId = searchParams.get('userId')
  const isAdmin = session.user.role === 'ADMIN'

  if (targetUserId && targetUserId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Si se pasa userId, cargar el rol y permisos del usuario objetivo
  let userId = session.user.id
  let role = session.user.role
  let isSuperAdmin = (session.user as any).isSuperAdmin === true
  let canManageInventory = (session.user as any).canManageInventory === true

  if (targetUserId && targetUserId !== session.user.id) {
    const targetUser = await prisma.users.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isSuperAdmin: true, canManageInventory: true },
    })
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    userId = targetUser.id
    role = targetUser.role
    isSuperAdmin = targetUser.isSuperAdmin ?? false
    canManageInventory = targetUser.canManageInventory ?? false
  }

  const cacheKey = `user:modules:${userId}`

  const result = await withCache(cacheKey, 120, async () => {
    // Obtener familias del usuario según su rol
    let familyIds: string[] = []

    if (role === 'ADMIN') {
      if (isSuperAdmin) {
        // SuperAdmin: todas las familias activas
        const all = await prisma.families.findMany({
          where: { isActive: true },
          select: { id: true },
        })
        familyIds = all.map(f => f.id)
      } else {
        const assignments = await prisma.admin_family_assignments.findMany({
          where: { adminId: userId, isActive: true },
          select: { familyId: true },
        })
        // Sin asignaciones explícitas → acceso total (admin legacy)
        if (assignments.length === 0) {
          const all = await prisma.families.findMany({
            where: { isActive: true },
            select: { id: true },
          })
          familyIds = all.map(f => f.id)
        } else {
          familyIds = assignments.map(a => a.familyId)
        }
      }
    } else if (role === 'TECHNICIAN') {
      const assignments = await prisma.technician_family_assignments.findMany({
        where: { technicianId: userId, isActive: true },
        select: { familyId: true },
      })
      familyIds = assignments.map(a => a.familyId)

      // Si es gestor, agregar familias de inventario
      if (canManageInventory) {
        const invAssignments = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        const invIds = invAssignments.map(a => a.familyId)
        familyIds = [...new Set([...familyIds, ...invIds])]
      }
    } else if (role === 'CLIENT') {
      if (canManageInventory) {
        const invAssignments = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        familyIds = invAssignments.map(a => a.familyId)
      } else {
        // Familias de los tickets del cliente
        const ticketFamilies = await prisma.tickets.findMany({
          where: { clientId: userId, familyId: { not: null } },
          select: { familyId: true },
          distinct: ['familyId'],
        })
        familyIds = ticketFamilies.map(t => t.familyId!).filter(Boolean)
      }
    }

    if (familyIds.length === 0) {
      return { tickets: false, inventory: false, families: [] }
    }

    // Consultar configs de módulos para esas familias
    const [ticketConfigs, invConfigs, families] = await Promise.all([
      prisma.ticket_family_config.findMany({
        where: { familyId: { in: familyIds } },
        select: { familyId: true, ticketsEnabled: true },
      }),
      prisma.inventory_family_config.findMany({
        where: { familyId: { in: familyIds } },
        select: { familyId: true, inventoryEnabled: true },
      }),
      prisma.families.findMany({
        where: { id: { in: familyIds }, isActive: true },
        select: { id: true, name: true, code: true, color: true },
      }),
    ])

    const ticketMap = new Map(ticketConfigs.map(c => [c.familyId, c.ticketsEnabled]))
    const invMap = new Map(invConfigs.map(c => [c.familyId, c.inventoryEnabled]))

    const enrichedFamilies = families.map(f => ({
      ...f,
      modules: {
        tickets: ticketMap.get(f.id) ?? false,
        inventory: invMap.get(f.id) ?? false,
      },
    }))

    // Módulo activo si AL MENOS UNA familia lo tiene habilitado
    const hasTickets = enrichedFamilies.some(f => f.modules.tickets)
    const hasInventory = enrichedFamilies.some(f => f.modules.inventory)

    // ADMIN siempre ve tickets e inventario (gestión global)
    return {
      tickets: role === 'ADMIN' ? true : hasTickets,
      inventory: role === 'ADMIN' ? true : hasInventory,
      families: enrichedFamilies,
    }
  })

  return NextResponse.json(result)
}

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
  // Si viene con ?_t= es un bypass de cache — invalidar antes de responder
  const bypassCache = searchParams.has('_t')

  if (targetUserId && targetUserId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Si se pasa userId, cargar el rol y permisos del usuario objetivo
  let userId = session.user.id
  let role = session.user.role
  let isSuperAdmin = (session.user as any).isSuperAdmin === true
  let canManageInventory = (session.user as any).canManageInventory === true
  let ticketsEnabled = true
  let inventoryEnabled = false

  if (targetUserId && targetUserId !== session.user.id) {
    const targetUser = await prisma.users.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
        isSuperAdmin: true,
        canManageInventory: true,
        ticketsEnabled: true,
        inventoryEnabled: true,
      },
    })
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    userId = targetUser.id
    role = targetUser.role
    isSuperAdmin = targetUser.isSuperAdmin ?? false
    canManageInventory = targetUser.canManageInventory ?? false
    ticketsEnabled = targetUser.ticketsEnabled ?? true
    inventoryEnabled = targetUser.inventoryEnabled ?? false
  } else {
    // Cargar flags del usuario actual desde DB (la sesión puede estar desactualizada)
    const currentUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { ticketsEnabled: true, inventoryEnabled: true, canManageInventory: true },
    })
    if (currentUser) {
      ticketsEnabled = currentUser.ticketsEnabled ?? true
      inventoryEnabled = currentUser.inventoryEnabled ?? false
      canManageInventory = currentUser.canManageInventory ?? false
    }
  }

  const cacheKey = `user:modules:${userId}`

  // Si es bypass, invalidar cache primero para obtener datos frescos
  if (bypassCache) {
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(cacheKey)
    } catch {
      // Redis no disponible — continuar sin cache
    }
  }

  const result = await withCache(cacheKey, 30, async () => {
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

      // Solo agregar familias de inventario si es gestor explícito
      if (canManageInventory) {
        const invAssignments = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        const invIds = invAssignments.map(a => a.familyId)
        familyIds = [...new Set([...familyIds, ...invIds])]
      }
    } else if (role === 'CLIENT') {
      // Familias explícitamente asignadas al cliente
      const explicitAssignments = await prisma.client_family_assignments.findMany({
        where: { clientId: userId, isActive: true },
        select: { familyId: true },
      })
      const explicitIds = explicitAssignments.map(a => a.familyId)

      if (canManageInventory) {
        // Gestor de inventario: sus familias de inventario + las explícitas de tickets
        const invAssignments = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        const invIds = invAssignments.map(a => a.familyId)
        familyIds = [...new Set([...invIds, ...explicitIds])]
      } else {
        // Familias explícitas + familias derivadas de tickets existentes
        const ticketFamilies = await prisma.tickets.findMany({
          where: { clientId: userId, familyId: { not: null } },
          select: { familyId: true },
          distinct: ['familyId'],
        })
        const ticketIds = ticketFamilies.map(t => t.familyId!).filter(Boolean)
        familyIds = [...new Set([...explicitIds, ...ticketIds])]
      }
    }

    if (familyIds.length === 0) {
      // Super Admin sin familias: acceso total
      if (role === 'ADMIN' && isSuperAdmin) {
        return { tickets: true, inventory: true, families: [] }
      }
      // Admin normal sin familias asignadas: acceso total (legacy — admin creado antes del sistema de familias)
      if (role === 'ADMIN') {
        return { tickets: true, inventory: true, families: [] }
      }
      // Para clientes con módulos explícitamente habilitados pero sin familias aún
      if (role === 'CLIENT') {
        return {
          tickets: ticketsEnabled,
          inventory: inventoryEnabled || canManageInventory,
          families: [],
        }
      }
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

    // Para ADMIN: siempre mostrar los módulos activos de sus familias
    // Para TECHNICIAN/CLIENT: respetar flags de permisos del usuario
    const isAdminRole = role === 'ADMIN'

    const enrichedFamilies = families.map(f => ({
      ...f,
      modules: {
        tickets: ticketMap.get(f.id) ?? false,
        inventory: isAdminRole
          ? (invMap.get(f.id) ?? false)
          : canManageInventory || inventoryEnabled
            ? (invMap.get(f.id) ?? false)
            : false,
      },
    }))

    const familyHasTickets = enrichedFamilies.some(f => f.modules.tickets)
    const familyHasInventory = enrichedFamilies.some(f => invMap.get(f.id) ?? false)

    /**
     * Tabla de reglas de visibilidad de módulos:
     *
     * | Rol            | Tickets                              | Inventario                                              |
     * |----------------|--------------------------------------|---------------------------------------------------------|
     * | Super Admin    | Siempre true                         | Siempre true                                            |
     * | Admin normal   | Si alguna familia tiene tickets ON   | Si alguna familia tiene inventario ON                   |
     * | Technician     | Si alguna familia tiene tickets ON   | inventoryEnabled=true O canManageInventory=true         |
     * | Client         | Flag ticketsEnabled del usuario      | inventoryEnabled=true O canManageInventory=true         |
     *
     * inventoryEnabled = puede VER el módulo (sus equipos asignados)
     * canManageInventory = puede GESTIONAR activos (crear, editar, configurar)
     */
    let resolvedTickets: boolean
    let resolvedInventory: boolean

    if (role === 'ADMIN') {
      resolvedTickets = isSuperAdmin ? true : familyHasTickets
      resolvedInventory = isSuperAdmin ? true : familyHasInventory
    } else if (role === 'TECHNICIAN') {
      resolvedTickets = familyHasTickets
      // inventoryEnabled permite ver el módulo; canManageInventory permite gestionarlo
      resolvedInventory = inventoryEnabled || canManageInventory
    } else {
      // CLIENT
      resolvedTickets = ticketsEnabled
      resolvedInventory = inventoryEnabled || canManageInventory
    }

    return {
      tickets: resolvedTickets,
      inventory: resolvedInventory,
      families: enrichedFamilies,
    }
  })

  return NextResponse.json(result)
}

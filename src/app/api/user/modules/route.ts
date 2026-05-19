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
  let patrolsEnabled = false
  let newsEnabled = false

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
        patrolsEnabled: true,
        newsEnabled: true,
      },
    })
    if (!targetUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    userId = targetUser.id
    role = targetUser.role
    isSuperAdmin = targetUser.isSuperAdmin ?? false
    canManageInventory = targetUser.canManageInventory ?? false
    ticketsEnabled = targetUser.ticketsEnabled ?? true
    inventoryEnabled = targetUser.inventoryEnabled ?? false
    patrolsEnabled = targetUser.patrolsEnabled ?? false
    newsEnabled = targetUser.newsEnabled ?? false
  } else {
    // Cargar flags del usuario actual desde DB (la sesión puede estar desactualizada)
    const currentUser = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        ticketsEnabled: true,
        inventoryEnabled: true,
        canManageInventory: true,
        patrolsEnabled: true,
        newsEnabled: true,
      },
    })
    if (currentUser) {
      ticketsEnabled = currentUser.ticketsEnabled ?? true
      inventoryEnabled = currentUser.inventoryEnabled ?? false
      canManageInventory = currentUser.canManageInventory ?? false
      patrolsEnabled = currentUser.patrolsEnabled ?? false
      newsEnabled = currentUser.newsEnabled ?? false
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

      // Agregar familias de inventario si es gestor explícito
      if (canManageInventory) {
        const invAssignments = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        const invIds = invAssignments.map(a => a.familyId)
        familyIds = [...new Set([...familyIds, ...invIds])]
      }

      // Agregar familias de rondas si tiene el módulo habilitado
      if (patrolsEnabled) {
        const patrolAssignments = await prisma.patrol_family_assignments.findMany({
          where: { userId, isActive: true },
          select: { familyId: true },
        })
        const patrolIds = patrolAssignments.map(a => a.familyId)
        familyIds = [...new Set([...familyIds, ...patrolIds])]
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

      // Agregar familias de rondas si tiene el módulo habilitado
      if (patrolsEnabled) {
        const patrolAssignments = await prisma.patrol_family_assignments.findMany({
          where: { userId, isActive: true },
          select: { familyId: true },
        })
        const patrolIds = patrolAssignments.map(a => a.familyId)
        familyIds = [...new Set([...familyIds, ...patrolIds])]
      }
    }

    // Siempre incluir la familia nativa del usuario (derivada de su departamento)
    // Para Super Admin no es necesario (ya tiene todas las familias)
    if (!(role === 'ADMIN' && isSuperAdmin)) {
      const userWithDept = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          departmentId: true,
          departments: { select: { familyId: true } },
        },
      })
      const nativeFamilyId = userWithDept?.departments?.familyId
      if (nativeFamilyId && !familyIds.includes(nativeFamilyId)) {
        familyIds = [...familyIds, nativeFamilyId]
      }
    }

    if (familyIds.length === 0) {
      // Super Admin sin familias: acceso total
      if (role === 'ADMIN' && isSuperAdmin) {
        return { tickets: true, inventory: true, patrols: true, news: true, families: [] }
      }
      // Admin normal sin familias asignadas: respetar flags del usuario
      if (role === 'ADMIN') {
        return {
          tickets: ticketsEnabled,
          inventory: inventoryEnabled || canManageInventory,
          patrols: patrolsEnabled,
          news: newsEnabled,
          families: [],
        }
      }
      // Para técnicos y clientes sin familias: respetar los flags del usuario
      // Esto permite que un usuario con módulos habilitados vea la sección aunque no tenga familias aún
      return {
        tickets: ticketsEnabled,
        inventory: inventoryEnabled || canManageInventory,
        patrols: patrolsEnabled,
        news: newsEnabled,
        families: [],
      }
    }

    // Consultar configs de módulos (informativo, no se usa para filtrar)
    const [ticketConfigs, invConfigs, patrolConfigs] = await Promise.all([
      prisma.ticket_family_config.findMany({
        where: familyIds.length > 0 ? { familyId: { in: familyIds } } : undefined,
        select: { familyId: true, ticketsEnabled: true },
      }),
      prisma.inventory_family_config.findMany({
        where: familyIds.length > 0 ? { familyId: { in: familyIds } } : undefined,
        select: { familyId: true, inventoryEnabled: true },
      }),
      prisma.patrol_family_config.findMany({
        where: familyIds.length > 0 ? { familyId: { in: familyIds } } : undefined,
        select: { familyId: true, patrolsEnabled: true },
      }),
    ])

    const ticketMap = new Map(ticketConfigs.map(c => [c.familyId, c.ticketsEnabled]))
    const invMap = new Map(invConfigs.map(c => [c.familyId, c.inventoryEnabled]))
    const patrolMap = new Map(patrolConfigs.map(c => [c.familyId, c.patrolsEnabled]))

    // Cargar asignaciones específicas por módulo para determinar qué familias ve en cada módulo
    const ticketFamilyIds: Set<string> = new Set()
    const inventoryFamilyIds: Set<string> = new Set()
    const patrolFamilyIds: Set<string> = new Set()

    if (isSuperAdmin) {
      // Super admin: todas las familias activas en todos los módulos
      const allActive = await prisma.families.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      allActive.forEach(f => {
        ticketFamilyIds.add(f.id)
        inventoryFamilyIds.add(f.id)
        patrolFamilyIds.add(f.id)
      })
    } else if (role === 'ADMIN') {
      // Admin normal: tickets usa admin_family_assignments
      const adminAssigns = await prisma.admin_family_assignments.findMany({
        where: { adminId: userId, isActive: true },
        select: { familyId: true },
      })
      adminAssigns.forEach(a => ticketFamilyIds.add(a.familyId))
      // Inventario: inventory_manager_families (independiente)
      if (inventoryEnabled || canManageInventory) {
        const invAssigns = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        invAssigns.forEach(a => inventoryFamilyIds.add(a.familyId))
      }
      // Rondas: patrol_family_assignments (independiente)
      if (patrolsEnabled) {
        const patrolAssigns = await prisma.patrol_family_assignments.findMany({
          where: { userId, isActive: true },
          select: { familyId: true },
        })
        patrolAssigns.forEach(a => patrolFamilyIds.add(a.familyId))
      }
    } else if (role === 'TECHNICIAN') {
      // Tickets: technician_family_assignments
      const techAssigns = await prisma.technician_family_assignments.findMany({
        where: { technicianId: userId, isActive: true },
        select: { familyId: true },
      })
      techAssigns.forEach(a => ticketFamilyIds.add(a.familyId))
      // Inventario: inventory_manager_families
      if (canManageInventory || inventoryEnabled) {
        const invAssigns = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        invAssigns.forEach(a => inventoryFamilyIds.add(a.familyId))
      }
      // Rondas: patrol_family_assignments
      if (patrolsEnabled) {
        const patrolAssigns = await prisma.patrol_family_assignments.findMany({
          where: { userId, isActive: true },
          select: { familyId: true },
        })
        patrolAssigns.forEach(a => patrolFamilyIds.add(a.familyId))
      }
    } else if (role === 'CLIENT') {
      // Tickets: client_family_assignments
      const clientAssigns = await prisma.client_family_assignments.findMany({
        where: { clientId: userId, isActive: true },
        select: { familyId: true },
      })
      clientAssigns.forEach(a => ticketFamilyIds.add(a.familyId))
      // Inventario: inventory_manager_families
      if (canManageInventory || inventoryEnabled) {
        const invAssigns = await prisma.inventory_manager_families.findMany({
          where: { managerId: userId },
          select: { familyId: true },
        })
        invAssigns.forEach(a => inventoryFamilyIds.add(a.familyId))
      }
      // Rondas: patrol_family_assignments
      if (patrolsEnabled) {
        const patrolAssigns = await prisma.patrol_family_assignments.findMany({
          where: { userId, isActive: true },
          select: { familyId: true },
        })
        patrolAssigns.forEach(a => patrolFamilyIds.add(a.familyId))
      }
    }

    // Siempre incluir familia nativa en todos los módulos habilitados
    const nativeUser = await prisma.users.findUnique({
      where: { id: userId },
      select: { departments: { select: { familyId: true } } },
    })
    const nativeId = nativeUser?.departments?.familyId
    if (nativeId) {
      if (ticketsEnabled) ticketFamilyIds.add(nativeId)
      if (inventoryEnabled || canManageInventory) inventoryFamilyIds.add(nativeId)
      if (patrolsEnabled) patrolFamilyIds.add(nativeId)
    }

    // Cargar TODAS las familias que el usuario tiene en cualquier módulo
    const allModuleFamilyIds = [
      ...new Set([...ticketFamilyIds, ...inventoryFamilyIds, ...patrolFamilyIds]),
    ]
    const families =
      allModuleFamilyIds.length > 0
        ? await prisma.families.findMany({
            where: { id: { in: allModuleFamilyIds }, isActive: true },
            select: { id: true, name: true, code: true, color: true },
          })
        : []

    // Familias enriquecidas: cada familia muestra solo los módulos donde el usuario la tiene asignada
    const enrichedFamilies = families.map(f => ({
      ...f,
      modules: {
        tickets: isSuperAdmin ? true : ticketFamilyIds.has(f.id) && ticketsEnabled,
        inventory: isSuperAdmin
          ? true
          : inventoryFamilyIds.has(f.id) && (inventoryEnabled || canManageInventory),
        patrols: isSuperAdmin ? true : patrolFamilyIds.has(f.id) && patrolsEnabled,
        news: isSuperAdmin ? true : newsEnabled,
      },
    }))

    /**
     * Tabla de reglas de visibilidad de módulos:
     *
     * | Rol            | Tickets                                                    | Inventario                                              |
     * |----------------|------------------------------------------------------------|---------------------------------------------------------|
     * | Super Admin    | Siempre true                                               | Siempre true                                            |
     * | Admin normal   | Si alguna familia tiene tickets ON                         | Si alguna familia tiene inventario ON                   |
     * | Technician     | ticketsEnabled Y alguna familia tiene tickets ON           | inventoryEnabled O canManageInventory                   |
     * | Client         | ticketsEnabled del usuario                                 | inventoryEnabled O canManageInventory                   |
     *
     * El flag del usuario (ticketsEnabled, inventoryEnabled, patrolsEnabled, newsEnabled) actúa como PERMISO.
     * La config de la familia determina DISPONIBILIDAD.
     * El módulo se muestra si el usuario tiene permiso Y al menos una familia lo tiene activo,
     * O si el usuario tiene permiso aunque no haya config de familia (para no bloquear acceso).
     */
    let resolvedTickets: boolean
    let resolvedInventory: boolean
    let resolvedPatrols: boolean
    let resolvedNews: boolean

    if (role === 'ADMIN' && isSuperAdmin) {
      resolvedTickets = true
      resolvedInventory = true
      resolvedPatrols = true
      resolvedNews = true
    } else {
      // Para todos los roles (incluido admin normal):
      // El flag del usuario es el permiso. Si tiene familias asignadas para ese módulo, lo ve.
      resolvedTickets = ticketsEnabled && ticketFamilyIds.size > 0
      resolvedInventory = (inventoryEnabled || canManageInventory) && inventoryFamilyIds.size > 0
      resolvedPatrols = patrolsEnabled && patrolFamilyIds.size > 0
      // Noticias es global, no requiere familias - solo el flag del usuario
      resolvedNews = newsEnabled
    }

    return {
      tickets: resolvedTickets,
      inventory: resolvedInventory,
      patrols: resolvedPatrols,
      news: resolvedNews,
      families: enrichedFamilies,
    }
  })

  return NextResponse.json(result)
}

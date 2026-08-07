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
  let canManageNews = false
  let formsEnabled = false
  let canManageForms = false
  let canRequestAssets = false
  let credentialsEnabled = false
  let canManageCredentials = false

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
        canManageNews: true,
        formsEnabled: true,
        canManageForms: true,
        canRequestAssets: true,
        credentialsEnabled: true,
        canManageCredentials: true,
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
    canManageNews = targetUser.canManageNews ?? false
    formsEnabled = targetUser.formsEnabled ?? false
    canManageForms = targetUser.canManageForms ?? false
    canRequestAssets = targetUser.canRequestAssets ?? false
    credentialsEnabled = targetUser.credentialsEnabled ?? false
    canManageCredentials = targetUser.canManageCredentials ?? false
  } else {
    // Cargar flags del usuario actual desde DB (la sesión puede estar desactualizada)
    const currentUser = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isSuperAdmin: true,
        ticketsEnabled: true,
        inventoryEnabled: true,
        canManageInventory: true,
        patrolsEnabled: true,
        newsEnabled: true,
        canManageNews: true,
        formsEnabled: true,
        canManageForms: true,
        canRequestAssets: true,
        credentialsEnabled: true,
        canManageCredentials: true,
      },
    })
    if (currentUser) {
      role = currentUser.role
      isSuperAdmin = currentUser.isSuperAdmin ?? false
      ticketsEnabled = currentUser.ticketsEnabled ?? true
      inventoryEnabled = currentUser.inventoryEnabled ?? false
      canManageInventory = currentUser.canManageInventory ?? false
      patrolsEnabled = currentUser.patrolsEnabled ?? false
      newsEnabled = currentUser.newsEnabled ?? false
      canManageNews = currentUser.canManageNews ?? false
      formsEnabled = currentUser.formsEnabled ?? false
      canManageForms = currentUser.canManageForms ?? false
      canRequestAssets = currentUser.canRequestAssets ?? false
      credentialsEnabled = currentUser.credentialsEnabled ?? false
      canManageCredentials = currentUser.canManageCredentials ?? false
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
    const { getUserModuleFamilyGrantIds, isUserModuleAccessInitialized } =
      await import('@/lib/auth/user-family-access')
    const { getNativeFamilyId } = await import('@/lib/auth/family-scope')

    // Obtener familias del usuario vía capa unificada (+ reglas legacy de admin vacío)
    let familyIds: string[] = []
    const nativeFamilyId = await getNativeFamilyId(userId)

    if (role === 'ADMIN') {
      if (isSuperAdmin) {
        const all = await prisma.families.findMany({
          where: { isActive: true },
          select: { id: true },
        })
        familyIds = all.map(f => f.id)
      } else {
        const ticketGrants = await getUserModuleFamilyGrantIds(userId, 'tickets')
        const ticketsInitialized = await isUserModuleAccessInitialized(userId, 'tickets')
        // Sin asignaciones (ni legacy ni unificado) → acceso total (admin legacy)
        if (!ticketsInitialized && ticketGrants.length === 0) {
          const all = await prisma.families.findMany({
            where: { isActive: true },
            select: { id: true },
          })
          familyIds = all.map(f => f.id)
        } else {
          familyIds = [...ticketGrants]
        }
      }
    } else if (role === 'TECHNICIAN') {
      familyIds = await getUserModuleFamilyGrantIds(userId, 'tickets')
      if (canManageInventory) {
        const invIds = await getUserModuleFamilyGrantIds(userId, 'inventory')
        familyIds = [...new Set([...familyIds, ...invIds])]
      }
      if (patrolsEnabled) {
        const patrolIds = await getUserModuleFamilyGrantIds(userId, 'patrols')
        familyIds = [...new Set([...familyIds, ...patrolIds])]
      }
      if (credentialsEnabled || canManageCredentials) {
        const { getCredentialsFamilyScopeIds } = await import('@/lib/credentials/access')
        const credIds = await getCredentialsFamilyScopeIds(userId)
        familyIds = [...new Set([...familyIds, ...credIds])]
      }
    } else if (role === 'CLIENT') {
      const explicitIds = await getUserModuleFamilyGrantIds(userId, 'tickets')

      if (canManageInventory) {
        const invIds = await getUserModuleFamilyGrantIds(userId, 'inventory')
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

      if (patrolsEnabled) {
        const patrolIds = await getUserModuleFamilyGrantIds(userId, 'patrols')
        familyIds = [...new Set([...familyIds, ...patrolIds])]
      }
      if (credentialsEnabled || canManageCredentials) {
        const { getCredentialsFamilyScopeIds } = await import('@/lib/credentials/access')
        const credIds = await getCredentialsFamilyScopeIds(userId)
        familyIds = [...new Set([...familyIds, ...credIds])]
      }
    }

    // Familia nativa (Super Admin ya tiene todas)
    if (
      !(role === 'ADMIN' && isSuperAdmin) &&
      nativeFamilyId &&
      !familyIds.includes(nativeFamilyId)
    ) {
      familyIds = [...familyIds, nativeFamilyId]
    }

    if (familyIds.length === 0) {
      // Super Admin sin familias: acceso total
      if (role === 'ADMIN' && isSuperAdmin) {
        return {
          tickets: true,
          inventory: true,
          patrols: true,
          news: true,
          canManageNews: true,
          forms: true,
          canManageForms: true,
          canRequestAssets: false,
          canManageInventory: true,
          credentials: true,
          canManageCredentials: true,
          families: [],
        }
      }
      // Admin normal sin familias asignadas: respetar flags del usuario
      if (role === 'ADMIN') {
        return {
          tickets: ticketsEnabled,
          inventory: inventoryEnabled || canManageInventory,
          patrols: patrolsEnabled,
          news: newsEnabled,
          canManageNews: true,
          forms: formsEnabled,
          canManageForms: true,
          canRequestAssets: false,
          canManageInventory: true,
          credentials: credentialsEnabled || canManageCredentials,
          canManageCredentials,
          families: [],
        }
      }
      // Para técnicos y clientes sin familias: respetar los flags del usuario
      return {
        tickets: ticketsEnabled,
        inventory: inventoryEnabled || canManageInventory,
        patrols: patrolsEnabled,
        news: newsEnabled,
        canManageNews,
        forms: formsEnabled,
        canManageForms,
        canRequestAssets,
        canManageInventory,
        credentials: credentialsEnabled || canManageCredentials,
        canManageCredentials,
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

    // Asignaciones por módulo (capa unificada)
    const ticketFamilyIds: Set<string> = new Set()
    const inventoryFamilyIds: Set<string> = new Set()
    const patrolFamilyIds: Set<string> = new Set()
    const credentialsFamilyIds: Set<string> = new Set()

    if (isSuperAdmin) {
      const allActive = await prisma.families.findMany({
        where: { isActive: true },
        select: { id: true },
      })
      allActive.forEach(f => {
        ticketFamilyIds.add(f.id)
        inventoryFamilyIds.add(f.id)
        patrolFamilyIds.add(f.id)
        credentialsFamilyIds.add(f.id)
      })
    } else {
      const ticketGrants = await getUserModuleFamilyGrantIds(userId, 'tickets')
      ticketGrants.forEach(id => ticketFamilyIds.add(id))

      if (inventoryEnabled || canManageInventory) {
        const invGrants = await getUserModuleFamilyGrantIds(userId, 'inventory')
        invGrants.forEach(id => inventoryFamilyIds.add(id))
      }
      if (patrolsEnabled) {
        const patrolGrants = await getUserModuleFamilyGrantIds(userId, 'patrols')
        patrolGrants.forEach(id => patrolFamilyIds.add(id))
      }
      if (credentialsEnabled || canManageCredentials) {
        const { getCredentialsFamilyScopeIds } = await import('@/lib/credentials/access')
        const credScope = await getCredentialsFamilyScopeIds(userId)
        credScope.forEach(id => credentialsFamilyIds.add(id))
      }

      if (nativeFamilyId) {
        if (ticketsEnabled) ticketFamilyIds.add(nativeFamilyId)
        if (inventoryEnabled || canManageInventory) inventoryFamilyIds.add(nativeFamilyId)
        if (patrolsEnabled) patrolFamilyIds.add(nativeFamilyId)
        if (credentialsEnabled || canManageCredentials) credentialsFamilyIds.add(nativeFamilyId)
      }
    }

    // Cargar TODAS las familias que el usuario tiene en cualquier módulo
    const allModuleFamilyIds = [
      ...new Set([
        ...ticketFamilyIds,
        ...inventoryFamilyIds,
        ...patrolFamilyIds,
        ...credentialsFamilyIds,
      ]),
    ]
    const families =
      allModuleFamilyIds.length > 0
        ? await prisma.families.findMany({
            where: { id: { in: allModuleFamilyIds }, isActive: true },
            select: { id: true, name: true, code: true, color: true },
          })
        : []

    // Familias enriquecidas: cada familia muestra solo los módulos donde el usuario lo tiene asignado
    const enrichedFamilies = families.map(f => ({
      ...f,
      modules: {
        tickets: isSuperAdmin ? true : ticketFamilyIds.has(f.id) && ticketsEnabled,
        inventory: isSuperAdmin
          ? true
          : inventoryFamilyIds.has(f.id) && (inventoryEnabled || canManageInventory),
        patrols: isSuperAdmin ? true : patrolFamilyIds.has(f.id) && patrolsEnabled,
        news: isSuperAdmin ? true : newsEnabled,
        forms: isSuperAdmin ? true : formsEnabled,
        credentials: isSuperAdmin
          ? true
          : credentialsFamilyIds.has(f.id) && (credentialsEnabled || canManageCredentials),
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
    let resolvedForms: boolean
    let resolvedCredentials: boolean

    if (role === 'ADMIN' && isSuperAdmin) {
      resolvedTickets = true
      resolvedInventory = true
      resolvedPatrols = true
      resolvedNews = true
      resolvedForms = true
      resolvedCredentials = true
    } else if (role === 'CLIENT') {
      // Para CLIENT: el flag del usuario es suficiente para mostrar el módulo.
      // No bloqueamos por falta de familias — el usuario verá el módulo vacío
      // si aún no tiene asignaciones, lo cual es UX correcta.
      resolvedTickets = ticketsEnabled
      resolvedInventory = inventoryEnabled || canManageInventory
      resolvedPatrols = patrolsEnabled
      // Si puede gestionar noticias, también puede verlas (canManageNews implica newsEnabled)
      resolvedNews = newsEnabled || canManageNews
      resolvedForms = formsEnabled
      resolvedCredentials = credentialsEnabled || canManageCredentials
    } else {
      // ADMIN normal y TECHNICIAN: requieren al menos una familia activa en el módulo.
      // canRequestAssets basta para mostrar Inventario (menú de solicitudes de compras).
      resolvedTickets = ticketsEnabled && ticketFamilyIds.size > 0
      resolvedInventory =
        ((inventoryEnabled || canManageInventory) && inventoryFamilyIds.size > 0) ||
        (!!canRequestAssets && inventoryEnabled)
      resolvedPatrols = patrolsEnabled && patrolFamilyIds.size > 0
      // Noticias y Formularios son globales, no requieren familias - solo el flag del usuario
      // Si puede gestionar noticias, también puede verlas (canManageNews implica newsEnabled)
      resolvedNews = newsEnabled || canManageNews
      resolvedForms = formsEnabled
      // Credenciales: módulo ON basta (bóveda personal). Familias amplían áreas.
      resolvedCredentials = credentialsEnabled || canManageCredentials
    }

    return {
      tickets: resolvedTickets,
      inventory: resolvedInventory,
      patrols: resolvedPatrols,
      news: resolvedNews,
      canManageNews: role === 'ADMIN' ? true : canManageNews,
      forms: resolvedForms,
      canManageForms: role === 'ADMIN' ? true : canManageForms,
      canRequestAssets: role === 'ADMIN' ? false : canRequestAssets,
      canManageInventory: role === 'ADMIN' ? true : canManageInventory,
      credentials: resolvedCredentials,
      // Ver inferiores: flag explícito; no forzar true en ADMIN
      canManageCredentials,
      families: enrichedFamilies,
    }
  })

  return NextResponse.json(result)
}

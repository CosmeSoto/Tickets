import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FamilyService } from '@/lib/services/family.service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

// GET /api/families — Lista familias; ADMIN ve todas las suyas, otros roles ven las habilitadas para tickets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    // asClient=true: familias donde el usuario puede SOLICITAR tickets (scope consumer)
    // Útil para TECHNICIAN y ADMIN cuando crean tickets propios
    const asClient = searchParams.get('asClient') === 'true'
    // forClientId: permite a ADMIN obtener las familias de un cliente específico
    const forClientId = searchParams.get('forClientId') || null

    // ── asClient: cualquier rol actuando como cliente ───────────────────────
    if (asClient && session.user.role !== 'CLIENT') {
      const isSuperAdmin = !!(session.user as any).isSuperAdmin
      const targetId = session.user.role === 'ADMIN' && forClientId ? forClientId : session.user.id

      const targetUser = await prisma.users.findUnique({
        where: { id: targetId },
        select: { role: true, departments: { select: { familyId: true } } },
      })
      const targetRole = forClientId ? (targetUser?.role ?? 'CLIENT') : session.user.role
      const userFamilyId = targetUser?.departments?.familyId ?? null

      // Super Admin creando ticket (propio o para otro): todas las áreas con tickets
      // habilitados. El scope consumer del target no aplica — puede enrutar a cualquier familia.
      if (session.user.role === 'ADMIN' && isSuperAdmin) {
        const families = (await (prisma.families.findMany as any)({
          where: {
            isActive: true,
            ticketFamilyConfig: { ticketsEnabled: true },
          },
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
            icon: true,
            description: true,
            isActive: true,
            ticketFamilyConfig: { select: { ticketsEnabled: true, allowedFromFamilies: true } },
          },
          orderBy: { order: 'asc' },
        })) as any[]

        return NextResponse.json({
          success: true,
          data: families.map((f: any) => ({
            ...f,
            isOwnFamily: f.id === userFamilyId,
            isRestricted: (f.ticketFamilyConfig?.allowedFromFamilies ?? []).length > 0,
          })),
        })
      }

      const { getTicketConsumerFamilyIds } = await import('@/lib/auth/family-scope')
      const consumerIds = await getTicketConsumerFamilyIds(targetId, targetRole, false)

      const allowedFamilyIds = new Set(consumerIds ?? [])

      // Admin Normal con forClientId: intersectar con familias donde el admin puede CREAR
      // (consumer = nativa + asignadas), no con cola operativa
      if (forClientId && session.user.role === 'ADMIN') {
        const { getTicketConsumerFamilyIds } = await import('@/lib/auth/family-scope')
        const adminConsumer = await getTicketConsumerFamilyIds(session.user.id, 'ADMIN', false)
        if (adminConsumer) {
          for (const fId of [...allowedFamilyIds]) {
            if (!adminConsumer.includes(fId)) allowedFamilyIds.delete(fId)
          }
        }
      }

      if (allowedFamilyIds.size === 0) {
        return NextResponse.json({ success: true, data: [] })
      }

      const families = (await (prisma.families.findMany as any)({
        where: {
          id: { in: Array.from(allowedFamilyIds) },
          isActive: true,
          ticketFamilyConfig: { ticketsEnabled: true },
        },
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          icon: true,
          description: true,
          isActive: true,
          ticketFamilyConfig: { select: { ticketsEnabled: true, allowedFromFamilies: true } },
        },
        orderBy: { order: 'asc' },
      })) as any[]

      return NextResponse.json({
        success: true,
        data: families.map((f: any) => ({
          ...f,
          isOwnFamily: f.id === userFamilyId,
          isRestricted: (f.ticketFamilyConfig?.allowedFromFamilies ?? []).length > 0,
        })),
      })
    }

    // ── Clientes: solo las familias explícitamente asignadas ────────────────
    if (session.user.role === 'CLIENT') {
      // Excepción: usuarios con newsEnabled y scope=all pueden ver todas las familias (para gestión de noticias)
      const scopeAll = searchParams.get('scope') === 'all'
      if (scopeAll) {
        const clientUser = await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { newsEnabled: true },
        })
        if (clientUser?.newsEnabled) {
          // Devolver todas las familias activas (igual que un admin)
          const allFamilies = await FamilyService.findAll(false)
          return NextResponse.json({ success: true, data: allFamilies })
        }
      }

      const [user, clientAssignments] = await Promise.all([
        prisma.users.findUnique({
          where: { id: session.user.id },
          select: { departments: { select: { familyId: true } } },
        }),
        prisma.client_family_assignments.findMany({
          where: { clientId: session.user.id, isActive: true },
          select: { familyId: true },
        }),
      ])

      const userFamilyId = user?.departments?.familyId ?? null

      // Construir el conjunto de familias permitidas:
      // la familia nativa del departamento + las asignaciones explícitas
      const allowedFamilyIds = new Set<string>(clientAssignments.map(a => a.familyId))
      if (userFamilyId) allowedFamilyIds.add(userFamilyId)

      if (allowedFamilyIds.size === 0) {
        return NextResponse.json({ success: true, data: [] })
      }

      const families = (await (prisma.families.findMany as any)({
        where: {
          id: { in: Array.from(allowedFamilyIds) },
          isActive: true,
          ticketFamilyConfig: { ticketsEnabled: true },
        },
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          icon: true,
          description: true,
          isActive: true,
          ticketFamilyConfig: { select: { ticketsEnabled: true, allowedFromFamilies: true } },
        },
        orderBy: { order: 'asc' },
      })) as any[]

      return NextResponse.json({
        success: true,
        data: families.map((f: any) => ({
          ...f,
          isOwnFamily: f.id === userFamilyId,
          isRestricted: (f.ticketFamilyConfig?.allowedFromFamilies ?? []).length > 0,
        })),
      })
    }

    // ── Técnicos (y otros no-ADMIN): familias consumer de tickets ────────────
    if (session.user.role !== 'ADMIN') {
      // Excepción: usuarios con newsEnabled y scope=all pueden ver todas las familias (para gestión de noticias)
      const scopeAll = searchParams.get('scope') === 'all'
      if (scopeAll) {
        const techUser = await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { newsEnabled: true },
        })
        if (techUser?.newsEnabled) {
          const allFamilies = await FamilyService.findAll(false)
          return NextResponse.json({ success: true, data: allFamilies })
        }
      }

      const { getTicketConsumerFamilyIds } = await import('@/lib/auth/family-scope')
      const consumerIds = await getTicketConsumerFamilyIds(
        session.user.id,
        session.user.role,
        false
      )

      if (!consumerIds || consumerIds.length === 0) {
        return NextResponse.json({ success: true, data: [] })
      }

      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { departments: { select: { familyId: true } } },
      })
      const userFamilyId = user?.departments?.familyId ?? null

      const families = (await (prisma.families.findMany as any)({
        where: {
          id: { in: consumerIds },
          isActive: true,
          ticketFamilyConfig: { ticketsEnabled: true },
        },
        select: {
          id: true,
          name: true,
          code: true,
          color: true,
          icon: true,
          description: true,
          isActive: true,
          ticketFamilyConfig: { select: { ticketsEnabled: true, allowedFromFamilies: true } },
        },
        orderBy: { order: 'asc' },
      })) as any[]

      return NextResponse.json({
        success: true,
        data: families.map((f: any) => ({
          ...f,
          isOwnFamily: f.id === userFamilyId,
          isRestricted: (f.ticketFamilyConfig?.allowedFromFamilies ?? []).length > 0,
        })),
      })
    }

    // ── ADMIN ────────────────────────────────────────────────────────────────
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        isSuperAdmin: true,
        patrolsEnabled: true,
        inventoryEnabled: true,
        canManageInventory: true,
      },
    })

    const includeAll = searchParams.get('scope') === 'all' && session.user.role === 'ADMIN'
    const moduleFilter = searchParams.get('module') // 'tickets' | 'inventory' | 'patrols' | null
    const configMode = searchParams.get('configMode') === 'true' // Si es true, no filtrar por módulo habilitado (para pantallas de configuración)
    let families = await FamilyService.findAll(includeInactive)

    // Filtrar por módulo habilitado en la familia (aplica a TODOS los roles, incluso Super Admin)
    // EXCEPTO en configMode (pantallas de configuración necesitan ver todas para activar/desactivar)
    if (!configMode) {
      if (moduleFilter === 'tickets') {
        families = families.filter((f: any) => {
          if (!f.ticketFamilyConfig) return true
          return f.ticketFamilyConfig.ticketsEnabled !== false
        })
      } else if (moduleFilter === 'inventory') {
        const invConfigs = await prisma.inventory_family_config.findMany({
          where: { inventoryEnabled: false },
          select: { familyId: true },
        })
        const disabledInvIds = new Set(invConfigs.map(c => c.familyId))
        families = families.filter((f: any) => !disabledInvIds.has(f.id))
      } else if (moduleFilter === 'patrols') {
        const patrolConfigs = await prisma.patrol_family_config.findMany({
          where: { patrolsEnabled: false },
          select: { familyId: true },
        })
        const disabledPatrolIds = new Set(patrolConfigs.map(c => c.familyId))
        families = families.filter((f: any) => !disabledPatrolIds.has(f.id))
      }
    }

    if (!currentUser?.isSuperAdmin && !includeAll) {
      try {
        const userId = session.user.id

        // Si se pide un módulo específico, filtrar por las familias de ese módulo
        if (moduleFilter === 'inventory') {
          const invAssigns = await prisma.inventory_manager_families.findMany({
            where: { managerId: userId },
            select: { familyId: true },
          })
          const nativeUser = await prisma.users.findUnique({
            where: { id: userId },
            select: { departments: { select: { familyId: true } } },
          })
          const allowedIds = new Set(invAssigns.map(a => a.familyId))
          if (nativeUser?.departments?.familyId) allowedIds.add(nativeUser.departments.familyId)
          families = families.filter(f => allowedIds.has(f.id))
        } else if (moduleFilter === 'patrols') {
          // scope=operational → solo nativa (crear/config); default = visibility (listas/reportes)
          const operateOnly = searchParams.get('scope') === 'operational'
          if (operateOnly) {
            const { getPatrolOperationalFamilyIds } = await import('@/lib/auth/family-scope')
            const operationalIds = await getPatrolOperationalFamilyIds(userId, 'ADMIN', false)
            if (!operationalIds || operationalIds.length === 0) {
              families = []
            } else {
              const allowedIds = new Set(operationalIds)
              families = families.filter(f => allowedIds.has(f.id))
            }
          } else {
            const patrolAssigns = await prisma.patrol_family_assignments.findMany({
              where: { userId, isActive: true },
              select: { familyId: true },
            })
            const nativeUser = await prisma.users.findUnique({
              where: { id: userId },
              select: { departments: { select: { familyId: true } } },
            })
            const allowedIds = new Set(patrolAssigns.map(a => a.familyId))
            if (nativeUser?.departments?.familyId) allowedIds.add(nativeUser.departments.familyId)
            families = families.filter(f => allowedIds.has(f.id))
          }
        } else if (moduleFilter === 'tickets') {
          // Módulo de tickets: usar admin_family_assignments + nativa
          const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
          const scope = await getAdminFamilyScope(userId, false)
          if (scope.familyIds && scope.familyIds.length > 0) {
            const allowedIds = new Set(scope.familyIds)
            families = families.filter(f => allowedIds.has(f.id))
          }
        } else {
          // Default (sin módulo específico): calcular Union_Scope
          // Union_Scope = General_Scope + Inventory families + Patrols families + Nativa (deduplicado)
          const { getAdminFamilyScope, getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
          const scope = await getAdminFamilyScope(userId, false)
          const inventoryFamilyIds = await getModuleFamilyIds(userId, 'inventory')
          const patrolFamilyIds = await getModuleFamilyIds(userId, 'patrols')

          // Combinar todos los IDs de familias (deduplicado)
          const unionSet = new Set<string>()
          if (scope.familyIds) {
            scope.familyIds.forEach(id => unionSet.add(id))
          }
          inventoryFamilyIds.forEach(id => unionSet.add(id))
          patrolFamilyIds.forEach(id => unionSet.add(id))

          if (unionSet.size > 0) {
            families = families.filter(f => unionSet.has(f.id))
          }
        }
      } catch {
        /* fallback seguro */
      }
    }

    return NextResponse.json({ success: true, data: families })
  } catch (error) {
    console.error('[GET /api/families]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener familias' },
      { status: 500 }
    )
  }
}

// POST /api/families — Crea una nueva familia; solo SUPER ADMIN
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      return NextResponse.json(
        { success: false, message: 'Solo el Administrador Principal puede crear familias' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, description, color, icon, order } = body

    // Validar campos requeridos
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'El campo "name" es requerido' },
        { status: 400 }
      )
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, message: 'El campo "code" es requerido' },
        { status: 400 }
      )
    }

    // Validar code: ≤10 chars alfanuméricos
    const codeClean = code.trim().toUpperCase()
    if (!/^[A-Z0-9_]{1,10}$/.test(codeClean)) {
      return NextResponse.json(
        {
          success: false,
          message: 'El código debe ser alfanumérico (A-Z, 0-9, _), máximo 10 caracteres',
        },
        { status: 400 }
      )
    }

    // Verificar unicidad del código
    const existing = await prisma.families.findUnique({ where: { code: codeClean } })
    if (existing) {
      return NextResponse.json(
        { success: false, message: `Ya existe una familia con el código "${codeClean}"` },
        { status: 400 }
      )
    }

    const family = await FamilyService.create({
      name: name.trim(),
      code: codeClean,
      description,
      color,
      icon,
      order,
    })

    await AuditServiceComplete.log({
      action: 'FAMILY_CREATED',
      entityType: 'settings',
      entityId: family.id,
      userId: session.user.id,
      details: { familyCode: family.code, familyName: family.name },
      request,
    })

    // Invalidar caché de familias para todos los roles
    await invalidateCache([
      'families:role=ADMIN*',
      'families:role=TECHNICIAN*',
      'families:role=CLIENT*',
    ]).catch(() => {})

    return NextResponse.json(
      { success: true, data: family, message: `Familia "${family.name}" creada exitosamente` },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/families]', error)
    return NextResponse.json({ success: false, message: 'Error al crear familia' }, { status: 500 })
  }
}

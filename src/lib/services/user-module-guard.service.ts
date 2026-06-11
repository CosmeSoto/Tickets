/**
 * UserModuleGuardService
 *
 * Valida que un usuario no tenga trabajo activo antes de:
 * 1. Desactivar un módulo (flag true → false)
 * 2. Cambiar de rol (TECHNICIAN → CLIENT, ADMIN → TECHNICIAN, etc.)
 *
 * Cada módulo tiene sus propias condiciones de bloqueo y mensajes
 * explícitos que indican qué debe resolver el admin antes de
 * proceder.
 */

import prisma from '@/lib/prisma'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface ModuleBlocker {
  module: string
  count: number
  /** Mensaje corto para el toast/header del error */
  reason: string
  /** Instrucciones detalladas de qué hacer antes de desactivar */
  instructions: string[]
}

export class ModuleDisableBlockedError extends Error {
  constructor(
    public readonly blockers: ModuleBlocker[],
    public readonly userId: string,
    public readonly userName: string,
    public readonly context: 'module' | 'role' = 'module'
  ) {
    super(blockers.map(b => `[${b.module}] ${b.reason} (${b.count})`).join(' | '))
    this.name = 'ModuleDisableBlockedError'
  }
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Pluraliza una palabra según el conteo */
function p(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural
}

/**
 * Revisa tickets activos asignados al usuario como técnico.
 */
async function checkAssignedTickets(userId: string): Promise<ModuleBlocker[]> {
  const blockers: ModuleBlocker[] = []
  const assignedOpen = await prisma.tickets.count({
    where: { assigneeId: userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  })
  if (assignedOpen > 0) {
    blockers.push({
      module: 'Tickets',
      count: assignedOpen,
      reason: `Tiene ${assignedOpen} ${p(assignedOpen, 'ticket activo asignado', 'tickets activos asignados')}`,
      instructions: [
        `Reasignar o cerrar los ${assignedOpen} ${p(assignedOpen, 'ticket', 'tickets')} asignados (estado Abierto o En Progreso).`,
        'Ir a Tickets → filtrar por este agente → reasignar a otro técnico o marcar como Resuelto.',
      ],
    })
  }
  return blockers
}

/**
 * Revisa tickets abiertos creados por el usuario como cliente.
 */
async function checkClientTickets(userId: string): Promise<ModuleBlocker[]> {
  const blockers: ModuleBlocker[] = []
  const createdOpen = await prisma.tickets.count({
    where: { clientId: userId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  })
  if (createdOpen > 0) {
    blockers.push({
      module: 'Tickets',
      count: createdOpen,
      reason: `Tiene ${createdOpen} ${p(createdOpen, 'ticket abierto como solicitante', 'tickets abiertos como solicitante')}`,
      instructions: [
        `Cerrar o resolver los ${createdOpen} ${p(createdOpen, 'ticket', 'tickets')} que este usuario creó y aún están activos.`,
        'Ir a Tickets → filtrar por solicitante → cambiar estado a Resuelto o Cerrado.',
      ],
    })
  }
  return blockers
}

/**
 * Revisa equipos de inventario activos asignados al usuario.
 */
async function checkInventoryAssignments(userId: string): Promise<ModuleBlocker[]> {
  const blockers: ModuleBlocker[] = []
  const active = await prisma.equipment_assignments.count({
    where: { receiverId: userId, isActive: true },
  })
  if (active > 0) {
    blockers.push({
      module: 'Inventario',
      count: active,
      reason: `Tiene ${active} ${p(active, 'equipo asignado activo', 'equipos asignados activos')}`,
      instructions: [
        `Generar acta de devolución para los ${active} ${p(active, 'equipo', 'equipos')} que tiene asignados.`,
        'Ir a Inventario → buscar equipos de este usuario → Devolver → generar acta de devolución.',
        'El equipo debe quedar en estado Disponible antes de proceder.',
      ],
    })
  }
  return blockers
}

/**
 * Revisa solicitudes de activos pendientes del usuario.
 */
async function checkAssetRequests(userId: string): Promise<ModuleBlocker[]> {
  const blockers: ModuleBlocker[] = []
  const pending = await prisma.asset_requests.count({
    where: { requesterId: userId, status: { in: ['PENDING', 'APPROVED'] } },
  })
  if (pending > 0) {
    blockers.push({
      module: 'Solicitudes de Activos',
      count: pending,
      reason: `Tiene ${pending} ${p(pending, 'solicitud de activo pendiente', 'solicitudes de activos pendientes')}`,
      instructions: [
        `Resolver las ${pending} ${p(pending, 'solicitud pendiente', 'solicitudes pendientes')} antes de proceder.`,
        'Ir a Inventario → Solicitudes de Activos → aprobar, rechazar o cancelar las solicitudes activas.',
      ],
    })
  }
  return blockers
}

/**
 * Revisa programaciones de ronda activas y rondas en progreso del usuario.
 */
async function checkPatrols(userId: string): Promise<ModuleBlocker[]> {
  const blockers: ModuleBlocker[] = []
  const activeSchedules = await prisma.patrol_schedules.count({
    where: { agentId: userId, isActive: true },
  })
  if (activeSchedules > 0) {
    blockers.push({
      module: 'Rondas y Patrullajes',
      count: activeSchedules,
      reason: `Tiene ${activeSchedules} ${p(activeSchedules, 'programación de ronda activa', 'programaciones de ronda activas')}`,
      instructions: [
        `Desactivar o reasignar las ${activeSchedules} ${p(activeSchedules, 'programación de ronda', 'programaciones de ronda')} asignadas a este agente.`,
        'Ir a Rondas → Programación → seleccionar las programaciones de este agente → Desactivar o cambiar el agente asignado.',
      ],
    })
  }
  const activePatrols = await prisma.patrols.count({
    where: { agentId: userId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  })
  if (activePatrols > 0) {
    blockers.push({
      module: 'Rondas y Patrullajes',
      count: activePatrols,
      reason: `Tiene ${activePatrols} ${p(activePatrols, 'ronda pendiente o en progreso', 'rondas pendientes o en progreso')}`,
      instructions: [
        `Hay ${activePatrols} ${p(activePatrols, 'ronda activa', 'rondas activas')} asignadas a este agente.`,
        'Ir a Rondas → Historial → filtrar por este agente → marcar las rondas pendientes como Omitidas o reasignar.',
        'Primero desactiva las programaciones para que no se generen nuevas rondas.',
      ],
    })
  }
  return blockers
}

/**
 * Revisa asignaciones de categorías de técnico activas.
 */
async function checkTechnicianAssignments(userId: string): Promise<ModuleBlocker[]> {
  const blockers: ModuleBlocker[] = []
  const active = await prisma.technician_assignments.count({
    where: { technicianId: userId, isActive: true },
  })
  if (active > 0) {
    blockers.push({
      module: 'Asignaciones de Categorías',
      count: active,
      reason: `Tiene ${active} ${p(active, 'asignación de categoría activa', 'asignaciones de categorías activas')}`,
      instructions: [
        `Eliminar las ${active} ${p(active, 'asignación de categoría', 'asignaciones de categorías')} antes de cambiar el rol.`,
        'Ir a Gestión de Usuarios → editar este técnico → sección Categorías → eliminar todas las asignaciones.',
      ],
    })
  }
  return blockers
}

// ── Servicio ─────────────────────────────────────────────────────────────────

export class UserModuleGuardService {
  /**
   * Recibe los flags actuales y los nuevos, detecta cuáles pasan de
   * true → false y valida si el usuario tiene trabajo pendiente para
   * cada uno. Lanza ModuleDisableBlockedError si hay bloqueos.
   */
  static async assertCanDisableModules(params: {
    userId: string
    userName: string
    current: ModuleFlags
    incoming: Partial<ModuleFlags>
  }): Promise<void> {
    const { userId, userName, current, incoming } = params

    // Detectar qué flags se están desactivando
    const disabling: (keyof ModuleFlags)[] = []
    for (const key of MODULE_FLAG_KEYS) {
      const prev = current[key] ?? false
      const next = incoming[key]
      if (next !== undefined && prev === true && next === false) {
        disabling.push(key)
      }
    }

    if (disabling.length === 0) return

    const blockers: ModuleBlocker[] = []

    if (disabling.includes('ticketsEnabled')) {
      blockers.push(...(await checkAssignedTickets(userId)))
      blockers.push(...(await checkClientTickets(userId)))
    }

    if (disabling.includes('inventoryEnabled') || disabling.includes('canManageInventory')) {
      blockers.push(...(await checkInventoryAssignments(userId)))
    }

    if (disabling.includes('canRequestAssets')) {
      blockers.push(...(await checkAssetRequests(userId)))
    }

    if (disabling.includes('patrolsEnabled')) {
      blockers.push(...(await checkPatrols(userId)))
    }

    if (blockers.length > 0) {
      throw new ModuleDisableBlockedError(blockers, userId, userName, 'module')
    }
  }

  /**
   * Valida que el usuario no tenga trabajo activo en ningún módulo habilitado
   * antes de permitir un cambio de rol. Aplica cuando el rol cambia a cualquier
   * dirección (ej. TECHNICIAN → CLIENT, ADMIN → TECHNICIAN).
   *
   * Las reglas son más amplias que la desactivación de módulos individuales:
   * se revisan TODOS los módulos activos del usuario, ya que un cambio de rol
   * implica que perderá capacidades en todos ellos.
   */
  static async assertCanChangeRole(params: {
    userId: string
    userName: string
    currentRole: string
    newRole: string
  }): Promise<void> {
    const { userId, userName, currentRole, newRole } = params

    if (currentRole === newRole) return

    const blockers: ModuleBlocker[] = []

    // Cargar flags actuales del usuario directamente desde BD
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        ticketsEnabled: true,
        inventoryEnabled: true,
        canManageInventory: true,
        patrolsEnabled: true,
        newsEnabled: true,
        canRequestAssets: true,
      },
    })

    if (!user) return

    // ── Tickets ───────────────────────────────────────────────────────────────
    // Técnico con tickets asignados no puede cambiar de rol
    if (currentRole === 'TECHNICIAN' || currentRole === 'ADMIN') {
      blockers.push(...(await checkAssignedTickets(userId)))
    }
    // Cliente con tickets abiertos no puede cambiar de rol
    if (currentRole === 'CLIENT' || (user.ticketsEnabled && currentRole !== 'ADMIN')) {
      const clientBlockers = await checkClientTickets(userId)
      // Solo agregar si no hay un bloqueador de tickets ya registrado con la misma razón
      for (const b of clientBlockers) {
        if (
          !blockers.some(existing => existing.module === b.module && existing.reason === b.reason)
        ) {
          blockers.push(b)
        }
      }
    }

    // ── Inventario ────────────────────────────────────────────────────────────
    if (user.inventoryEnabled || user.canManageInventory) {
      blockers.push(...(await checkInventoryAssignments(userId)))
    }

    // ── Solicitudes de activos ────────────────────────────────────────────────
    if (user.canRequestAssets) {
      blockers.push(...(await checkAssetRequests(userId)))
    }

    // ── Rondas ────────────────────────────────────────────────────────────────
    if (user.patrolsEnabled) {
      blockers.push(...(await checkPatrols(userId)))
    }

    // ── Asignaciones de categorías (solo técnicos) ────────────────────────────
    if (currentRole === 'TECHNICIAN') {
      blockers.push(...(await checkTechnicianAssignments(userId)))
    }

    if (blockers.length > 0) {
      throw new ModuleDisableBlockedError(blockers, userId, userName, 'role')
    }
  }
}

// ── Tipos auxiliares ──────────────────────────────────────────────────────────

export interface ModuleFlags {
  ticketsEnabled: boolean
  inventoryEnabled: boolean
  canManageInventory: boolean
  patrolsEnabled: boolean
  newsEnabled: boolean
  formsEnabled: boolean
  canManageForms: boolean
  canRequestAssets: boolean
}

const MODULE_FLAG_KEYS: (keyof ModuleFlags)[] = [
  'ticketsEnabled',
  'inventoryEnabled',
  'canManageInventory',
  'patrolsEnabled',
  'newsEnabled',
  'formsEnabled',
  'canManageForms',
  'canRequestAssets',
]

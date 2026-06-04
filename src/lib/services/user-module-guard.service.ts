/**
 * UserModuleGuardService
 *
 * Valida que un usuario no tenga trabajo activo antes de desactivar
 * un módulo. Solo se ejecuta cuando el flag pasa de true → false.
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
    public readonly userName: string
  ) {
    super(blockers.map(b => `[${b.module}] ${b.reason} (${b.count})`).join(' | '))
    this.name = 'ModuleDisableBlockedError'
  }
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

    // ── Tickets ───────────────────────────────────────────────────────────────
    if (disabling.includes('ticketsEnabled')) {
      // Tickets asignados al usuario (como técnico/agente)
      const assignedOpen = await prisma.tickets.count({
        where: {
          assigneeId: userId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })
      if (assignedOpen > 0) {
        blockers.push({
          module: 'Tickets',
          count: assignedOpen,
          reason: `Tiene ${assignedOpen} ticket${assignedOpen > 1 ? 's' : ''} activo${assignedOpen > 1 ? 's' : ''} asignado${assignedOpen > 1 ? 's' : ''}`,
          instructions: [
            `Reasignar o cerrar los ${assignedOpen} ticket${assignedOpen > 1 ? 's' : ''} que tiene asignados (estado Abierto o En Progreso).`,
            'Ir a Tickets → filtrar por este agente → reasignar a otro técnico o marcar como Resuelto.',
          ],
        })
      }

      // Tickets creados por el usuario que siguen abiertos (rol cliente)
      const createdOpen = await prisma.tickets.count({
        where: {
          clientId: userId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })
      if (createdOpen > 0) {
        blockers.push({
          module: 'Tickets',
          count: createdOpen,
          reason: `Tiene ${createdOpen} ticket${createdOpen > 1 ? 's' : ''} abierto${createdOpen > 1 ? 's' : ''} como solicitante`,
          instructions: [
            `Cerrar o resolver los ${createdOpen} ticket${createdOpen > 1 ? 's' : ''} que este usuario creó y aún están activos.`,
            'Ir a Tickets → filtrar por solicitante → cambiar estado a Resuelto o Cerrado.',
          ],
        })
      }
    }

    // ── Inventario ────────────────────────────────────────────────────────────
    if (disabling.includes('inventoryEnabled') || disabling.includes('canManageInventory')) {
      const activeAssignments = await prisma.equipment_assignments.count({
        where: {
          receiverId: userId,
          isActive: true,
        },
      })
      if (activeAssignments > 0) {
        blockers.push({
          module: 'Inventario',
          count: activeAssignments,
          reason: `Tiene ${activeAssignments} equipo${activeAssignments > 1 ? 's' : ''} asignado${activeAssignments > 1 ? 's' : ''} activo${activeAssignments > 1 ? 's' : ''}`,
          instructions: [
            `Generar acta de devolución para los ${activeAssignments} equipo${activeAssignments > 1 ? 's' : ''} que tiene asignados.`,
            'Ir a Inventario → buscar equipos de este usuario → Devolver → generar acta de devolución.',
            'El equipo debe quedar en estado Disponible antes de desactivar el módulo.',
          ],
        })
      }
    }

    // ── Solicitudes de activos ────────────────────────────────────────────────
    if (disabling.includes('canRequestAssets')) {
      const pendingRequests = await prisma.asset_requests.count({
        where: {
          requesterId: userId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      })
      if (pendingRequests > 0) {
        blockers.push({
          module: 'Solicitudes de Activos',
          count: pendingRequests,
          reason: `Tiene ${pendingRequests} solicitud${pendingRequests > 1 ? 'es' : ''} de activo${pendingRequests > 1 ? 's' : ''} pendiente${pendingRequests > 1 ? 's' : ''}`,
          instructions: [
            `Resolver las ${pendingRequests} solicitud${pendingRequests > 1 ? 'es' : ''} pendiente${pendingRequests > 1 ? 's' : ''} antes de retirar el permiso.`,
            'Ir a Inventario → Solicitudes de Activos → aprobar, rechazar o cancelar las solicitudes activas.',
          ],
        })
      }
    }

    // ── Rondas y Patrullajes ──────────────────────────────────────────────────
    if (disabling.includes('patrolsEnabled')) {
      // Programaciones activas con rondas futuras
      const activeSchedules = await prisma.patrol_schedules.count({
        where: {
          agentId: userId,
          isActive: true,
        },
      })
      if (activeSchedules > 0) {
        blockers.push({
          module: 'Rondas y Patrullajes',
          count: activeSchedules,
          reason: `Tiene ${activeSchedules} programación${activeSchedules > 1 ? 'es' : ''} de ronda activa${activeSchedules > 1 ? 's' : ''}`,
          instructions: [
            `Desactivar o reasignar las ${activeSchedules} programación${activeSchedules > 1 ? 'es' : ''} de ronda asignadas a este agente.`,
            'Ir a Rondas → Programación → seleccionar las programaciones de este agente → Desactivar o editar el agente asignado.',
          ],
        })
      }

      // Patrullas en progreso o pendientes próximas
      const activePatrols = await prisma.patrols.count({
        where: {
          agentId: userId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      })
      if (activePatrols > 0) {
        blockers.push({
          module: 'Rondas y Patrullajes',
          count: activePatrols,
          reason: `Tiene ${activePatrols} ronda${activePatrols > 1 ? 's' : ''} pendiente${activePatrols > 1 ? 's' : ''} o en progreso`,
          instructions: [
            `Hay ${activePatrols} ronda${activePatrols > 1 ? 's' : ''} activa${activePatrols > 1 ? 's' : ''} asignadas a este agente.`,
            'Ir a Rondas → Historial → filtrar por este agente → marcar las rondas pendientes como Omitidas o reasignar.',
            'Primero desactiva las programaciones para que no se generen nuevas rondas.',
          ],
        })
      }
    }

    // ── Documentos — solo canManageForms, sin bloqueo duro ───────────────────
    // News y Forms (solo lectura) no tienen trabajo activo bloqueante

    if (blockers.length > 0) {
      throw new ModuleDisableBlockedError(blockers, userId, userName)
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

/**
 * Mensajes del ciclo de vida de configuración de rondas (client-safe).
 * Orden obligatorio: Programaciones → Rutas → Checkpoints
 */

export const PATROL_CONFIG_CYCLE = 'Ciclo: Programaciones → Rutas → Checkpoints'

export type PatrolLifecycleConflictPayload = {
  code?: string
  error?: string
  routes?: string[]
  routeCount?: number
  scheduleCount?: number
  schedules?: string[]
  patrolCount?: number
  checkInCount?: number
  incidentCount?: number
  patrolHistoryCount?: number
}

export function formatPatrolLifecycleConflict(
  payload: PatrolLifecycleConflictPayload,
  action: 'desactivar' | 'eliminar' = 'desactivar'
): { title: string; description: string } {
  const code = payload.code ?? ''

  switch (code) {
    case 'CHECKPOINT_IN_ACTIVE_ROUTES':
    case 'CHECKPOINT_IN_USE': {
      const routesLabel =
        Array.isArray(payload.routes) && payload.routes.length > 0
          ? payload.routes.join(', ')
          : 'una o más rutas'
      return {
        title: `No se puede ${action} el checkpoint`,
        description: `Está en uso en rutas activas: ${routesLabel}. Primero ve a Rutas, quítalo o desactiva esas rutas. ${PATROL_CONFIG_CYCLE}.`,
      }
    }
    case 'CHECKPOINT_HAS_HISTORY':
    case 'CHECKPOINT_HAS_DEPENDENCIES':
      return {
        title: 'No se puede eliminar el checkpoint',
        description: `Tiene historial de check-ins o incidencias. Usa Desactivar en su lugar para preservar la auditoría. ${PATROL_CONFIG_CYCLE}.`,
      }
    case 'ROUTE_HAS_ACTIVE_SCHEDULES': {
      const schedulesLabel =
        Array.isArray(payload.schedules) && payload.schedules.length > 0
          ? payload.schedules.join(', ')
          : `${payload.scheduleCount ?? 'varias'} programación(es)`
      return {
        title: `No se puede ${action} la ruta`,
        description: `Tiene programaciones activas: ${schedulesLabel}. Primero ve a Programación y desactívalas. ${PATROL_CONFIG_CYCLE}.`,
      }
    }
    case 'ROUTE_IN_USE':
      return {
        title: `No se puede ${action} la ruta`,
        description: `Tiene ${payload.scheduleCount ?? 0} programación(es) y/o ${payload.patrolCount ?? 0} patrulla(s) asociadas. Desactiva primero las programaciones; si solo quieres sacarla de circulación, usa Desactivar. ${PATROL_CONFIG_CYCLE}.`,
      }
    case 'SCHEDULE_HAS_HISTORY':
      return {
        title: 'No se puede eliminar la programación',
        description: `Tiene historial de rondas (${payload.patrolHistoryCount ?? 0}). Usa Desactivar en su lugar. ${PATROL_CONFIG_CYCLE}.`,
      }
    default:
      return {
        title: `No se puede ${action}`,
        description:
          payload.error ??
          `Resuelve las dependencias del ciclo de configuración. ${PATROL_CONFIG_CYCLE}.`,
      }
  }
}

/**
 * Tipos unificados para preferencias de notificaciones
 * Soporta 3 niveles: básico, intermedio y avanzado
 * Aplica a todos los módulos del sistema: Tickets, Inventario, Rondas, Noticias
 */

export interface NotificationPreferences {
  // ===== NIVEL BÁSICO (Todos los roles) =====
  emailNotifications: boolean
  pushNotifications: boolean

  // ===== NIVEL INTERMEDIO (Técnicos/Admins) =====
  /** Actualizaciones generales: tickets, inventario, rondas, noticias */
  ticketUpdates: boolean
  systemAlerts: boolean
  weeklyReport: boolean

  // ===== NIVEL AVANZADO (Opcional para todos) =====
  soundEnabled: boolean
  /** Nuevos registros creados en el sistema (tickets, solicitudes, incidencias) */
  ticketCreated: boolean
  /** Asignaciones: tickets, tareas de ronda, equipos de inventario */
  ticketAssigned: boolean
  /** Cambios de estado en cualquier módulo */
  statusChanged: boolean
  /** Nuevos comentarios o notas en registros que sigues */
  newComments: boolean
  /** Actualizaciones en registros que sigues */
  ticketUpdated: boolean

  // Horarios silenciosos
  quietHours: {
    enabled: boolean
    startTime: string
    endTime: string
  }
}

export type NotificationLevel = 'basic' | 'intermediate' | 'advanced'

export interface NotificationSettingsProps {
  level: NotificationLevel
  preferences: NotificationPreferences
  onUpdate: (preferences: Partial<NotificationPreferences>) => void
  onSave: () => Promise<void>
  loading?: boolean
}

// Mapeo de campos por nivel
export const NOTIFICATION_FIELDS_BY_LEVEL: Record<
  NotificationLevel,
  (keyof NotificationPreferences | 'quietHours')[]
> = {
  basic: ['emailNotifications', 'pushNotifications', 'soundEnabled'],
  intermediate: [
    'emailNotifications',
    'pushNotifications',
    'soundEnabled',
    'ticketUpdates',
    'newComments',
    'statusChanged',
  ],
  advanced: [
    'emailNotifications',
    'pushNotifications',
    'soundEnabled',
    'ticketUpdates',
    'newComments',
    'statusChanged',
    'systemAlerts',
    'weeklyReport',
    'ticketCreated',
    'ticketAssigned',
    'ticketUpdated',
    'quietHours',
  ],
}

// Valores por defecto
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  ticketUpdates: true,
  systemAlerts: true,
  weeklyReport: false,
  soundEnabled: true,
  ticketCreated: true,
  ticketAssigned: true,
  statusChanged: true,
  newComments: true,
  ticketUpdated: true,
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
}

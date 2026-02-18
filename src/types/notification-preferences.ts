/**
 * Tipos unificados para preferencias de notificaciones
 * Soporta 3 niveles: básico, intermedio y avanzado
 */

export interface NotificationPreferences {
  // ===== NIVEL BÁSICO (Todos los roles) =====
  emailNotifications: boolean
  pushNotifications: boolean

  // ===== NIVEL INTERMEDIO (Técnicos/Admins) =====
  ticketUpdates: boolean
  systemAlerts: boolean
  weeklyReport: boolean

  // ===== NIVEL AVANZADO (Opcional para todos) =====
  soundEnabled: boolean
  ticketCreated: boolean
  ticketAssigned: boolean
  statusChanged: boolean
  newComments: boolean
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
  basic: ['emailNotifications', 'pushNotifications'],
  intermediate: [
    'emailNotifications',
    'pushNotifications',
    'ticketUpdates',
    'systemAlerts',
    'weeklyReport',
  ],
  advanced: [
    'emailNotifications',
    'pushNotifications',
    'soundEnabled',
    'ticketCreated',
    'ticketAssigned',
    'statusChanged',
    'newComments',
    'ticketUpdated',
    'ticketUpdates',
    'systemAlerts',
    'weeklyReport',
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

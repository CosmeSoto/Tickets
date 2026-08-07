/** Filtros de auditoría por área de configuración */

export type AuditConfigModule =
  | 'all'
  | 'config_all'
  | 'system'
  | 'tickets'
  | 'patrols'
  | 'inventory'
  | 'backups'
  | 'sla'

export const AUDIT_CONFIG_MODULE_OPTIONS: Array<{ value: AuditConfigModule; label: string }> = [
  { value: 'all', label: 'Todas (sin filtro config)' },
  { value: 'config_all', label: '⚙️ Todos los cambios de config' },
  { value: 'system', label: '🛠️ Sistema general' },
  { value: 'tickets', label: '🎫 Tickets (por área)' },
  { value: 'patrols', label: '🚶 Rondas (por área)' },
  { value: 'inventory', label: '📦 Inventario' },
  { value: 'backups', label: '💾 Backups' },
  { value: 'sla', label: '⏱️ SLA Tickets' },
]

const CONFIG_CHANGE_ACTIONS = [
  'settings_updated',
  'TICKET_FAMILY_CONFIG_UPDATED',
  'PATROL_FAMILY_CONFIG_UPDATED',
  'INVENTORY_FAMILY_CONFIG_UPDATED',
  'inventory_settings_updated',
  'backup_config_updated',
  'sla_policy_created',
  'sla_policy_updated',
  'sla_policy_deleted',
] as const

const MODULE_ACTIONS: Record<Exclude<AuditConfigModule, 'all'>, readonly string[]> = {
  config_all: CONFIG_CHANGE_ACTIONS,
  system: ['settings_updated'],
  tickets: ['TICKET_FAMILY_CONFIG_UPDATED'],
  patrols: ['PATROL_FAMILY_CONFIG_UPDATED'],
  inventory: ['INVENTORY_FAMILY_CONFIG_UPDATED', 'inventory_settings_updated'],
  backups: [
    'backup_config_updated',
    'backup_created',
    'backup_deleted',
    'backup_imported',
    'backup_uploaded_cloud',
    'backup_restore_started',
    'backup_restored',
    'backup_restore_failed',
  ],
  sla: ['sla_policy_created', 'sla_policy_updated', 'sla_policy_deleted'],
}

export function getActionsForConfigModule(module: AuditConfigModule): string[] | null {
  if (module === 'all') return null
  return [...MODULE_ACTIONS[module]]
}

export type AuditQuickPresetId =
  | 'config_all'
  | 'system'
  | 'tickets_config'
  | 'patrols_config'
  | 'inventory_config'
  | 'credentials'
  | 'backups'
  | 'sla'
  | 'critical'
  | 'security'

export const AUDIT_QUICK_PRESETS: Array<{
  id: AuditQuickPresetId
  label: string
  description: string
  filters: {
    configModule?: AuditConfigModule
    entityType?: string
    action?: string
    actionPreset?: string
  }
}> = [
  {
    id: 'config_all',
    label: 'Cambios de config',
    description: 'Todas las modificaciones de configuración',
    filters: { configModule: 'config_all', entityType: 'all', action: '' },
  },
  {
    id: 'system',
    label: 'Sistema',
    description: 'Configuración general del sistema',
    filters: { configModule: 'system', entityType: 'all', action: '' },
  },
  {
    id: 'tickets_config',
    label: 'Tickets',
    description: 'Config por área — tickets',
    filters: { configModule: 'tickets', entityType: 'all', action: '' },
  },
  {
    id: 'patrols_config',
    label: 'Rondas',
    description: 'Config por área — rondas',
    filters: { configModule: 'patrols', entityType: 'all', action: '' },
  },
  {
    id: 'inventory_config',
    label: 'Inventario',
    description: 'Config inventario global y por área',
    filters: { configModule: 'inventory', entityType: 'all', action: '' },
  },
  {
    id: 'credentials',
    label: 'Credenciales',
    description: 'Creación, revelado, copiado, compartidos y borrado (sin secretos en el log)',
    filters: { configModule: 'all', entityType: 'credential_entry', action: '' },
  },
  {
    id: 'backups',
    label: 'Backups',
    description: 'Config y operaciones de respaldo',
    filters: { configModule: 'backups', entityType: 'all', action: '' },
  },
  {
    id: 'sla',
    label: 'SLA',
    description: 'Políticas SLA de tickets',
    filters: { configModule: 'sla', entityType: 'all', action: '' },
  },
  {
    id: 'critical',
    label: 'Críticas',
    description: 'Eliminaciones, fallos de login, cambios de rol',
    filters: { configModule: 'all', entityType: 'all', action: '', actionPreset: 'critical' },
  },
  {
    id: 'security',
    label: 'Seguridad',
    description: 'Login, logout y contraseñas',
    filters: { configModule: 'all', entityType: 'all', action: '', actionPreset: 'security' },
  },
]

export function getConfigModuleLabel(module: AuditConfigModule): string {
  return AUDIT_CONFIG_MODULE_OPTIONS.find(o => o.value === module)?.label ?? module
}

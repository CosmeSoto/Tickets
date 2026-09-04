/** Etiquetas legibles para campos de configuración por módulo */

export const SYSTEM_SETTINGS_LABELS: Record<string, string> = {
  systemName: 'Nombre del sistema',
  systemDescription: 'Descripción del sistema',
  supportEmail: 'Email de soporte',
  maxTicketsPerUser: 'Máx. tickets por usuario',
  autoAssignmentEnabled: 'Asignación automática',
  emailEnabled: 'Email habilitado',
  smtpHost: 'Servidor SMTP',
  smtpPort: 'Puerto SMTP',
  smtpUser: 'Usuario SMTP',
  smtpPassword: 'Contraseña SMTP',
  smtpSecure: 'SMTP seguro (TLS)',
  emailFrom: 'Remitente email',
  notificationsEnabled: 'Notificaciones',
  emailNotifications: 'Notificaciones por email',
  browserNotifications: 'Notificaciones en navegador',
  sessionTimeout: 'Tiempo de sesión (min)',
  maxLoginAttempts: 'Máx. intentos de login',
  passwordMinLength: 'Longitud mínima contraseña',
  requirePasswordChange: 'Exigir cambio de contraseña',
  passwordChangeIntervalDays: 'Intervalo cambio contraseña (días)',
  maxPersonalImageSize: 'Tamaño máx. fotos personales (MB)',
  maxFileSize: 'Tamaño máx. adjuntos generales (MB)',
  autoCloseDays: 'Auto-cierre tickets (días)',
  allowedFileTypes: 'Tipos de archivo permitidos',
  backupEnabled: 'Backups automáticos',
  backupFrequency: 'Frecuencia de backup',
  backupRetention: 'Retención backup (días)',
  maintenanceMode: 'Modo mantenimiento',
  maintenanceMessage: 'Mensaje de mantenimiento',
  maintenanceAllowAdmins: 'Permitir acceso a administradores',
}

export const TICKET_FAMILY_CONFIG_LABELS: Record<string, string> = {
  ticketsEnabled: 'Tickets habilitados',
  codePrefix: 'Prefijo de código',
  isDefault: 'Área por defecto',
  autoAssignRespectsFamilies: 'Asignación respeta familias',
  alertVolumeThreshold: 'Umbral alerta volumen',
  businessHoursStart: 'Inicio horario laboral',
  businessHoursEnd: 'Fin horario laboral',
  businessDays: 'Días laborables',
  allowedFromFamilies: 'Familias permitidas (origen)',
}

export const PATROL_FAMILY_CONFIG_LABELS: Record<string, string> = {
  patrolsEnabled: 'Rondas habilitadas',
  qrWindowMinutes: 'Ventana QR (min)',
  geofenceRadiusMeters: 'Radio geocerca (m)',
  photoRetentionDays: 'Retención fotos (días)',
  photoCompressionQuality: 'Calidad compresión foto',
  photoMaxWidthPx: 'Ancho máx. foto (px)',
  requirePhotoOnStart: 'Foto obligatoria al iniciar',
  requirePhotoOnEnd: 'Foto obligatoria al finalizar',
  autoCompleteWhenAllRequired: 'Cerrar al completar puntos obligatorios',
  offlineSyncToleranceMinutes: 'Tolerancia sync offline (min)',
  alertCompletionThreshold: 'Umbral completitud alertas',
  gracePeriodMinutes: 'Período de gracia (min)',
  strictTimeValidation: 'Validación horaria estricta',
  reminderMinutesBefore: 'Recordatorio (min antes)',
  patrolIncidentCategoryId: 'Categoría de novedades',
}

export const INVENTORY_FAMILY_CONFIG_LABELS: Record<string, string> = {
  inventoryEnabled: 'Inventario habilitado',
  allowedSubtypes: 'Subtipos permitidos',
  visibleSections: 'Secciones visibles',
  requiredSections: 'Secciones obligatorias',
  sectionsByMode: 'Secciones por modo',
  requireFinancialForNew: 'Datos financieros obligatorios',
  defaultDepreciationMethod: 'Método depreciación',
  defaultUsefulLifeYears: 'Vida útil (años)',
  defaultResidualValuePct: 'Valor residual (%)',
  codePrefix: 'Prefijo de código',
  autoApproveDecommission: 'Auto-aprobar bajas',
  requireDeliveryAct: 'Acta de entrega obligatoria',
  batchUtilizationAlertEnabled: 'Alertas utilización lotes',
  batchUtilizationEmailCritical: 'Email alertas críticas lotes',
  batchUtilizationEmailWarning: 'Email alertas advertencia lotes',
  batchLowStockThresholdPct: 'Umbral stock bajo lotes (%)',
}

export const INVENTORY_GLOBAL_SETTINGS_LABELS: Record<string, string> = {
  manager_ids: 'Gestores de inventario',
  act_expiration_days: 'Expiración actas (días)',
  low_stock_alert_enabled: 'Alertas stock bajo',
  license_alert_enabled: 'Alertas licencias',
  license_alert_days_first: 'Licencias — 1ª alerta (días)',
  license_alert_days_second: 'Licencias — 2ª alerta (días)',
  mro_expiry_alert_days: 'MRO — 1ª alerta caducidad (días)',
  mro_expiry_alert_days_urgent: 'MRO — alerta urgente (días)',
  warranty_alert_days: 'Garantía — alerta (días)',
  contract_alert_days: 'Contratos — alerta (días)',
  maintenance_alert_days: 'Mantenimientos programados — ventana dashboard (días)',
  mro_expiry_alert_enabled: 'Alertas caducidad MRO',
  warranty_alert_enabled: 'Alertas garantía',
  batch_utilization_alert_enabled: 'Alertas utilización lotes',
  batch_utilization_email_critical: 'Email crítico lotes',
  batch_utilization_email_warning: 'Email advertencia lotes',
  batch_low_stock_threshold_pct: 'Umbral stock bajo lotes (%)',
  supplier_qualification_min_a: 'Calificación proveedores — mínimo Clasificación A',
  supplier_qualification_min_b: 'Calificación proveedores — mínimo Clasificación B',
}

export const ASSET_REQUEST_CONFIG_LABELS: Record<string, string> = {
  familyName: 'Área',
  assetRequestsEnabled: 'Solicitudes de compras habilitadas',
}

export const SLA_POLICY_LABELS: Record<string, string> = {
  name: 'Nombre',
  description: 'Descripción',
  priority: 'Prioridad',
  responseTimeHours: 'Tiempo respuesta (h)',
  resolutionTimeHours: 'Tiempo resolución (h)',
  businessHoursOnly: 'Solo horario laboral',
  businessHoursStart: 'Inicio horario laboral',
  businessHoursEnd: 'Fin horario laboral',
  businessDays: 'Días laborables',
  isActive: 'Activa',
  categoryId: 'Categoría',
  familyId: 'Familia',
}

const ACTION_LABEL_MAPS: Record<string, Record<string, string>> = {
  settings_updated: SYSTEM_SETTINGS_LABELS,
  system_config_updated: SYSTEM_SETTINGS_LABELS,
  TICKET_FAMILY_CONFIG_UPDATED: TICKET_FAMILY_CONFIG_LABELS,
  ticket_family_config_updated: TICKET_FAMILY_CONFIG_LABELS,
  PATROL_FAMILY_CONFIG_UPDATED: PATROL_FAMILY_CONFIG_LABELS,
  patrol_family_config_updated: PATROL_FAMILY_CONFIG_LABELS,
  INVENTORY_FAMILY_CONFIG_UPDATED: INVENTORY_FAMILY_CONFIG_LABELS,
  inventory_family_config_updated: INVENTORY_FAMILY_CONFIG_LABELS,
  inventory_settings_updated: INVENTORY_GLOBAL_SETTINGS_LABELS,
  asset_request_config_updated: ASSET_REQUEST_CONFIG_LABELS,
  sla_policy_updated: SLA_POLICY_LABELS,
  sla_policy_created: SLA_POLICY_LABELS,
  sla_policy_deleted: SLA_POLICY_LABELS,
  backup_config_updated: {},
}

const ACTION_MODULE_NAMES: Record<string, string> = {
  settings_updated: 'Sistema general',
  system_config_updated: 'Sistema general',
  TICKET_FAMILY_CONFIG_UPDATED: 'Tickets',
  ticket_family_config_updated: 'Tickets',
  PATROL_FAMILY_CONFIG_UPDATED: 'Rondas',
  patrol_family_config_updated: 'Rondas',
  INVENTORY_FAMILY_CONFIG_UPDATED: 'Inventario (por área)',
  inventory_family_config_updated: 'Inventario (por área)',
  inventory_settings_updated: 'Inventario (global)',
  asset_request_config_updated: 'Inventario (solicitudes)',
  sla_policy_updated: 'SLA Tickets',
  sla_policy_created: 'SLA Tickets',
  sla_policy_deleted: 'SLA Tickets',
  backup_config_updated: 'Backups',
}

/** Acciones que usan el diff Antes/Después en auditoría */
export const CONFIG_AUDIT_ACTIONS = new Set([
  'settings_updated',
  'backup_config_updated',
  'TICKET_FAMILY_CONFIG_UPDATED',
  'PATROL_FAMILY_CONFIG_UPDATED',
  'INVENTORY_FAMILY_CONFIG_UPDATED',
  'inventory_settings_updated',
  'asset_request_config_updated',
  'sla_policy_updated',
  'sla_policy_created',
  'sla_policy_deleted',
])

export function isConfigAuditAction(action: string): boolean {
  return CONFIG_AUDIT_ACTIONS.has(action)
}

export function getConfigAuditSummary(details: Record<string, unknown> | null | undefined): string {
  if (!details) return ''
  if (typeof details.summary === 'string' && details.summary) return details.summary
  if (details.changes && typeof details.changes === 'object' && !Array.isArray(details.changes)) {
    const labels = Object.values(details.changes as Record<string, { label?: string }>)
      .map(c => c?.label)
      .filter(Boolean)
    if (labels.length > 0) {
      return `Cambió: ${labels.slice(0, 3).join(', ')}${labels.length > 3 ? '…' : ''}`
    }
  }
  if (Array.isArray(details.updatedSettings)) {
    return `${details.updatedSettings.length} campos (registro antiguo sin diff)`
  }
  return ''
}

export function getConfigLabelMap(action: string): Record<string, string> {
  return ACTION_LABEL_MAPS[action] ?? {}
}

export function getConfigModuleName(action: string): string {
  return ACTION_MODULE_NAMES[action] ?? 'Configuración'
}

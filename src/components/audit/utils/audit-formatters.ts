/**
 * Formatting utilities for Audit module
 * All functions support dark mode with semantic color classes
 */

/**
 * Translate action codes to Spanish
 */
export function translateAction(action: string): string {
  const actionMap: Record<string, string> = {
    created: 'Creó',
    updated: 'Actualizó',
    deleted: 'Eliminó',
    login: 'Inició sesión',
    logout: 'Cerró sesión',
    login_failed: 'Intento de login fallido',
    assigned: 'Asignó',
    unassigned: 'Desasignó',
    status_changed: 'Estado cambiado',
    priority_changed: 'Prioridad cambiada',
    resolved: 'Resolvió',
    closed: 'Cerró',
    role_changed: 'Rol cambiado',
    password_changed: 'Contraseña cambiada',
    promoted: 'Promovido',
    demoted: 'Degradado',
    uploaded: 'Subido',
    downloaded: 'Descargado',
    exported: 'Exportado',
    generated: 'Generado',
    backup: 'Respaldo',
    restore: 'Restauración',
    config_changed: 'Configuración cambiada',
    // Patrullas
    reactivated: 'Reactivó',
    activated: 'Activó',
    deactivated: 'Desactivó',
    completed: 'Completó',
    missed: 'Omitió',
    escalated: 'Escaló',
  }

  for (const [key, value] of Object.entries(actionMap)) {
    if (action.toLowerCase().includes(key)) {
      return value
    }
  }

  return action
}

/**
 * Translate entity types to Spanish with icons
 */
export function translateEntityType(entityType: string): string {
  const entityMap: Record<string, string> = {
    ticket: '🎫 Ticket',
    user: '👤 Usuario',
    category: '📂 Categoría',
    department: '🏢 Departamento',
    technician: '🔧 Técnico',
    comment: '💬 Comentario',
    attachment: '📎 Archivo',
    system: '⚙️ Sistema',
    report: '📊 Reporte',
    settings: '🛠️ Configuración',
    assignment: '📌 Asignación',
    // Patrullas
    patrol: '🚶 Patrulla',
    patrol_schedule: '📅 Programación de Ronda',
    patrol_route: '🛤️ Ruta de Ronda',
    patrol_incident: '⚠️ Novedad de Ronda',
    patrol_checkpoint: '📍 Checkpoint',
    // Inventario — tipos de activo
    equipment_type: '🔧 Tipo de Equipo',
    license_type: '🪪 Tipo de Licencia',
    consumable_type: '📦 Tipo de Consumible',
    credential_entry: '🔐 Credencial',
    credential_vault: '🔐 Bóveda de credenciales',
    credential_share: '🔐 Compartido de credencial',
  }
  return entityMap[entityType.toLowerCase()] || entityType
}

/**
 * Get action badge color classes (dark mode compatible)
 */
export function getActionColor(action: string): string {
  if (action === 'TYPE_CLONED')
    return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200'
  if (action.includes('created'))
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
  if (action.includes('updated'))
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  if (action.includes('deleted')) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  if (action.includes('login'))
    return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  if (action.includes('assigned'))
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  if (action.includes('resolved') || action.includes('closed'))
    return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
  if (action.includes('reactivated') || action.includes('activated'))
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  if (action.includes('deactivated'))
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  if (action.includes('completed'))
    return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'
  if (action.includes('escalated'))
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
}

/**
 * Get role badge color classes (dark mode compatible)
 */
export function getRoleColor(role: string): string {
  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    TECHNICIAN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    CLIENT: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  }
  return roleColors[role] || ''
}

/**
 * Get role label in Spanish
 */
export function getRoleLabel(role: string): string {
  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador',
    TECHNICIAN: 'Técnico',
    CLIENT: 'Cliente',
  }
  return roleLabels[role] || role
}

/**
 * Get action label in Spanish (detailed)
 */
export function getActionLabel(action: string): string {
  const actionLabels: Record<string, string> = {
    // Backups
    backup_created: 'Respaldo Creado',
    backup_deleted: 'Respaldo Eliminado',
    backup_imported: 'Backup Importado',
    backup_uploaded_cloud: 'Backup Subido a Nube',
    backup_restore_started: 'Restauración Iniciada',
    backup_restored: 'Respaldo Restaurado',
    backup_restore_failed: 'Restauración Fallida',
    backup_config_updated: 'Config. Backups Actualizada',
    // Usuarios
    user_created: 'Usuario Creado',
    user_updated: 'Usuario Actualizado',
    user_deleted: 'Usuario Eliminado',
    user_login: 'Inicio de Sesión',
    user_logout: 'Cierre de Sesión',
    // Tickets
    ticket_created: 'Ticket Creado',
    ticket_updated: 'Ticket Actualizado',
    ticket_deleted: 'Ticket Eliminado',
    ticket_assigned: 'Ticket Asignado',
    ticket_closed: 'Ticket Cerrado',
    ticket_reopened: 'Ticket Reabierto',
    ticket_viewed: 'Ticket Visualizado',
    // Categorías
    category_created: 'Categoría Creada',
    category_updated: 'Categoría Actualizada',
    category_deleted: 'Categoría Eliminada',
    category_view: 'Categoría Visualizada',
    // Departamentos
    department_created: 'Departamento Creado',
    department_updated: 'Departamento Actualizado',
    department_deleted: 'Departamento Eliminado',
    // Artículos de conocimiento
    knowledge_article_created: 'Artículo Creado',
    knowledge_article_updated: 'Artículo Actualizado',
    knowledge_article_deleted: 'Artículo Eliminado',
    knowledge_article_published: 'Artículo Publicado',
    knowledge_article_unpublished: 'Artículo Despublicado',
    // Documentos
    form_created: 'Documento Creado',
    form_updated: 'Documento Actualizado',
    form_deleted: 'Documento Eliminado',
    // Noticias
    news_created: 'Noticia Creada',
    news_updated: 'Noticia Actualizada',
    news_deleted: 'Noticia Eliminada',
    news_published: 'Noticia Publicada',
    news_archived: 'Noticia Archivada',
    // Credenciales
    credential_created: 'Credencial Creada',
    credential_updated: 'Credencial Actualizada',
    credential_revealed: 'Credencial Revelada',
    credential_copied: 'Credencial Copiada',
    credential_deleted: 'Credencial Eliminada',
    credential_shared: 'Credencial Compartida',
    credential_share_revoked: 'Compartido de Credencial Revocado',
    credential_vault_created: 'Bóveda de Credenciales Creada',
    // Configuración
    settings_updated: 'Config. Sistema Actualizada',
    settings_viewed: 'Configuración Visualizada',
    TICKET_FAMILY_CONFIG_UPDATED: 'Config. Tickets (Área) Actualizada',
    PATROL_FAMILY_CONFIG_UPDATED: 'Config. Rondas (Área) Actualizada',
    INVENTORY_FAMILY_CONFIG_UPDATED: 'Config. Inventario (Área) Actualizada',
    inventory_settings_updated: 'Config. Inventario Global Actualizada',
    sla_policy_created: 'Política SLA Creada',
    sla_policy_updated: 'Política SLA Actualizada',
    sla_policy_deleted: 'Política SLA Eliminada',
    // Autenticación
    login: 'Inicio de Sesión',
    logout: 'Cierre de Sesión',
    password_changed: 'Contraseña Cambiada',
    password_reset: 'Contraseña Restablecida',
    // Operaciones genéricas
    CREATE: 'Creación',
    UPDATE: 'Actualización',
    DELETE: 'Eliminación',
    VIEW: 'Visualización',
    READ: 'Lectura',
    // Colaboradores
    collaborator_added: 'Colaborador Agregado',
    collaborator_removed: 'Colaborador Eliminado',
    // Familias — admin
    admin_family_assigned: 'Admin Asignado a Familia',
    admin_family_unassigned: 'Admin Desasignado de Familia',
    // Familias — técnicos, clientes y gestores
    technician_family_assigned: 'Técnico Asignado a Familia',
    technician_family_unassigned: 'Técnico Desasignado de Familia',
    client_family_assigned: 'Cliente Asignado a Familia Adicional',
    client_family_unassigned: 'Cliente Desasignado de Familia Adicional',
    manager_family_assigned: 'Gestor de Inventario Asignado a Familia',
    manager_family_unassigned: 'Gestor de Inventario Desasignado de Familia',
    // Super admin
    super_admin_granted: 'Super Admin Otorgado',
    super_admin_revoked: 'Super Admin Revocado',
    // Patrullas - Checkpoints
    PATROL_CHECKPOINT_CREATED: 'Checkpoint Creado',
    PATROL_CHECKPOINT_UPDATED: 'Checkpoint Actualizado',
    PATROL_CHECKPOINT_DELETED: 'Checkpoint Eliminado',
    PATROL_CHECKPOINT_DEACTIVATED: 'Checkpoint Desactivado',
    PATROL_CHECKPOINT_REACTIVATED: 'Checkpoint Reactivado',
    // Patrullas - Rutas
    PATROL_ROUTE_CREATED: 'Ruta de Ronda Creada',
    PATROL_ROUTE_UPDATED: 'Ruta de Ronda Actualizada',
    PATROL_ROUTE_DELETED: 'Ruta de Ronda Eliminada',
    PATROL_ROUTE_DEACTIVATED: 'Ruta de Ronda Desactivada',
    PATROL_ROUTE_REACTIVATED: 'Ruta de Ronda Reactivada',
    // Patrullas - Programaciones
    PATROL_SCHEDULE_CREATED: 'Programación de Ronda Creada',
    PATROL_SCHEDULE_UPDATED: 'Programación de Ronda Actualizada',
    PATROL_SCHEDULE_DELETED: 'Programación de Ronda Eliminada',
    PATROL_SCHEDULE_DEACTIVATED: 'Programación de Ronda Desactivada',
    PATROL_SCHEDULE_REACTIVATED: 'Programación de Ronda Reactivada',
    // Patrullas - Novedades
    PATROL_INCIDENT_CREATED: 'Novedad de Ronda Reportada',
    PATROL_INCIDENT_UPDATED: 'Novedad de Ronda Actualizada',
    PATROL_INCIDENT_DELETED: 'Novedad de Ronda Eliminada',
    PATROL_INCIDENT_RESOLVED: 'Novedad de Ronda Resuelta',
    PATROL_INCIDENT_ESCALATED: 'Novedad de Ronda Escalada',
    // Patrullas - Patrullas
    PATROL_CREATED: 'Patrulla Creada',
    PATROL_STARTED: 'Patrulla Iniciada',
    PATROL_ENDED: 'Patrulla Finalizada',
    PATROL_AUTO_COMPLETED: 'Patrulla Auto-completada',
    PATROL_FORCE_CLOSED: 'Patrulla Cerrada por Supervisor',
    PATROL_AUTO_INVALIDATED: 'Patrulla Invalidada (skips)',
    PATROL_COMPLETED: 'Patrulla Completada',
    PATROL_MISSED: 'Patrulla Omitida',
    PATROL_INCOMPLETE: 'Patrulla Incompleta',
    CREDENTIAL_CREATED: 'Credencial Creada',
    CREDENTIAL_UPDATED: 'Credencial Actualizada',
    CREDENTIAL_REVEALED: 'Credencial Revelada',
    CREDENTIAL_COPIED: 'Credencial Copiada',
    CREDENTIAL_DELETED: 'Credencial Eliminada',
    CREDENTIAL_SHARED: 'Credencial Compartida',
    CREDENTIAL_SHARE_REVOKED: 'Compartido de Credencial Revocado',
    CREDENTIAL_VAULT_CREATED: 'Bóveda de Credenciales Creada',
    // Inventario — tipos
    TYPE_CLONED: 'Tipo Copiado a Otra Área',
  }
  return actionLabels[action] || action
}

/**
 * Get entity label in Spanish (detailed)
 */
export function getEntityLabel(entityType: string): string {
  const entityLabels: Record<string, string> = {
    System: 'Sistema',
    system: 'Sistema',
    user: 'Usuarios',
    ticket: 'Tickets',
    category: 'Categorías',
    department: 'Departamentos',
    settings: 'Configuración',
    backup: 'Respaldos',
    auth: 'Autenticación',
    knowledge_article: 'Base de Conocimiento',
    form: 'Documentos',
    news: 'Noticias',
    comment: 'Comentarios',
    attachment: 'Archivos Adjuntos',
    notification: 'Notificaciones',
    sla: 'Acuerdos de Nivel de Servicio',
    report: 'Reportes',
    audit: 'Auditoría',
    // Patrullas
    patrol: 'Patrullas',
    patrol_schedule: 'Programaciones de Rondas',
    patrol_route: 'Rutas de Rondas',
    patrol_incident: 'Novedades de Rondas',
    patrol_checkpoint: 'Checkpoints',
    // Inventario — tipos de activo
    equipment_type: 'Tipos de Equipo',
    license_type: 'Tipos de Licencia',
    consumable_type: 'Tipos de Consumible',
    consumable_types: 'Tipos de Consumible',
    credential_entry: 'Credenciales',
    credential_vault: 'Credenciales',
    credential_share: 'Credenciales',
  }
  return entityLabels[entityType] || entityType
}

/**
 * Get field display name in Spanish
 */
export function getFieldDisplayName(fieldName: string): string {
  const fieldNames: Record<string, string> = {
    name: 'Nombre',
    email: 'Correo Electrónico',
    role: 'Rol',
    departmentId: 'Departamento',
    phone: 'Teléfono',
    isActive: 'Estado',
    avatar: 'Avatar',
    password: 'Contraseña',
    createdById: 'Creado por',
    assigneeId: 'Asignado a',
    ticketId: 'Ticket',
    title: 'Título',
    description: 'Descripción',
    status: 'Estado',
    priority: 'Prioridad',
    categoryId: 'Categoría',
    ticketNumber: 'Número de Ticket',
    color: 'Color',
    parentId: 'Categoría Padre',
    level: 'Nivel',
    order: 'Orden',
    createdAt: 'Fecha de Creación',
    updatedAt: 'Última Actualización',
    isEmailVerified: 'Email Verificado',
    lastLogin: 'Último Acceso',
    passwordChangedAt: 'Contraseña cambiada el',
    rentalDeliveryDate: 'Fecha de entrega (renta)',
    rentalBuyoutValue: 'Valor opción de compra',
    rentalClientResponse: 'Respuesta del cliente (renta)',
    rentalEndDate: 'Fin de renta',
    rentalMonthlyCost: 'Costo mensual de renta',
    // Patrullas
    routeId: 'Ruta',
    routeName: 'Ruta',
    agentId: 'Agente',
    agentName: 'Agente',
    recurrence: 'Recurrencia',
    recurrenceDays: 'Días de Recurrencia',
    startTime: 'Hora de Inicio',
    endTime: 'Hora de Fin',
    checkpointId: 'Checkpoint',
    checkpointName: 'Checkpoint',
    latitude: 'Latitud',
    longitude: 'Longitud',
    qrCode: 'Código QR',
    notes: 'Notas',
    photoUrl: 'Foto',
    photoBase64: 'Foto',
    severity: 'Severidad',
    resolved: 'Resuelto',
  }
  return fieldNames[fieldName] || fieldName
}

/**
 * Format relative time (e.g., "Hace 5 min")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Hace un momento'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

/**
 * Format value for display (handles sizes, dates, booleans, roles, etc.)
 */
export function formatValue(key: string, value: any): string {
  // Ocultar información sensible
  if (key === 'checksum' || key === 'hash') {
    return '(Verificación de integridad)'
  }

  // Formatear roles
  if (
    (key === 'role' || key === 'targetRole' || key === 'createdByRole') &&
    typeof value === 'string'
  ) {
    const roles: Record<string, string> = {
      ADMIN: 'Administrador',
      TECHNICIAN: 'Técnico',
      CLIENT: 'Cliente',
    }
    return roles[value] || value
  }

  // Formatear prioridades
  if (key === 'priority' && typeof value === 'string') {
    const priorities: Record<string, string> = {
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta',
      CRITICAL: 'Crítica',
    }
    return priorities[value] || value
  }

  // Formatear estados
  if (key === 'status' && typeof value === 'string') {
    const statuses: Record<string, string> = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En Progreso',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado',
      PENDING: 'Pendiente',
      COMPLETED: 'Completado',
      MISSED: 'Omitido',
      INCOMPLETE: 'Incompleto',
    }
    return statuses[value] || value
  }

  // Formatear recurrencia
  if (key === 'recurrence' && typeof value === 'string') {
    const recurrences: Record<string, string> = {
      NONE: 'Sin recurrencia',
      DAILY: 'Diaria',
      WEEKLY: 'Semanal',
      CUSTOM: 'Personalizada',
    }
    return recurrences[value] || value
  }

  // Formatear tamaños de archivo
  if (key === 'size' && typeof value === 'number') {
    const kb = value / 1024
    const mb = kb / 1024
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`
    }
    return `${kb.toFixed(2)} KB`
  }

  // Formatear porcentajes
  if (
    (key.includes('Pct') || key.includes('Percentage') || key.includes('Threshold')) &&
    typeof value === 'number'
  ) {
    return `${value}%`
  }

  // Formatear fechas
  if ((key.includes('At') || key.includes('Date')) && typeof value === 'string') {
    try {
      return new Date(value).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return String(value)
    }
  }

  // Formatear tipos
  if (key === 'type') {
    const types: Record<string, string> = {
      manual: 'Manual',
      automatic: 'Automático',
      scheduled: 'Programado',
      full: 'Completo',
      incremental: 'Incremental',
    }
    return types[String(value)] || String(value)
  }

  // Formatear booleanos
  if (typeof value === 'boolean') {
    if (key === 'createdOnBehalf') return value ? 'Sí (en nombre de otro usuario)' : 'No'
    return value ? 'Sí' : 'No'
  }

  // Formatear números
  if (typeof value === 'number') {
    return String(value)
  }

  // Formatear objetos
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      return value.length === 0 ? 'Ninguno' : value.join(', ')
    }
    return JSON.stringify(value, null, 2)
  }

  // Si es un UUID, ocultarlo
  if (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    return '(ID interno)'
  }

  return String(value)
}

/**
 * Get field label for generic details
 */
export function getFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    filename: 'Nombre del Archivo',
    size: 'Tamaño',
    type: 'Tipo',
    checksum: 'Suma de Verificación',
    entityName: 'Nombre',
    deletedAt: 'Fecha de Eliminación',
    createdAt: 'Fecha de Creación',
    updatedAt: 'Última Actualización',
    compressed: 'Comprimido',
    encrypted: 'Encriptado',
    status: 'Estado',
    error: 'Error',
    duration: 'Duración',
    records: 'Registros',
    tables: 'Tablas',
    CategoriesCount: 'Cantidad de Categorías',
    TotalCurrentTickets: 'Tickets Actuales',
    isPublished: 'Publicado',
    title: 'Título',
    content: 'Contenido',
    views: 'Visualizaciones',
    helpful: 'Útil',
    notHelpful: 'No Útil',
    // Campos de asignación de familias
    familyName: 'Familia',
    familyId: 'Familia',
    targetUserName: 'Usuario Afectado',
    targetUserId: 'Usuario',
    targetRole: 'Rol del Usuario',
    adminName: 'Administrador',
    adminId: 'Administrador',
    technicianName: 'Técnico',
    technicianId: 'Técnico',
    clientName: 'Cliente',
    clientId: 'Cliente',
    userName: 'Usuario',
    userEmail: 'Email',
    ticketTitle: 'Título del Ticket',
    ticketCode: 'Código del Ticket',
    categoryName: 'Categoría',
    departmentName: 'Departamento',
    priority: 'Prioridad',
    assigneeName: 'Asignado a',
    // Campos de módulos
    ticketsEnabled: 'Módulo Tickets',
    inventoryEnabled: 'Módulo Inventario',
    patrolsEnabled: 'Módulo Rondas',
    credentialsEnabled: 'Módulo Credenciales',
    canManageCredentials: 'Gestor de Credenciales',
    canManageInventory: 'Gestor de Inventario',
    canRequestAssets: 'Solicitar Activos',
    isSuperAdmin: 'Super Admin',
    // Campos de patrullas
    routeId: 'Ruta',
    routeName: 'Ruta',
    agentId: 'Agente',
    agentName: 'Agente',
    recurrence: 'Recurrencia',
    generatedPatrols: 'Patrullas Generadas',
    completionPct: 'Completitud',
    missedCount: 'Checkpoints Omitidos',
    summary: 'Resumen de cambios',
    updatedSettings: 'Campos actualizados (formato antiguo)',
    // Campos de creación en nombre de otro
    createdOnBehalf: 'Creado en nombre de otro',
    createdByRole: 'Rol del creador',
    createdByName: 'Creado por',
    onBehalfOfName: 'En nombre de',
    // Inventario — clonación de tipos
    sourceTypeName: 'Tipo de origen',
    attributesCopied: 'Atributos copiados',
    newTypeName: 'Nombre del nuevo tipo',
    targetFamilyName: 'Área de destino',
  }
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
}

/**
 * Check if field should be hidden in details
 */
export function shouldHideField(key: string, value: any): boolean {
  // Ocultar entityName si ya se muestra arriba
  if (key === 'entityName') return true
  // Ocultar checksums largos
  if (key === 'checksum' && String(value).length > 50) return true
  // Ocultar información técnica del sistema
  if (key === 'requestId') return true
  if (key === 'timestamp') return true
  if (key === 'Context') return true
  if (key === 'context') return true
  if (key === 'os' && value === 'Server') return true
  if (key === 'browser' && value === 'System') return true
  if (key === 'deviceType' && value === 'Unknown') return true
  if (key === 'source' && value === 'SYSTEM') return true
  if (key === 'result' && value === 'SUCCESS') return true
  // Ocultar contadores si son 0
  if ((key === 'CategoriesCount' || key === 'TotalCurrentTickets') && value === 0) return true
  // Ocultar UUIDs cuando hay un campo con nombre correspondiente
  if (key.endsWith('Id') && typeof value === 'string' && value.includes('-') && value.length > 30)
    return true
  // Ocultar campos internos de auditoría
  if (key === 'oldValues' || key === 'newValues' || key === 'changes') return true
  if (key === 'totalChanges') return true
  if (key === 'userAgent') return true
  if (key === 'ip' && value === 'Unknown') return true
  return false
}

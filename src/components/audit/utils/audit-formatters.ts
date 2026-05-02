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
  }
  return entityMap[entityType.toLowerCase()] || entityType
}

/**
 * Get action badge color classes (dark mode compatible)
 */
export function getActionColor(action: string): string {
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
    backup_restored: 'Respaldo Restaurado',
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
    // Configuración
    settings_updated: 'Configuración Actualizada',
    settings_viewed: 'Configuración Visualizada',
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
    comment: 'Comentarios',
    attachment: 'Archivos Adjuntos',
    notification: 'Notificaciones',
    sla: 'Acuerdos de Nivel de Servicio',
    report: 'Reportes',
    audit: 'Auditoría',
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
 * Format value for display (handles sizes, dates, booleans, etc.)
 */
export function formatValue(key: string, value: any): string {
  // Ocultar información sensible
  if (key === 'checksum' || key === 'hash') {
    return '(Verificación de integridad)'
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
    return value ? 'Sí' : 'No'
  }

  // Formatear objetos
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value, null, 2)
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
  }
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1)
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
  return false
}

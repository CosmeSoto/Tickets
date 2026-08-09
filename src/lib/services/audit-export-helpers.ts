export function translateRole(role: string): string {
  const roleMap: Record<string, string> = {
    ADMIN: 'Administrador',
    TECHNICIAN: 'Técnico',
    CLIENT: 'Cliente',
    SYSTEM: 'Sistema',
  }
  return roleMap[role] || role
}

export function translateSeverity(severity: string): string {
  const severityMap: Record<string, string> = {
    CRITICAL: 'Crítica',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja',
    INFO: 'Informativa',
  }
  return severityMap[severity] || severity
}

export function translateDeviceType(deviceType: string): string {
  const deviceMap: Record<string, string> = {
    Desktop: '🖥️ Escritorio',
    Mobile: '📱 Móvil',
    Tablet: '📱 Tablet',
    Unknown: 'Desconocido',
  }
  return deviceMap[deviceType] || deviceType
}

export function translateSource(source: string): string {
  const sourceMap: Record<string, string> = {
    WEB: '🌐 Web',
    API: '⚡ API',
    MOBILE: '📱 Aplicación Móvil',
    SYSTEM: '⚙️ Sistema Automático',
  }
  return sourceMap[source] || source
}

export function translateResult(result: string): string {
  const resultMap: Record<string, string> = {
    SUCCESS: '✅ Exitoso',
    ERROR: '❌ Error',
    PARTIAL: '⚠️ Parcial',
  }
  return resultMap[result] || result
}

export function buildActionDescription(log: any, changes: any, details: any): string {
  const userName = log.users?.name || 'El sistema'
  const action = log.action.toLowerCase()

  let description = ''

  if (log.entityType === 'comment') {
    let commentContent = ''
    if (details?.content) {
      commentContent = String(details.content).slice(0, 150)
    } else if (details?.comment) {
      commentContent = String(details.comment).slice(0, 150)
    } else if (details?.message) {
      commentContent = String(details.message).slice(0, 150)
    } else if (details?.text) {
      commentContent = String(details.text).slice(0, 150)
    }

    if (commentContent) {
      description = `${userName} escribió: "${commentContent}${commentContent.length >= 150 ? '...' : ''}"`
    } else {
      description = `${userName} agregó un comentario al ticket`
      if (details?.metadata?.ticketId) {
        description += ` (ID: ${String(details.metadata.ticketId).slice(0, 8)}...)`
      }
    }

    if (details?.metadata?.isInternal === true) {
      description += ' - Nota interna (solo visible para el equipo)'
    } else if (details?.metadata?.isInternal === false) {
      description += ' - Comentario público (visible para el cliente)'
    }
  } else if (log.entityType === 'ticket') {
    if (action.includes('created')) {
      description = `${userName} creó un nuevo ticket`
      if (details?.title) {
        description += `: "${details.title}"`
      }
    } else if (action.includes('updated')) {
      description = `${userName} actualizó un ticket`
      if (details?.title) {
        description += `: "${details.title}"`
      }
    } else if (action.includes('deleted')) {
      description = `${userName} eliminó un ticket`
    } else if (action.includes('assigned')) {
      description = `${userName} asignó el ticket`
      if (details?.assignedTo) {
        description += ` a ${details.assignedTo}`
      }
    } else if (action.includes('resolved')) {
      description = `${userName} resolvió el ticket`
    } else if (action.includes('closed')) {
      description = `${userName} cerró el ticket`
    } else {
      description = `${userName} modificó un ticket`
    }
  } else if (log.entityType === 'user') {
    if (action.includes('login_failed') || (action.includes('login') && details?.reason)) {
      const email = details?.email || 'desconocido'
      const reason = details?.reason || 'desconocida'

      let reasonText = ''
      switch (reason) {
        case 'user_not_found':
          reasonText = 'usuario no encontrado'
          break
        case 'invalid_password':
          reasonText = 'contraseña incorrecta'
          break
        case 'account_disabled':
          reasonText = 'cuenta desactivada'
          break
        default:
          reasonText = 'credenciales inválidas'
      }

      description = `Intento fallido de inicio de sesión para ${email} (${reasonText})`

      if (details?.ipAddress) {
        description += ` desde ${details.ipAddress}`
      }
    } else if (action.includes('user_registered')) {
      description = `${userName} se registró en el sistema`
      if (details?.provider) {
        const providerText = details.provider === 'credentials' ? 'credenciales' : details.provider
        description += ` usando ${providerText}`
      }
    } else if (action.includes('login')) {
      description = `${userName} inició sesión en el sistema`
      if (details?.provider) {
        const providerText = details.provider === 'credentials' ? 'credenciales' : details.provider
        description += ` usando ${providerText}`
      }
      if (details?.ipAddress) {
        description += ` desde ${details.ipAddress}`
      }
    } else if (action.includes('logout')) {
      description = `${userName} cerró sesión`
      if (details?.sessionDuration) {
        const minutes = Math.floor(details.sessionDuration / 60)
        description += ` (duración: ${minutes} minutos)`
      }
    } else if (action.includes('created')) {
      description = `${userName} creó un nuevo usuario`
      if (details?.name) {
        description += `: ${details.name}`
      }
    } else if (action.includes('updated')) {
      description = `${userName} actualizó un usuario`
      if (details?.name) {
        description += `: ${details.name}`
      }
    } else if (action.includes('role_changed')) {
      description = `${userName} cambió el rol de un usuario`
      if (details?.oldRole && details?.newRole) {
        description += ` de ${details.oldRole} a ${details.newRole}`
      }
    } else if (action.includes('deleted')) {
      description = `${userName} eliminó un usuario`
    } else {
      description = `${userName} modificó un usuario`
    }
  } else if (log.entityType === 'category') {
    if (action.includes('created')) {
      description = `${userName} creó una nueva categoría`
      if (details?.name) {
        description += `: ${details.name}`
      }
    } else if (action.includes('updated')) {
      description = `${userName} actualizó una categoría`
    } else {
      description = `${userName} modificó una categoría`
    }
  } else if (log.entityType === 'department') {
    if (action.includes('created')) {
      description = `${userName} creó un nuevo departamento`
      if (details?.name) {
        description += `: ${details.name}`
      }
    } else if (action.includes('updated')) {
      description = `${userName} actualizó un departamento`
    } else {
      description = `${userName} modificó un departamento`
    }
  } else {
    const actionTranslated = translateAction(log.action)
    const entityTranslated = translateEntityType(log.entityType)
    description = `${userName} ${actionTranslated.toLowerCase()} ${entityTranslated.toLowerCase()}`
  }

  if (changes.hasChanges && changes.fields.length > 0) {
    const fieldCount = changes.fields.length
    if (fieldCount === 1) {
      description += `. Cambió: ${changes.fields[0]}`
    } else if (fieldCount <= 3) {
      description += `. Cambió: ${changes.fields.join(', ')}`
    } else {
      description += `. Realizó ${fieldCount} cambios`
    }
  }

  return description
}

export function buildChangesDescription(changes: any): string {
  if (!changes.hasChanges || changes.fields.length === 0) {
    return 'No se realizaron cambios en campos específicos'
  }

  const descriptions: string[] = []

  for (const field of changes.fields) {
    const oldValue = changes.oldValues[field]
    const newValue = changes.newValues[field]

    const fieldTranslations: Record<string, string> = {
      status: 'Estado',
      priority: 'Prioridad',
      title: 'Título',
      description: 'Descripción',
      assignedTo: 'Asignado a',
      category: 'Categoría',
      department: 'Departamento',
      name: 'Nombre',
      email: 'Email',
      role: 'Rol',
      isInternal: 'Visibilidad',
      content: 'Contenido',
      subject: 'Asunto',
      body: 'Cuerpo',
      type: 'Tipo',
    }

    const translatedField = fieldTranslations[field] || field

    const formatValue = (value: any) => {
      if (value === null || value === undefined || value === '') return '(vacío)'
      if (typeof value === 'boolean') return value ? 'Sí' : 'No'
      if (typeof value === 'string' && value.length > 50) return value.slice(0, 50) + '...'
      return String(value)
    }

    descriptions.push(
      `${translatedField}: de "${formatValue(oldValue)}" a "${formatValue(newValue)}"`
    )
  }

  return descriptions.join(' | ')
}

export function escapeCsv(text: string): string {
  if (!text) return ''
  return String(text).replace(/"/g, '""')
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('es-ES')
}

export function getDayOfWeek(date: Date): string {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  return days[date.getDay()]
}

export function translateAction(action: string): string {
  const actionMap: Record<string, string> = {
    created: 'Creado',
    updated: 'Actualizado',
    deleted: 'Eliminado',
    login: 'Inicio de sesión',
    logout: 'Cierre de sesión',
    login_failed: 'Intento de login fallido',
    assigned: 'Asignado',
    unassigned: 'Desasignado',
    status_changed: 'Estado cambiado',
    priority_changed: 'Prioridad cambiada',
    resolved: 'Resuelto',
    closed: 'Cerrado',
    role_changed: 'Rol cambiado',
    password_changed: 'Contraseña cambiada',
    promoted: 'Promovido',
    demoted: 'Degradado',
    uploaded: 'Subido',
    downloaded: 'Descargado',
    exported: 'Exportado',
    AUDIT_LOGS_EXPORTED: 'Exportación de auditoría',
    generated: 'Generado',
    backup: 'Respaldo',
    restore: 'Restauración',
    config_changed: 'Configuración cambiada',
    viewed: 'Visualizado',
    searched: 'Búsqueda realizada',
    filtered: 'Filtrado aplicado',
    sorted: 'Ordenamiento aplicado',
    paginated: 'Paginación',
    refreshed: 'Actualizado',
    imported: 'Importado',
    merged: 'Fusionado',
    split: 'Dividido',
    archived: 'Archivado',
    restored: 'Restaurado',
    locked: 'Bloqueado',
    unlocked: 'Desbloqueado',
    enabled: 'Habilitado',
    disabled: 'Deshabilitado',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    cancelled: 'Cancelado',
    suspended: 'Suspendido',
    reactivated: 'Reactivado',
  }

  if (actionMap[action]) return actionMap[action]

  // Preferir coincidencias más largas (evita que "exported" gane a "AUDIT_LOGS_EXPORTED")
  const ranked = Object.entries(actionMap).sort((a, b) => b[0].length - a[0].length)
  for (const [key, value] of ranked) {
    if (action.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  return action
}

export function translateEntityType(entityType: string): string {
  const entityMap: Record<string, string> = {
    ticket: 'Ticket',
    user: 'Usuario',
    category: 'Categoría',
    department: 'Departamento',
    technician: 'Técnico',
    comment: 'Comentario',
    attachment: 'Archivo Adjunto',
    system: 'Sistema',
    report: 'Reporte',
    settings: 'Configuración',
    assignment: 'Asignación',
    notification: 'Notificación',
    email: 'Correo Electrónico',
    sla: 'SLA',
    rating: 'Calificación',
    knowledge: 'Base de Conocimiento',
    article: 'Artículo',
    tag: 'Etiqueta',
    workflow: 'Flujo de Trabajo',
    automation: 'Automatización',
    integration: 'Integración',
    api: 'API',
    webhook: 'Webhook',
    backup: 'Respaldo',
    audit: 'Auditoría',
    security: 'Seguridad',
    permission: 'Permiso',
    role: 'Rol',
    session: 'Sesión',
    token: 'Token',
    cache: 'Caché',
    queue: 'Cola',
    job: 'Tarea',
    schedule: 'Programación',
  }
  return entityMap[entityType.toLowerCase()] || entityType
}

export function detectDeviceType(userAgent: string): string {
  if (!userAgent) return ''
  const ua = userAgent.toLowerCase()
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) return 'Móvil'
  if (ua.includes('tablet') || ua.includes('ipad')) return 'Tablet'
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari')) return 'Escritorio'
  return ''
}

export function detectBrowser(userAgent: string): string {
  if (!userAgent) return 'Desconocido'

  if (userAgent.includes('Edg/')) return 'Microsoft Edge'
  if (userAgent.includes('Chrome/')) return 'Google Chrome'
  if (userAgent.includes('Firefox/')) return 'Mozilla Firefox'
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) return 'Apple Safari'
  if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) return 'Opera'
  if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) return 'Internet Explorer'

  return 'Otro'
}

export function detectOS(userAgent: string): string {
  if (!userAgent) return 'Desconocido'

  if (userAgent.includes('Windows NT 10.0')) return 'Windows 10/11'
  if (userAgent.includes('Windows NT 6.3')) return 'Windows 8.1'
  if (userAgent.includes('Windows NT 6.2')) return 'Windows 8'
  if (userAgent.includes('Windows NT 6.1')) return 'Windows 7'
  if (userAgent.includes('Windows')) return 'Windows'

  if (userAgent.includes('Mac OS X')) {
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/)
    return match ? `macOS ${match[1].replace('_', '.')}` : 'macOS'
  }

  if (userAgent.includes('Linux')) return 'Linux'
  if (userAgent.includes('Android')) return 'Android'
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad'))
    return 'iOS'

  return 'Otro'
}

export function extractChanges(details: any): {
  hasChanges: boolean
  fields: string[]
  oldValues: any
  newValues: any
} {
  if (!details || !details.oldValues || !details.newValues) {
    return { hasChanges: false, fields: [], oldValues: {}, newValues: {} }
  }

  const fields = Object.keys(details.newValues).filter(
    key => details.oldValues[key] !== details.newValues[key]
  )

  return {
    hasChanges: fields.length > 0,
    fields,
    oldValues: details.oldValues,
    newValues: details.newValues,
  }
}

export function extractMetadata(details: any): any {
  if (!details || !details.metadata) return {}
  return details.metadata
}

export function determineSeverity(action: string, entityType: string): string {
  const criticalActions = [
    'deleted',
    'password_changed',
    'role_changed',
    'promoted',
    'demoted',
    'login_failed',
  ]
  const criticalEntities = ['user', 'system', 'security', 'permission', 'role']

  if (criticalActions.some(a => action.toLowerCase().includes(a))) return 'CRITICAL'
  if (criticalEntities.includes(entityType.toLowerCase())) return 'HIGH'
  if (action.toLowerCase().includes('updated')) return 'MEDIUM'
  if (action.toLowerCase().includes('created')) return 'LOW'
  if (action.toLowerCase().includes('viewed') || action.toLowerCase().includes('searched'))
    return 'INFO'

  return 'MEDIUM'
}

export function getAuditCategory(action: string, entityType: string): string {
  if (action.includes('login') || action.includes('logout')) return 'Autenticación'
  if (action.includes('password') || action.includes('role') || action.includes('permission'))
    return 'Seguridad'
  if (entityType === 'ticket') return 'Gestión de Tickets'
  if (entityType === 'user') return 'Gestión de Usuarios'
  if (entityType === 'system' || entityType === 'settings') return 'Configuración del Sistema'
  if (action.includes('export') || action.includes('report')) return 'Reportes y Exportaciones'
  if (entityType === 'category' || entityType === 'department') return 'Organización'

  return 'General'
}

export function getSystemModule(entityType: string): string {
  const moduleMap: Record<string, string> = {
    ticket: 'Módulo de Tickets',
    user: 'Módulo de Usuarios',
    category: 'Módulo de Categorías',
    department: 'Módulo de Departamentos',
    report: 'Módulo de Reportes',
    settings: 'Configuración del Sistema',
    audit: 'Módulo de Auditoría',
    notification: 'Sistema de Notificaciones',
    email: 'Sistema de Correo',
    sla: 'Gestión de SLA',
    knowledge: 'Base de Conocimiento',
  }
  return moduleMap[entityType.toLowerCase()] || 'Sistema General'
}

export function requiresReview(log: any): boolean {
  const criticalActions = ['deleted', 'password_changed', 'role_changed', 'login_failed']
  const severity = determineSeverity(log.action, log.entityType)

  if (severity === 'CRITICAL') return true
  if (criticalActions.some(a => log.action.toLowerCase().includes(a))) return true
  if (log.result === 'ERROR') return true
  if (log.errorCode) return true

  return false
}

export function getDateRange(logs: any[]): string {
  if (logs.length === 0) return 'Sin registros'

  const dates = logs.map(l => new Date(l.createdAt).getTime())
  const minDate = new Date(Math.min(...dates))
  const maxDate = new Date(Math.max(...dates))

  return `${minDate.toLocaleDateString('es-ES')} - ${maxDate.toLocaleDateString('es-ES')}`
}

export function getFilterSuffix(filters: any): string {
  const activeFilters = []
  if (filters.entityType && filters.entityType !== 'all')
    activeFilters.push(`module-${filters.entityType}`)
  if (filters.action) activeFilters.push(`action-${filters.action}`)
  if (filters.userId) activeFilters.push('user-filtered')
  if (filters.days) activeFilters.push(`${filters.days}days`)

  return activeFilters.length > 0 ? `-${activeFilters.join('-')}` : ''
}

export function getActiveFilters(filters: any): Record<string, any> {
  const active: Record<string, any> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'all' && value !== '') active[key] = value
  })
  return active
}

export function getTopActions(
  logs: any[],
  limit: number
): Array<{ action: string; count: number }> {
  const actionCounts = logs.reduce(
    (acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return Object.entries(actionCounts)
    .map(([action, count]) => ({ action: translateAction(action), count: count as number }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, limit)
}

export function getTopUsers(logs: any[], limit: number): Array<{ user: string; count: number }> {
  const userCounts = logs.reduce(
    (acc, log) => {
      const userName = log.users?.name || 'Sistema'
      acc[userName] = (acc[userName] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return Object.entries(userCounts)
    .map(([user, count]) => ({ user, count: count as number }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, limit)
}

export function getTopEntities(
  logs: any[],
  limit: number
): Array<{ entity: string; count: number }> {
  const entityCounts = logs.reduce(
    (acc, log) => {
      acc[log.entityType] = (acc[log.entityType] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return Object.entries(entityCounts)
    .map(([entity, count]) => ({ entity: translateEntityType(entity), count: count as number }))
    .sort((a, b) => (b.count as number) - (a.count as number))
    .slice(0, limit)
}

export function buildSimpleDescription(log: any, details: any): string {
  const userName = log.users?.name || 'Sistema'

  if (details.changes && typeof details.changes === 'object') {
    const changeKeys = Object.keys(details.changes)
    if (changeKeys.length > 0) {
      const fields = changeKeys.map(k => details.changes[k]?.field || k).join(', ')
      return `${userName} modificó: ${fields}`
    }
  }

  if (details.ticketTitle) return `Ticket: ${details.ticketTitle}`
  if (details.userName && details.userEmail)
    return `Usuario: ${details.userName} (${details.userEmail})`
  if (details.categoryName) return `Categoría: ${details.categoryName}`
  if (details.departmentName) return `Departamento: ${details.departmentName}`
  if (details.familyName) return `Familia: ${details.familyName}`
  if (details.targetUserName) return `Usuario afectado: ${details.targetUserName}`
  if (details.adminName) return `Admin: ${details.adminName}`

  const action = translateAction(log.action)
  const entity = translateEntityType(log.entityType)
  return `${action} en ${entity}`
}

export function buildSimpleChanges(details: any): string {
  if (details.changes && typeof details.changes === 'object') {
    const parts: string[] = []
    for (const [key, value] of Object.entries(details.changes)) {
      const change = value as any
      if (change.old !== undefined && change.new !== undefined) {
        const field = change.field || key
        parts.push(`${field}: ${change.old} → ${change.new}`)
      }
    }
    return parts.length > 0 ? parts.join(' | ') : ''
  }

  if (details.oldValues && details.newValues) {
    const parts: string[] = []
    for (const key of Object.keys(details.newValues)) {
      if (details.oldValues[key] !== details.newValues[key]) {
        const old = details.oldValues[key] ?? '(vacío)'
        const nuevo = details.newValues[key] ?? '(vacío)'
        parts.push(`${key}: ${old} → ${nuevo}`)
      }
    }
    return parts.length > 0 ? parts.join(' | ') : ''
  }

  return ''
}

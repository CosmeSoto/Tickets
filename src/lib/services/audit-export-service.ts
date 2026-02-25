/**
 * Servicio de Exportación de Auditoría
 * Reutiliza ExportService para mantener consistencia
 */

export interface AuditExportOptions {
  format: 'csv' | 'json'
  includeHeaders: boolean
  includeMetadata: boolean
  filename?: string
}

export class AuditExportService {
  // Límites de seguridad para exportación de auditoría
  private static readonly EXPORT_LIMITS = {
    csv: 100000,   // 100K registros máximo para CSV
    json: 50000,   // 50K registros máximo para JSON
  }

  /**
   * Exporta logs de auditoría con formato profesional
   */
  static async exportAuditLogs(
    logs: any[],
    filters: any,
    options: AuditExportOptions
  ): Promise<{ content: string; filename: string; contentType: string; warnings?: string[] }> {
    
    const warnings: string[] = []
    const recordCount = logs.length
    const limit = this.EXPORT_LIMITS[options.format]
    
    // Validar tamaño antes de exportar
    if (recordCount > limit) {
      warnings.push(`⚠️ Archivo grande: ${recordCount} registros exceden el límite recomendado de ${limit.toLocaleString()} para formato ${options.format.toUpperCase()}`)
      warnings.push(`💡 Recomendación: Use filtros más específicos (fecha, módulo, usuario) para reducir el volumen`)
    }
    
    // Validar memoria estimada
    const estimatedSizeMB = this.estimateFileSizeMB(recordCount, options.format)
    if (estimatedSizeMB > 100) { // Límite de 100MB
      warnings.push(`⚠️ Archivo muy grande: Tamaño estimado ${estimatedSizeMB.toFixed(1)}MB`)
      warnings.push(`💡 Considere exportar por períodos más cortos o filtrar por módulo específico`)
    }
    
    console.log(`📤 AuditExportService - Exportando ${recordCount.toLocaleString()} registros (${estimatedSizeMB.toFixed(1)}MB estimado)`)
    
    const timestamp = new Date().toISOString().split('T')[0]
    const filterSuffix = this.getFilterSuffix(filters)
    const filename = options.filename || `audit-logs-${timestamp}${filterSuffix}`
    
    try {
      switch (options.format) {
        case 'csv':
          return {
            content: this.generateCSV(logs, options),
            filename: `${filename}.csv`,
            contentType: 'text/csv; charset=utf-8',
            warnings
          }
        case 'json':
          return {
            content: this.generateJSON(logs, filters, options),
            filename: `${filename}.json`,
            contentType: 'application/json',
            warnings
          }
        default:
          throw new Error(`Formato no soportado: ${options.format}`)
      }
    } catch (error) {
      console.error('❌ Error en exportación de auditoría:', error)
      throw new Error(`Error al generar archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`)
    }
  }

  /**
   * Estima el tamaño del archivo en MB
   */
  private static estimateFileSizeMB(recordCount: number, format: string): number {
    // Estimaciones basadas en el tamaño promedio de logs de auditoría
    const bytesPerRecord = {
      csv: 1500,   // ~1.5KB por log (incluye detalles JSON)
      json: 2500,  // ~2.5KB por log (JSON con metadatos completos)
    }
    
    const bytes = (bytesPerRecord[format as keyof typeof bytesPerRecord] || 1500) * recordCount
    return bytes / (1024 * 1024) // Convertir a MB
  }

  /**
   * Genera CSV profesional con todos los datos de auditoría
   */
  private static generateCSV(logs: any[], options: AuditExportOptions): string {
    // BOM para UTF-8 en Excel
    let csv = '\uFEFF'
    
    // Metadata si está habilitada
    if (options.includeMetadata) {
      csv += `# REGISTRO DE AUDITORÍA DEL SISTEMA\n`
      csv += `# Generado: ${new Date().toLocaleString('es-ES')}\n`
      csv += `# Total de Registros: ${logs.length.toLocaleString()}\n`
      csv += `# Período: ${this.getDateRange(logs)}\n`
      csv += `\n`
    }

    // Headers simplificados y comprensibles
    if (options.includeHeaders) {
      csv += [
        'Fecha',
        'Hora',
        'Día',
        'Qué Pasó',
        'Dónde',
        'Quién',
        'Email',
        'Rol',
        'Detalles de la Acción',
        'Cambios Realizados',
        'Ubicación (IP)',
        'Navegador',
        'Sistema',
        'Dispositivo',
        'Origen',
        'Resultado',
        'Duración (ms)',
        'Categoría',
        'Nivel de Importancia'
      ].join(',') + '\n'
    }

    // Datos completos
    logs.forEach((log: any) => {
      const date = new Date(log.createdAt)
      const details = log.details || {}
      
      // Extraer información de cambios
      const changes = this.extractChanges(details)
      const metadata = this.extractMetadata(details)
      
      // Detectar navegador y SO
      const browserInfo = this.detectBrowser(log.userAgent)
      const osInfo = this.detectOS(log.userAgent)
      
      // Determinar severidad
      const severity = this.determineSeverity(log.action, log.entityType)
      
      // Categoría de auditoría
      const category = this.getAuditCategory(log.action, log.entityType)
      
      // Construir descripción legible de la acción
      const actionDescription = this.buildActionDescription(log, changes, details)
      const changesDescription = this.buildChangesDescription(changes)
      
      // Extraer contexto enriquecido
      const context = details?.context || {}
      const deviceType = context.deviceType || 'Desconocido'
      const source = context.source || 'Web'
      const result = context.result || 'SUCCESS'
      const duration = context.duration || ''
      
      const row = [
        date.toLocaleDateString('es-ES'),
        date.toLocaleTimeString('es-ES'),
        this.getDayOfWeek(date),
        `"${this.escapeCsv(actionDescription)}"`,
        `"${this.escapeCsv(this.getSystemModule(log.entityType))}"`,
        `"${this.escapeCsv(log.users?.name || 'Sistema Automático')}"`,
        log.users?.email || 'sistema@tickets.com',
        this.translateRole(log.users?.role || 'SYSTEM'),
        `"${this.escapeCsv(changesDescription)}"`,
        changes.hasChanges ? `"${this.escapeCsv(changes.fields.join(', '))}"` : 'Sin cambios',
        log.ipAddress || 'No disponible',
        browserInfo,
        osInfo,
        this.translateDeviceType(deviceType),
        this.translateSource(source),
        this.translateResult(result),
        duration,
        category,
        this.translateSeverity(severity)
      ]
      csv += row.join(',') + '\n'
    })

    return csv
  }

  /**
   * Genera JSON estructurado con metadata completa
   */
  private static generateJSON(logs: any[], filters: any, options: AuditExportOptions): string {
    const exportData = {
      metadata: options.includeMetadata ? {
        reportType: 'audit_logs',
        generatedAt: new Date().toISOString(),
        generatedBy: 'Sistema de Auditoría',
        filters: this.getActiveFilters(filters),
        recordCount: logs.length,
        dateRange: this.getDateRange(logs),
        version: '2.0',
        exportFormat: 'json',
        systemInfo: {
          environment: process.env.NODE_ENV || 'production',
          version: '1.0.0'
        }
      } : undefined,
      summary: {
        totalRecords: logs.length,
        uniqueUsers: new Set(logs.map(l => l.userId).filter(Boolean)).size,
        uniqueActions: new Set(logs.map(l => l.action)).size,
        uniqueEntities: new Set(logs.map(l => l.entityType)).size,
        dateRange: this.getDateRange(logs),
        topActions: this.getTopActions(logs, 5),
        topUsers: this.getTopUsers(logs, 5),
        topEntities: this.getTopEntities(logs, 5),
        criticalEvents: logs.filter(l => this.determineSeverity(l.action, l.entityType) === 'CRITICAL').length,
        errorEvents: logs.filter(l => l.result === 'ERROR').length
      },
      logs: logs.map(log => ({
        ...log,
        createdAt: log.createdAt,
        actionTranslated: this.translateAction(log.action),
        entityTypeTranslated: this.translateEntityType(log.entityType),
        browserInfo: this.detectBrowser(log.userAgent),
        osInfo: this.detectOS(log.userAgent),
        severity: this.determineSeverity(log.action, log.entityType),
        category: this.getAuditCategory(log.action, log.entityType),
        requiresReview: this.requiresReview(log),
        changes: this.extractChanges(log.details || {}),
        metadata: this.extractMetadata(log.details || {})
      }))
    }

    return JSON.stringify(exportData, null, 2)
  }

  private static translateRole(role: string): string {
    const roleMap: Record<string, string> = {
      'ADMIN': 'Administrador',
      'TECHNICIAN': 'Técnico',
      'CLIENT': 'Cliente',
      'SYSTEM': 'Sistema'
    }
    return roleMap[role] || role
  }

  private static translateSeverity(severity: string): string {
    const severityMap: Record<string, string> = {
      'CRITICAL': '🔴 Crítico',
      'HIGH': '🟠 Alto',
      'MEDIUM': '🟡 Medio',
      'LOW': '🟢 Bajo',
      'INFO': '🔵 Informativo'
    }
    return severityMap[severity] || severity
  }

  private static translateDeviceType(deviceType: string): string {
    const deviceMap: Record<string, string> = {
      'Desktop': '🖥️ Escritorio',
      'Mobile': '📱 Móvil',
      'Tablet': '📱 Tablet',
      'Unknown': 'Desconocido'
    }
    return deviceMap[deviceType] || deviceType
  }

  private static translateSource(source: string): string {
    const sourceMap: Record<string, string> = {
      'WEB': '🌐 Web',
      'API': '⚡ API',
      'MOBILE': '📱 Aplicación Móvil',
      'SYSTEM': '⚙️ Sistema Automático'
    }
    return sourceMap[source] || source
  }

  private static translateResult(result: string): string {
    const resultMap: Record<string, string> = {
      'SUCCESS': '✅ Exitoso',
      'ERROR': '❌ Error',
      'PARTIAL': '⚠️ Parcial'
    }
    return resultMap[result] || result
  }

  private static buildActionDescription(log: any, changes: any, details: any): string {
    const userName = log.users?.name || 'El sistema'
    const action = log.action.toLowerCase()
    
    // Construir descripción natural con gramática correcta
    let description = ''
    
    // Agregar contexto según el tipo de entidad
    if (log.entityType === 'comment') {
      // Extraer contenido del comentario
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
        // Si no hay contenido, dar descripción genérica pero clara
        description = `${userName} agregó un comentario al ticket`
        
        // Intentar dar más contexto si hay metadata
        if (details?.metadata?.ticketId) {
          description += ` (ID: ${String(details.metadata.ticketId).slice(0, 8)}...)`
        }
      }
      
      // Agregar si es interno o no
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
      // IMPORTANTE: Verificar login/logout PRIMERO antes de otros casos
      if (action.includes('login_failed') || (action.includes('login') && details?.reason)) {
        // Intento de login fallido
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
      // Fallback genérico
      const actionTranslated = this.translateAction(log.action)
      const entityTranslated = this.translateEntityType(log.entityType)
      description = `${userName} ${actionTranslated.toLowerCase()} ${entityTranslated.toLowerCase()}`
    }
    
    // Agregar información de cambios si existen
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

  private static buildChangesDescription(changes: any): string {
    if (!changes.hasChanges || changes.fields.length === 0) {
      return 'No se realizaron cambios en campos específicos'
    }
    
    const descriptions: string[] = []
    
    for (const field of changes.fields) {
      const oldValue = changes.oldValues[field]
      const newValue = changes.newValues[field]
      
      // Traducir nombres de campos comunes
      const fieldTranslations: Record<string, string> = {
        'status': 'Estado',
        'priority': 'Prioridad',
        'title': 'Título',
        'description': 'Descripción',
        'assignedTo': 'Asignado a',
        'category': 'Categoría',
        'department': 'Departamento',
        'name': 'Nombre',
        'email': 'Email',
        'role': 'Rol',
        'isInternal': 'Visibilidad',
        'content': 'Contenido',
        'subject': 'Asunto',
        'body': 'Cuerpo',
        'type': 'Tipo'
      }
      
      const translatedField = fieldTranslations[field] || field
      
      // Formatear valores
      const formatValue = (value: any) => {
        if (value === null || value === undefined || value === '') return '(vacío)'
        if (typeof value === 'boolean') return value ? 'Sí' : 'No'
        if (typeof value === 'string' && value.length > 50) return value.slice(0, 50) + '...'
        return String(value)
      }
      
      descriptions.push(`${translatedField}: de "${formatValue(oldValue)}" a "${formatValue(newValue)}"`)
    }
    
    return descriptions.join(' | ')
  }

  private static escapeCsv(text: string): string {
    if (!text) return ''
    return String(text).replace(/"/g, '""')
  }

  private static formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('es-ES')
  }

  private static getDayOfWeek(date: Date): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return days[date.getDay()]
  }

  private static translateAction(action: string): string {
    const actionMap: Record<string, string> = {
      'created': 'Creado',
      'updated': 'Actualizado',
      'deleted': 'Eliminado',
      'login': 'Inicio de sesión',
      'logout': 'Cierre de sesión',
      'login_failed': 'Intento de login fallido',
      'assigned': 'Asignado',
      'unassigned': 'Desasignado',
      'status_changed': 'Estado cambiado',
      'priority_changed': 'Prioridad cambiada',
      'resolved': 'Resuelto',
      'closed': 'Cerrado',
      'role_changed': 'Rol cambiado',
      'password_changed': 'Contraseña cambiada',
      'promoted': 'Promovido',
      'demoted': 'Degradado',
      'uploaded': 'Subido',
      'downloaded': 'Descargado',
      'exported': 'Exportado',
      'generated': 'Generado',
      'backup': 'Respaldo',
      'restore': 'Restauración',
      'config_changed': 'Configuración cambiada',
      'viewed': 'Visualizado',
      'searched': 'Búsqueda realizada',
      'filtered': 'Filtrado aplicado',
      'sorted': 'Ordenamiento aplicado',
      'paginated': 'Paginación',
      'refreshed': 'Actualizado',
      'imported': 'Importado',
      'merged': 'Fusionado',
      'split': 'Dividido',
      'archived': 'Archivado',
      'restored': 'Restaurado',
      'locked': 'Bloqueado',
      'unlocked': 'Desbloqueado',
      'enabled': 'Habilitado',
      'disabled': 'Deshabilitado',
      'approved': 'Aprobado',
      'rejected': 'Rechazado',
      'cancelled': 'Cancelado',
      'suspended': 'Suspendido',
      'reactivated': 'Reactivado'
    }
    
    // Buscar coincidencia parcial
    for (const [key, value] of Object.entries(actionMap)) {
      if (action.toLowerCase().includes(key)) {
        return value
      }
    }
    
    return action
  }

  private static translateEntityType(entityType: string): string {
    const entityMap: Record<string, string> = {
      'ticket': 'Ticket',
      'user': 'Usuario',
      'category': 'Categoría',
      'department': 'Departamento',
      'technician': 'Técnico',
      'comment': 'Comentario',
      'attachment': 'Archivo Adjunto',
      'system': 'Sistema',
      'report': 'Reporte',
      'settings': 'Configuración',
      'assignment': 'Asignación',
      'notification': 'Notificación',
      'email': 'Correo Electrónico',
      'sla': 'SLA',
      'rating': 'Calificación',
      'knowledge': 'Base de Conocimiento',
      'article': 'Artículo',
      'tag': 'Etiqueta',
      'workflow': 'Flujo de Trabajo',
      'automation': 'Automatización',
      'integration': 'Integración',
      'api': 'API',
      'webhook': 'Webhook',
      'backup': 'Respaldo',
      'audit': 'Auditoría',
      'security': 'Seguridad',
      'permission': 'Permiso',
      'role': 'Rol',
      'session': 'Sesión',
      'token': 'Token',
      'cache': 'Caché',
      'queue': 'Cola',
      'job': 'Tarea',
      'schedule': 'Programación'
    }
    return entityMap[entityType.toLowerCase()] || entityType
  }

  private static detectBrowser(userAgent: string): string {
    if (!userAgent) return 'Desconocido'
    
    if (userAgent.includes('Edg/')) return 'Microsoft Edge'
    if (userAgent.includes('Chrome/')) return 'Google Chrome'
    if (userAgent.includes('Firefox/')) return 'Mozilla Firefox'
    if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) return 'Apple Safari'
    if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) return 'Opera'
    if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) return 'Internet Explorer'
    
    return 'Otro'
  }

  private static detectOS(userAgent: string): string {
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
    if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS'
    
    return 'Otro'
  }

  private static extractChanges(details: any): { hasChanges: boolean; fields: string[]; oldValues: any; newValues: any } {
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
      newValues: details.newValues
    }
  }

  private static extractMetadata(details: any): any {
    if (!details || !details.metadata) return {}
    return details.metadata
  }

  private static determineSeverity(action: string, entityType: string): string {
    // Acciones críticas
    const criticalActions = ['deleted', 'password_changed', 'role_changed', 'promoted', 'demoted', 'login_failed']
    const criticalEntities = ['user', 'system', 'security', 'permission', 'role']
    
    if (criticalActions.some(a => action.toLowerCase().includes(a))) return 'CRITICAL'
    if (criticalEntities.includes(entityType.toLowerCase())) return 'HIGH'
    if (action.toLowerCase().includes('updated')) return 'MEDIUM'
    if (action.toLowerCase().includes('created')) return 'LOW'
    if (action.toLowerCase().includes('viewed') || action.toLowerCase().includes('searched')) return 'INFO'
    
    return 'MEDIUM'
  }

  private static getAuditCategory(action: string, entityType: string): string {
    if (action.includes('login') || action.includes('logout')) return 'Autenticación'
    if (action.includes('password') || action.includes('role') || action.includes('permission')) return 'Seguridad'
    if (entityType === 'ticket') return 'Gestión de Tickets'
    if (entityType === 'user') return 'Gestión de Usuarios'
    if (entityType === 'system' || entityType === 'settings') return 'Configuración del Sistema'
    if (action.includes('export') || action.includes('report')) return 'Reportes y Exportaciones'
    if (entityType === 'category' || entityType === 'department') return 'Organización'
    
    return 'General'
  }

  private static getSystemModule(entityType: string): string {
    const moduleMap: Record<string, string> = {
      'ticket': 'Módulo de Tickets',
      'user': 'Módulo de Usuarios',
      'category': 'Módulo de Categorías',
      'department': 'Módulo de Departamentos',
      'report': 'Módulo de Reportes',
      'settings': 'Configuración del Sistema',
      'audit': 'Módulo de Auditoría',
      'notification': 'Sistema de Notificaciones',
      'email': 'Sistema de Correo',
      'sla': 'Gestión de SLA',
      'knowledge': 'Base de Conocimiento'
    }
    return moduleMap[entityType.toLowerCase()] || 'Sistema General'
  }

  private static requiresReview(log: any): boolean {
    // Lógica para determinar si requiere revisión manual
    const criticalActions = ['deleted', 'password_changed', 'role_changed', 'login_failed']
    const severity = this.determineSeverity(log.action, log.entityType)
    
    if (severity === 'CRITICAL') return true
    if (criticalActions.some(a => log.action.toLowerCase().includes(a))) return true
    if (log.result === 'ERROR') return true
    if (log.errorCode) return true
    
    return false
  }

  private static getDateRange(logs: any[]): string {
    if (logs.length === 0) return 'Sin registros'
    
    const dates = logs.map(l => new Date(l.createdAt).getTime())
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    
    return `${minDate.toLocaleDateString('es-ES')} - ${maxDate.toLocaleDateString('es-ES')}`
  }

  private static getFilterSuffix(filters: any): string {
    const activeFilters = []
    if (filters.entityType && filters.entityType !== 'all') activeFilters.push(`module-${filters.entityType}`)
    if (filters.action) activeFilters.push(`action-${filters.action}`)
    if (filters.userId) activeFilters.push('user-filtered')
    if (filters.days) activeFilters.push(`${filters.days}days`)
    
    return activeFilters.length > 0 ? `-${activeFilters.join('-')}` : ''
  }

  private static getActiveFilters(filters: any): Record<string, any> {
    const active: Record<string, any> = {}
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '') active[key] = value
    })
    return active
  }

  private static getTopActions(logs: any[], limit: number): Array<{ action: string; count: number }> {
    const actionCounts = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(actionCounts)
      .map(([action, count]) => ({ action: this.translateAction(action), count: count as number }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, limit)
  }

  private static getTopUsers(logs: any[], limit: number): Array<{ user: string; count: number }> {
    const userCounts = logs.reduce((acc, log) => {
      const userName = log.users?.name || 'Sistema'
      acc[userName] = (acc[userName] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(userCounts)
      .map(([user, count]) => ({ user, count: count as number }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, limit)
  }

  private static getTopEntities(logs: any[], limit: number): Array<{ entity: string; count: number }> {
    const entityCounts = logs.reduce((acc, log) => {
      acc[log.entityType] = (acc[log.entityType] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(entityCounts)
      .map(([entity, count]) => ({ entity: this.translateEntityType(entity), count: count as number }))
      .sort((a, b) => (b.count as number) - (a.count as number))
      .slice(0, limit)
  }
}

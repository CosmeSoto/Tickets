/**
 * Global Notification Service
 * Centralized service for managing notifications across all modules
 */

export interface NotificationConfig {
  title: string
  description: string
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info'
  duration?: number
}

export class GlobalNotificationService {
  
  // ============================================================================
  // GENERIC NOTIFICATIONS
  // ============================================================================
  
  static success(title: string, description: string): NotificationConfig {
    return {
      title,
      description,
      variant: 'success',
      duration: 4000
    }
  }

  static error(title: string, description: string): NotificationConfig {
    return {
      title,
      description,
      variant: 'destructive',
      duration: 6000
    }
  }

  static warning(title: string, description: string): NotificationConfig {
    return {
      title,
      description,
      variant: 'warning',
      duration: 5000
    }
  }

  static info(title: string, description: string): NotificationConfig {
    return {
      title,
      description,
      variant: 'info',
      duration: 4000
    }
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================
  
  static created(entityType: string, entityName: string): NotificationConfig {
    return this.success(
      `${entityType} creado`,
      `${entityName} ha sido creado exitosamente.`
    )
  }

  static updated(entityType: string, entityName: string): NotificationConfig {
    return this.success(
      `${entityType} actualizado`,
      `${entityName} ha sido actualizado exitosamente.`
    )
  }

  static deleted(entityType: string, entityName: string): NotificationConfig {
    return this.success(
      `${entityType} eliminado`,
      `${entityName} ha sido eliminado exitosamente.`
    )
  }

  static activated(entityType: string, entityName: string): NotificationConfig {
    return this.success(
      `${entityType} activado`,
      `${entityName} ha sido activado exitosamente.`
    )
  }

  static deactivated(entityType: string, entityName: string): NotificationConfig {
    return this.warning(
      `${entityType} desactivado`,
      `${entityName} ha sido desactivado exitosamente.`
    )
  }

  // ============================================================================
  // ERROR SCENARIOS
  // ============================================================================
  
  static createError(entityType: string, error?: string): NotificationConfig {
    return this.error(
      `Error al crear ${entityType.toLowerCase()}`,
      error || `No se pudo crear el ${entityType.toLowerCase()}. Inténtalo de nuevo.`
    )
  }

  static updateError(entityType: string, error?: string): NotificationConfig {
    return this.error(
      `Error al actualizar ${entityType.toLowerCase()}`,
      error || `No se pudo actualizar el ${entityType.toLowerCase()}. Inténtalo de nuevo.`
    )
  }

  static deleteError(entityType: string, error?: string): NotificationConfig {
    return this.error(
      `Error al eliminar ${entityType.toLowerCase()}`,
      error || `No se pudo eliminar el ${entityType.toLowerCase()}. Inténtalo de nuevo.`
    )
  }

  static loadError(entityType: string, error?: string): NotificationConfig {
    return this.error(
      `Error al cargar ${entityType.toLowerCase()}s`,
      error || `No se pudieron cargar los ${entityType.toLowerCase()}s. Inténtalo de nuevo.`
    )
  }

  static validationError(message: string): NotificationConfig {
    return this.error(
      'Error de validación',
      message
    )
  }

  static permissionError(): NotificationConfig {
    return this.error(
      'Sin permisos',
      'No tienes permisos para realizar esta acción.'
    )
  }

  static networkError(): NotificationConfig {
    return this.error(
      'Error de conexión',
      'Problema de conexión. Verifica tu internet e inténtalo de nuevo.'
    )
  }

  // ============================================================================
  // SPECIFIC ENTITY NOTIFICATIONS
  // ============================================================================
  
  // User notifications
  static userCreated(userName: string) {
    return this.created('Usuario', userName)
  }

  static userUpdated(userName: string) {
    return this.updated('Usuario', userName)
  }

  static userDeleted(userName: string) {
    return this.deleted('Usuario', userName)
  }

  static userActivated(userName: string) {
    return this.activated('Usuario', userName)
  }

  static userDeactivated(userName: string) {
    return this.deactivated('Usuario', userName)
  }

  static userPromoted(userName: string, newRole: string) {
    return this.success(
      'Usuario promovido',
      `${userName} ha sido promovido a ${newRole} exitosamente.`
    )
  }

  // Category notifications
  static categoryCreated(categoryName: string) {
    return this.created('Categoría', categoryName)
  }

  static categoryUpdated(categoryName: string) {
    return this.updated('Categoría', categoryName)
  }

  static categoryDeleted(categoryName: string) {
    return this.deleted('Categoría', categoryName)
  }

  static categoryAssigned(categoryName: string, technicianName: string) {
    return this.success(
      'Categoría asignada',
      `${categoryName} ha sido asignada a ${technicianName} exitosamente.`
    )
  }

  static categoryUnassigned(categoryName: string, technicianName: string) {
    return this.warning(
      'Categoría desasignada',
      `${categoryName} ha sido removida de ${technicianName} exitosamente.`
    )
  }

  // Technician notifications
  static technicianCreated(technicianName: string) {
    return this.created('Técnico', technicianName)
  }

  static technicianUpdated(technicianName: string) {
    return this.updated('Técnico', technicianName)
  }

  static technicianDeleted(technicianName: string) {
    return this.deleted('Técnico', technicianName)
  }

  static technicianAssignmentUpdated(technicianName: string) {
    return this.success(
      'Asignaciones actualizadas',
      `Las asignaciones de ${technicianName} han sido actualizadas exitosamente.`
    )
  }

  // Ticket notifications
  static ticketCreated(ticketTitle: string) {
    return this.created('Ticket', `"${ticketTitle}"`)
  }

  static ticketUpdated(ticketTitle: string) {
    return this.updated('Ticket', `"${ticketTitle}"`)
  }

  static ticketDeleted(ticketTitle: string) {
    return this.deleted('Ticket', `"${ticketTitle}"`)
  }

  static ticketAssigned(ticketTitle: string, technicianName: string) {
    return this.success(
      'Ticket asignado',
      `"${ticketTitle}" ha sido asignado a ${technicianName} exitosamente.`
    )
  }

  static ticketStatusChanged(ticketTitle: string, newStatus: string) {
    return this.info(
      'Estado actualizado',
      `El estado de "${ticketTitle}" ha sido cambiado a ${newStatus}.`
    )
  }

  static ticketPriorityChanged(ticketTitle: string, newPriority: string) {
    return this.info(
      'Prioridad actualizada',
      `La prioridad de "${ticketTitle}" ha sido cambiada a ${newPriority}.`
    )
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================
  
  static bulkDeleted(entityType: string, count: number) {
    return this.success(
      `${entityType}s eliminados`,
      `${count} ${entityType.toLowerCase()}${count > 1 ? 's' : ''} eliminado${count > 1 ? 's' : ''} exitosamente.`
    )
  }

  static bulkUpdated(entityType: string, count: number) {
    return this.success(
      `${entityType}s actualizados`,
      `${count} ${entityType.toLowerCase()}${count > 1 ? 's' : ''} actualizado${count > 1 ? 's' : ''} exitosamente.`
    )
  }

  static bulkExported(entityType: string, count: number) {
    return this.success(
      'Exportación completada',
      `${count} ${entityType.toLowerCase()}${count > 1 ? 's' : ''} exportado${count > 1 ? 's' : ''} exitosamente.`
    )
  }

  // ============================================================================
  // SYSTEM NOTIFICATIONS
  // ============================================================================
  
  static systemMaintenance() {
    return this.warning(
      'Mantenimiento programado',
      'El sistema estará en mantenimiento. Algunas funciones pueden no estar disponibles.'
    )
  }

  static systemUpdated() {
    return this.info(
      'Sistema actualizado',
      'El sistema ha sido actualizado con nuevas funcionalidades.'
    )
  }

  static backupCompleted() {
    return this.success(
      'Respaldo completado',
      'El respaldo del sistema ha sido completado exitosamente.'
    )
  }

  static backupFailed() {
    return this.error(
      'Error en respaldo',
      'El respaldo del sistema ha fallado. Contacta al administrador.'
    )
  }

  // ============================================================================
  // AUTHENTICATION NOTIFICATIONS
  // ============================================================================
  
  static loginSuccess() {
    return this.success(
      'Sesión iniciada',
      'Has iniciado sesión exitosamente.'
    )
  }

  static logoutSuccess() {
    return this.info(
      'Sesión cerrada',
      'Has cerrado sesión exitosamente.'
    )
  }

  static sessionExpired() {
    return this.warning(
      'Sesión expirada',
      'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
    )
  }

  static passwordChanged() {
    return this.success(
      'Contraseña actualizada',
      'Tu contraseña ha sido actualizada exitosamente.'
    )
  }

  static profileUpdated() {
    return this.success(
      'Perfil actualizado',
      'Tu perfil ha sido actualizado exitosamente.'
    )
  }
}
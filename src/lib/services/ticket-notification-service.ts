/**
 * Ticket Notification Service
 * Specialized notifications for ticket management operations
 */

import { GlobalNotificationService } from './global-notification-service'

export class TicketNotificationService {
  
  // ============================================================================
  // TICKET CRUD OPERATIONS
  // ============================================================================
  
  static created(ticketTitle: string) {
    return GlobalNotificationService.ticketCreated(ticketTitle)
  }

  static updated(ticketTitle: string) {
    return GlobalNotificationService.ticketUpdated(ticketTitle)
  }

  static deleted(ticketTitle: string) {
    return GlobalNotificationService.ticketDeleted(ticketTitle)
  }

  // ============================================================================
  // TICKET STATUS OPERATIONS
  // ============================================================================
  
  static statusChanged(ticketTitle: string, newStatus: string) {
    const statusLabels = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En Progreso',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado'
    }
    
    return GlobalNotificationService.ticketStatusChanged(
      ticketTitle, 
      statusLabels[newStatus as keyof typeof statusLabels] || newStatus
    )
  }

  static priorityChanged(ticketTitle: string, newPriority: string) {
    const priorityLabels = {
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta',
      URGENT: 'Urgente'
    }
    
    return GlobalNotificationService.ticketPriorityChanged(
      ticketTitle,
      priorityLabels[newPriority as keyof typeof priorityLabels] || newPriority
    )
  }

  static assigned(ticketTitle: string, technicianName: string) {
    return GlobalNotificationService.ticketAssigned(ticketTitle, technicianName)
  }

  static unassigned(ticketTitle: string) {
    return GlobalNotificationService.warning(
      'Ticket desasignado',
      `"${ticketTitle}" ha sido desasignado y está disponible para reasignación.`
    )
  }

  static reassigned(ticketTitle: string, oldTechnician: string, newTechnician: string) {
    return GlobalNotificationService.info(
      'Ticket reasignado',
      `"${ticketTitle}" ha sido reasignado de ${oldTechnician} a ${newTechnician}.`
    )
  }

  // ============================================================================
  // TICKET ACTIVITY OPERATIONS
  // ============================================================================
  
  static commentAdded(ticketTitle: string, commenterName: string) {
    return GlobalNotificationService.info(
      'Nuevo comentario',
      `${commenterName} ha agregado un comentario a "${ticketTitle}".`
    )
  }

  static attachmentAdded(ticketTitle: string, fileName: string) {
    return GlobalNotificationService.info(
      'Archivo adjuntado',
      `Se ha adjuntado "${fileName}" al ticket "${ticketTitle}".`
    )
  }

  static attachmentRemoved(ticketTitle: string, fileName: string) {
    return GlobalNotificationService.warning(
      'Archivo eliminado',
      `Se ha eliminado "${fileName}" del ticket "${ticketTitle}".`
    )
  }

  // ============================================================================
  // TICKET ESCALATION OPERATIONS
  // ============================================================================
  
  static escalated(ticketTitle: string, reason: string) {
    return GlobalNotificationService.warning(
      'Ticket escalado',
      `"${ticketTitle}" ha sido escalado: ${reason}`
    )
  }

  static overdue(ticketTitle: string, daysPastDue: number) {
    return GlobalNotificationService.error(
      'Ticket vencido',
      `"${ticketTitle}" está vencido por ${daysPastDue} día${daysPastDue > 1 ? 's' : ''}. Requiere atención inmediata.`
    )
  }

  static nearDeadline(ticketTitle: string, hoursRemaining: number) {
    return GlobalNotificationService.warning(
      'Ticket próximo a vencer',
      `"${ticketTitle}" vence en ${hoursRemaining} hora${hoursRemaining > 1 ? 's' : ''}. Considera priorizarlo.`
    )
  }

  // ============================================================================
  // TICKET CATEGORY OPERATIONS
  // ============================================================================
  
  static categoryChanged(ticketTitle: string, oldCategory: string, newCategory: string) {
    return GlobalNotificationService.info(
      'Categoría actualizada',
      `"${ticketTitle}" ha sido movido de "${oldCategory}" a "${newCategory}".`
    )
  }

  static autoAssigned(ticketTitle: string, technicianName: string, categoryName: string) {
    return GlobalNotificationService.success(
      'Ticket auto-asignado',
      `"${ticketTitle}" ha sido asignado automáticamente a ${technicianName} por la categoría "${categoryName}".`
    )
  }

  // ============================================================================
  // ERROR SCENARIOS
  // ============================================================================
  
  static createError(error?: string) {
    return GlobalNotificationService.createError('Ticket', error)
  }

  static updateError(error?: string) {
    return GlobalNotificationService.updateError('Ticket', error)
  }

  static deleteError(error?: string) {
    return GlobalNotificationService.deleteError('Ticket', error)
  }

  static loadError(error?: string) {
    return GlobalNotificationService.loadError('Ticket', error)
  }

  static assignmentError(ticketTitle: string, error?: string) {
    return GlobalNotificationService.error(
      'Error en asignación',
      error || `No se pudo asignar el ticket "${ticketTitle}". Inténtalo de nuevo.`
    )
  }

  static statusChangeError(ticketTitle: string, error?: string) {
    return GlobalNotificationService.error(
      'Error al cambiar estado',
      error || `No se pudo cambiar el estado de "${ticketTitle}". Inténtalo de nuevo.`
    )
  }

  static commentError(ticketTitle: string, error?: string) {
    return GlobalNotificationService.error(
      'Error al agregar comentario',
      error || `No se pudo agregar el comentario a "${ticketTitle}". Inténtalo de nuevo.`
    )
  }

  static attachmentError(fileName: string, error?: string) {
    return GlobalNotificationService.error(
      'Error con archivo',
      error || `No se pudo procesar el archivo "${fileName}". Verifica el formato y tamaño.`
    )
  }

  // ============================================================================
  // VALIDATION ERRORS
  // ============================================================================
  
  static invalidStatusTransition(currentStatus: string, targetStatus: string) {
    return GlobalNotificationService.validationError(
      `No se puede cambiar el estado de "${currentStatus}" a "${targetStatus}". Transición no válida.`
    )
  }

  static missingRequiredFields(fields: string[]) {
    return GlobalNotificationService.validationError(
      `Campos requeridos faltantes: ${fields.join(', ')}.`
    )
  }

  static invalidPriority(priority: string) {
    return GlobalNotificationService.validationError(
      `Prioridad "${priority}" no válida. Usa: Baja, Media, Alta o Urgente.`
    )
  }

  static invalidCategory(categoryName: string) {
    return GlobalNotificationService.validationError(
      `La categoría "${categoryName}" no existe o no está activa.`
    )
  }

  static noTechnicianAvailable(categoryName: string) {
    return GlobalNotificationService.warning(
      'Sin técnicos disponibles',
      `No hay técnicos disponibles para la categoría "${categoryName}". El ticket quedará sin asignar.`
    )
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================
  
  static bulkDeleted(count: number) {
    return GlobalNotificationService.bulkDeleted('Ticket', count)
  }

  static bulkUpdated(count: number) {
    return GlobalNotificationService.bulkUpdated('Ticket', count)
  }

  static bulkAssigned(count: number, technicianName: string) {
    return GlobalNotificationService.success(
      'Tickets asignados',
      `${count} ticket${count > 1 ? 's' : ''} asignado${count > 1 ? 's' : ''} a ${technicianName} exitosamente.`
    )
  }

  static bulkStatusChanged(count: number, newStatus: string) {
    const statusLabels = {
      OPEN: 'Abierto',
      IN_PROGRESS: 'En Progreso',
      RESOLVED: 'Resuelto',
      CLOSED: 'Cerrado'
    }
    
    return GlobalNotificationService.success(
      'Estados actualizados',
      `${count} ticket${count > 1 ? 's' : ''} cambiado${count > 1 ? 's' : ''} a "${statusLabels[newStatus as keyof typeof statusLabels] || newStatus}" exitosamente.`
    )
  }

  static bulkExported(count: number) {
    return GlobalNotificationService.bulkExported('Ticket', count)
  }

  // ============================================================================
  // IMPORT/EXPORT OPERATIONS
  // ============================================================================
  
  static importCompleted(imported: number, skipped: number = 0) {
    return GlobalNotificationService.success(
      'Importación completada',
      `${imported} ticket${imported > 1 ? 's' : ''} importado${imported > 1 ? 's' : ''} exitosamente.${skipped > 0 ? ` ${skipped} omitido${skipped > 1 ? 's' : ''}.` : ''}`
    )
  }

  static importError(error?: string) {
    return GlobalNotificationService.error(
      'Error en importación',
      error || 'No se pudo completar la importación de tickets.'
    )
  }

  static exportCompleted(count: number) {
    return GlobalNotificationService.success(
      'Exportación completada',
      `${count} ticket${count > 1 ? 's' : ''} exportado${count > 1 ? 's' : ''} exitosamente.`
    )
  }

  static exportError() {
    return GlobalNotificationService.error(
      'Error en exportación',
      'No se pudo completar la exportación de tickets.'
    )
  }

  // ============================================================================
  // SLA AND PERFORMANCE NOTIFICATIONS
  // ============================================================================
  
  static slaBreached(ticketTitle: string, slaType: string) {
    return GlobalNotificationService.error(
      'SLA incumplido',
      `"${ticketTitle}" ha incumplido el SLA de ${slaType}. Requiere atención inmediata.`
    )
  }

  static slaWarning(ticketTitle: string, slaType: string, timeRemaining: string) {
    return GlobalNotificationService.warning(
      'Advertencia de SLA',
      `"${ticketTitle}" está cerca de incumplir el SLA de ${slaType}. Tiempo restante: ${timeRemaining}.`
    )
  }

  static performanceAlert(metric: string, value: string, threshold: string) {
    return GlobalNotificationService.warning(
      'Alerta de rendimiento',
      `${metric}: ${value} (umbral: ${threshold}). Considera revisar la carga de trabajo.`
    )
  }

  // ============================================================================
  // CUSTOMER SATISFACTION
  // ============================================================================
  
  static feedbackReceived(ticketTitle: string, rating: number) {
    const ratingText = rating >= 4 ? 'excelente' : rating >= 3 ? 'buena' : 'necesita mejora'
    
    return GlobalNotificationService.info(
      'Feedback recibido',
      `Se recibió una calificación ${ratingText} (${rating}/5) para "${ticketTitle}".`
    )
  }

  static satisfactionSurveyCompleted(ticketTitle: string) {
    return GlobalNotificationService.success(
      'Encuesta completada',
      `El cliente completó la encuesta de satisfacción para "${ticketTitle}".`
    )
  }
}
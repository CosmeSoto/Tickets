import prisma from '@/lib/prisma'

export class CategoryNotificationService {
  /**
   * Notifica sobre la creación de una nueva categoría
   * El sistema de notificaciones unificado detectará automáticamente cambios importantes
   */
  static async notifyCategoryCreated(categoryId: string, createdBy: string) {
    try {
      // Log para auditoría - las notificaciones se generan automáticamente
      console.log(`[INFO] Category created: ${categoryId} by user ${createdBy}`)
    } catch (error) {
      console.error('[CRITICAL] Error in category creation notification:', error)
    }
  }

  /**
   * Notifica sobre la actualización de una categoría
   */
  static async notifyCategoryUpdated(categoryId: string, changes: any, updatedBy: string) {
    try {
      console.log(`[INFO] Category updated: ${categoryId} by user ${updatedBy}`)
    } catch (error) {
      console.error('[CRITICAL] Error in category update notification:', error)
    }
  }

  /**
   * Notifica sobre la eliminación de una categoría
   */
  static async notifyCategoryDeleted(categoryId: string, deletedBy: string) {
    try {
      console.log(`[INFO] Category deleted: ${categoryId} by user ${deletedBy}`)
    } catch (error) {
      console.error('[CRITICAL] Error in category deletion notification:', error)
    }
  }

  /**
   * Notifica sobre asignación de técnico a categoría
   */
  static async notifyTechnicianAssigned(categoryId: string, technicianId: string, assignedBy: string) {
    try {
      console.log(`[INFO] Technician ${technicianId} assigned to category ${categoryId} by ${assignedBy}`)
    } catch (error) {
      console.error('[CRITICAL] Error in technician assignment notification:', error)
    }
  }

  /**
   * Notifica sobre remoción de técnico de categoría
   */
  static async notifyTechnicianRemoved(categoryId: string, technicianId: string, removedBy: string) {
    try {
      console.log(`[INFO] Technician ${technicianId} removed from category ${categoryId} by ${removedBy}`)
    } catch (error) {
      console.error('[CRITICAL] Error in technician removal notification:', error)
    }
  }

  /**
   * Notifica sobre capacidad alta de categoría
   */
  static async notifyHighCapacity(categoryId: string, currentTickets: number, threshold: number) {
    try {
      console.log(`[INFO] High capacity alert for category ${categoryId}: ${currentTickets}/${threshold}`)
    } catch (error) {
      console.error('[CRITICAL] Error in high capacity notification:', error)
    }
  }
}
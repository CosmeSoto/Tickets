import { randomUUID } from 'crypto'
import { NotificationService } from '../services/notification-service'
import { getFamilyScopedAdmins } from '@/lib/notifications/family-recipients'
import { db as prisma } from '@/lib/server'

/**
 * Job para verificar asignaciones con fecha de devolución próxima
 * Se ejecuta diariamente mediante el cron de inventory-alerts
 */
export class CheckAssignmentExpirationJob {
  /**
   * Obtiene asignaciones activas cuya fecha de fin está próxima
   */
  static async getExpiringAssignments(daysBeforeExpiration: number) {
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiration)
    targetDate.setHours(23, 59, 59, 999)
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    return prisma.equipment_assignments.findMany({
      where: {
        isActive: true,
        endDate: {
          gte: startOfDay,
          lte: targetDate,
        },
      },
      include: {
        equipment: {
          select: {
            id: true,
            code: true,
            brand: true,
            modelDeprecated: true,
            type: { select: { familyId: true } },
          },
        },
        receiver: { select: { id: true, name: true, email: true } },
        deliverer: { select: { id: true, name: true, email: true } },
      },
    })
  }

  /**
   * Envía notificaciones de vencimiento próximo a admins y al receptor
   */
  static async sendExpirationNotifications(daysBeforeExpiration: number): Promise<number> {
    console.log(
      `[CheckAssignmentExpirationJob] Verificando asignaciones que vencen en ${daysBeforeExpiration} días...`
    )

    const expiring = await this.getExpiringAssignments(daysBeforeExpiration)

    if (expiring.length === 0) {
      console.log('[CheckAssignmentExpirationJob] No hay asignaciones próximas a vencer')
      return 0
    }

    let sent = 0

    for (const assignment of expiring) {
      const eq = assignment.equipment
      const receiver = assignment.receiver
      const endDate = assignment.endDate!
      const formattedDate = endDate.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
      const equipmentLabel = `${eq.brand} ${eq.modelDeprecated} (${eq.code})`
      const familyAdmins = await getFamilyScopedAdmins(eq.type?.familyId ?? null, { id: true })

      // Notificar al receptor del equipo
      await NotificationService.createNotification({
        userId: receiver.id,
        title: `Devolución próxima — ${eq.code}`,
        message: `La devolución del equipo ${equipmentLabel} está programada para el ${formattedDate}. Coordina la entrega con tu administrador.`,
        type: 'WARNING',
        metadata: {
          equipmentId: eq.id,
          equipmentCode: eq.code,
          assignmentId: assignment.id,
          daysRemaining: daysBeforeExpiration,
          endDate: endDate.toISOString(),
        },
      })

      // Notificar a super admins + admin nativo de la familia del equipo
      for (const admin of familyAdmins) {
        await NotificationService.createNotification({
          userId: admin.id,
          title: `Asignación próxima a vencer — ${eq.code}`,
          message: `El equipo ${equipmentLabel} asignado a ${receiver.name} debe ser devuelto el ${formattedDate}.`,
          type: 'WARNING',
          metadata: {
            equipmentId: eq.id,
            equipmentCode: eq.code,
            assignmentId: assignment.id,
            receiverName: receiver.name,
            daysRemaining: daysBeforeExpiration,
            endDate: endDate.toISOString(),
          },
        })
      }

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'ASSIGNMENT_EXPIRY_ALERT',
          entityType: 'equipment',
          entityId: eq.id,
          details: {
            equipmentCode: eq.code,
            receiverName: receiver.name,
            endDate: endDate.toISOString(),
            daysRemaining: daysBeforeExpiration,
          },
        },
      })

      sent++
    }

    console.log(`[CheckAssignmentExpirationJob] ${sent} alertas enviadas`)
    return sent
  }

  /**
   * Punto de entrada principal — ejecuta alertas a 7 días y 1 día
   */
  static async run(): Promise<{ alertsSent: number }> {
    try {
      const [week, day] = await Promise.all([
        this.sendExpirationNotifications(7),
        this.sendExpirationNotifications(1),
      ])
      return { alertsSent: week + day }
    } catch (error) {
      console.error('[CheckAssignmentExpirationJob] Error:', error)
      throw error
    }
  }
}

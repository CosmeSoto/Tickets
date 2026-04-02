import { families, ticket_family_config } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

// ============================================================
// Interfaces
// ============================================================

export interface UpdateTicketFamilyConfigData {
  ticketsEnabled?: boolean
  codePrefix?: string
  isDefault?: boolean
  autoAssignRespectsFamilies?: boolean
  alertVolumeThreshold?: number | null
  businessHoursStart?: string
  businessHoursEnd?: string
  businessDays?: string
}

export interface FamilyWithTicketConfig {
  id: string
  code: string
  name: string
  color?: string | null
  icon?: string | null
  isActive: boolean
  order: number
  ticketFamilyConfig: {
    ticketsEnabled: boolean
    codePrefix?: string | null
    isDefault: boolean
    alertVolumeThreshold?: number | null
    businessHoursStart: string
    businessHoursEnd: string
    businessDays: string
  } | null
}

// ============================================================
// TicketFamilyConfigService
// ============================================================

export class TicketFamilyConfigService {
  /**
   * Retorna la configuración de tickets de una familia por su familyId.
   */
  static async getByFamilyId(familyId: string): Promise<ticket_family_config | null> {
    return prisma.ticket_family_config.findUnique({
      where: { familyId },
    })
  }

  /**
   * Actualiza la configuración de tickets de una familia y registra en audit log.
   * Si se marca isDefault = true, desmarca la familia por defecto anterior.
   */
  static async update(
    familyId: string,
    data: UpdateTicketFamilyConfigData,
    userId = 'system'
  ): Promise<ticket_family_config> {
    return prisma.$transaction(async (tx) => {
      // Si se está marcando como default, desmarcar la anterior
      if (data.isDefault === true) {
        await tx.ticket_family_config.updateMany({
          where: { isDefault: true, familyId: { not: familyId } },
          data: { isDefault: false },
        })
      }

      const previous = await tx.ticket_family_config.findUnique({
        where: { familyId },
      })

      const updated = await tx.ticket_family_config.update({
        where: { familyId },
        data: {
          ...(data.ticketsEnabled !== undefined && { ticketsEnabled: data.ticketsEnabled }),
          ...(data.codePrefix !== undefined && { codePrefix: data.codePrefix }),
          ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
          ...(data.autoAssignRespectsFamilies !== undefined && {
            autoAssignRespectsFamilies: data.autoAssignRespectsFamilies,
          }),
          ...(data.alertVolumeThreshold !== undefined && {
            alertVolumeThreshold: data.alertVolumeThreshold,
          }),
          ...(data.businessHoursStart !== undefined && {
            businessHoursStart: data.businessHoursStart,
          }),
          ...(data.businessHoursEnd !== undefined && { businessHoursEnd: data.businessHoursEnd }),
          ...(data.businessDays !== undefined && { businessDays: data.businessDays }),
        },
      })

      // Registrar en audit log (fuera de la transacción para no bloquear)
      // Se hace de forma asíncrona sin await para no afectar el flujo
      AuditServiceComplete.log({
        action: 'TICKET_FAMILY_CONFIG_UPDATED',
        entityType: 'settings',
        entityId: updated.id,
        userId,
        details: { familyId },
        oldValues: previous ?? undefined,
        newValues: updated,
      }).catch((err) => console.error('[TicketFamilyConfigService] Audit log error:', err))

      return updated
    })
  }

  /**
   * Retorna las familias con ticketsEnabled = true, incluyendo su configuración.
   * Usado en el selector de familia al crear un ticket.
   */
  static async getEnabledFamilies(): Promise<FamilyWithTicketConfig[]> {
    const families = await prisma.families.findMany({
      where: {
        isActive: true,
        ticketFamilyConfig: {
          ticketsEnabled: true,
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        color: true,
        icon: true,
        isActive: true,
        order: true,
        ticketFamilyConfig: {
          select: {
            ticketsEnabled: true,
            codePrefix: true,
            isDefault: true,
            alertVolumeThreshold: true,
            businessHoursStart: true,
            businessHoursEnd: true,
            businessDays: true,
          },
        },
      },
    })

    return families as FamilyWithTicketConfig[]
  }

  /**
   * Retorna la familia marcada como isDefault = true en ticket_family_config.
   */
  static async getDefaultFamily(): Promise<families | null> {
    const config = await prisma.ticket_family_config.findFirst({
      where: { isDefault: true },
      include: { family: true },
    })

    return config?.family ?? null
  }
}

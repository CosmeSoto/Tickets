import { families } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ============================================================
// Interfaces
// ============================================================

export interface CreateFamilyData {
  name: string
  code: string
  description?: string
  color?: string
  icon?: string
  order?: number
}

export interface UpdateFamilyData {
  name?: string
  description?: string
  color?: string
  icon?: string
  order?: number
}

export interface FamilyWithStats {
  id: string
  code: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  isActive: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  _count: {
    departments: number
    technicianFamilyAssignments: number
    managerFamilies: number
  }
  ticketFamilyConfig?: {
    ticketsEnabled: boolean
    codePrefix?: string | null
    isDefault: boolean
  } | null
  formConfig?: {
    id: string
  } | null
}

export interface FamilyWithConfig {
  id: string
  code: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  isActive: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  ticketFamilyConfig: {
    id: string
    familyId: string
    ticketsEnabled: boolean
    codePrefix?: string | null
    isDefault: boolean
    autoAssignRespectsFamilies: boolean
    alertVolumeThreshold?: number | null
    businessHoursStart: string
    businessHoursEnd: string
    businessDays: string
    createdAt: Date
    updatedAt: Date
  } | null
  formConfig: {
    id: string
    familyId: string
    requireFinancialForNew: boolean
    autoApproveDecommission: boolean
    requireDeliveryAct: boolean
    createdAt: Date
    updatedAt: Date
  } | null
}

// ============================================================
// FamilyService
// ============================================================

export class FamilyService {
  /**
   * Crea familia + ticket_family_config + inventory_family_config en una transacción.
   */
  static async create(data: CreateFamilyData): Promise<families> {
    return prisma.$transaction(async (tx) => {
      // 1. Crear registro base de familia
      const family = await tx.families.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          description: data.description,
          color: data.color ?? '#6B7280',
          icon: data.icon,
          order: data.order ?? 0,
        },
      })

      // 2. Crear ticket_family_config con defaults
      await tx.ticket_family_config.create({
        data: {
          familyId: family.id,
          ticketsEnabled: true,
          codePrefix: data.code.toUpperCase().slice(0, 10),
          isDefault: false,
        },
      })

      // 3. Crear inventory_family_config con defaults
      await tx.inventory_family_config.create({
        data: {
          familyId: family.id,
          allowedSubtypes: [],
          visibleSections: [],
          requiredSections: [],
          requireFinancialForNew: true,
          autoApproveDecommission: false,
          requireDeliveryAct: true,
        },
      })

      return family
    })
  }

  /**
   * Actualiza los datos base de la familia (no modifica las configs).
   */
  static async update(id: string, data: UpdateFamilyData): Promise<families> {
    return prisma.families.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.order !== undefined && { order: data.order }),
      },
    })
  }

  /**
   * Retorna familias con stats (conteo de depts, técnicos, managers).
   */
  static async findAll(includeInactive = false): Promise<FamilyWithStats[]> {
    const families = await prisma.families.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            departments: true,
            technicianFamilyAssignments: true,
            managerFamilies: true,
          },
        },
        ticketFamilyConfig: {
          select: {
            ticketsEnabled: true,
            codePrefix: true,
            isDefault: true,
          },
        },
        formConfig: {
          select: {
            id: true,
          },
        },
      },
    })

    return families as FamilyWithStats[]
  }

  /**
   * Retorna familia con ambas configs (ticket_family_config e inventory_family_config).
   */
  static async findById(id: string): Promise<FamilyWithConfig | null> {
    const family = await prisma.families.findUnique({
      where: { id },
      include: {
        ticketFamilyConfig: true,
        formConfig: true,
      },
    })

    if (!family) return null

    return family as unknown as FamilyWithConfig
  }

  /**
   * Activa o desactiva la familia sin eliminar registros asociados.
   */
  static async toggleActive(id: string): Promise<families> {
    const family = await prisma.families.findUnique({
      where: { id },
      select: { isActive: true },
    })

    if (!family) {
      throw new Error(`Familia con id "${id}" no encontrada`)
    }

    return prisma.families.update({
      where: { id },
      data: { isActive: !family.isActive },
    })
  }

  /**
   * Elimina la familia. Rechaza si hay tickets o registros de inventario asociados.
   */
  static async delete(id: string): Promise<void> {
    // Verificar tickets asociados
    const ticketCount = await prisma.tickets.count({
      where: { familyId: id },
    })

    if (ticketCount > 0) {
      throw new Error(
        `No se puede eliminar la familia: tiene ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} asociado${ticketCount !== 1 ? 's' : ''}`
      )
    }

    // Verificar tipos de equipo asociados
    const equipmentTypeCount = await prisma.equipment_types.count({
      where: { familyId: id },
    })

    if (equipmentTypeCount > 0) {
      throw new Error(
        `No se puede eliminar la familia: tiene ${equipmentTypeCount} tipo${equipmentTypeCount !== 1 ? 's' : ''} de equipo asociado${equipmentTypeCount !== 1 ? 's' : ''}`
      )
    }

    await prisma.families.delete({ where: { id } })
  }
}

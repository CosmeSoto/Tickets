import { prisma } from '@/lib/prisma'
import { ValidationService } from './validation-inventory.service'
import { EquipmentFilters } from '@/types/inventory/equipment-inventory'
import { IndividualEquipmentInput } from '../schemas/equipment-inventory.schema'

/** Include estándar para equipos con relaciones comunes */
const EQUIPMENT_INCLUDE = {
  type: true,
  department: true,
  warehouse: true,
  model: true,
} as const

/** Construye el objeto where de Prisma a partir de filtros */
function buildEquipmentWhere(filters?: EquipmentFilters) {
  const where: Record<string, unknown> = {}

  if (filters?.batchId) where.batchId = filters.batchId
  if (filters?.modelId) where.modelId = filters.modelId
  if (filters?.typeId) where.typeId = filters.typeId
  if (filters?.departmentId) where.departmentId = filters.departmentId
  if (filters?.warehouseId) where.warehouseId = filters.warehouseId
  if (filters?.status) where.status = filters.status
  if (filters?.condition) where.condition = filters.condition

  if (filters?.search) {
    where.OR = [
      { code: { contains: filters.search, mode: 'insensitive' } },
      { serialNumber: { contains: filters.search, mode: 'insensitive' } },
      { brand: { contains: filters.search, mode: 'insensitive' } },
      { model_old: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  return where
}

export class EquipmentService {
  /** Crear equipo individual */
  static async createIndividual(data: IndividualEquipmentInput & { userId: string }) {
    const codeValidation = await ValidationService.validateCodeUniqueness(data.code)
    if (!codeValidation.isValid) throw new Error(codeValidation.message)

    if (data.serialNumber) {
      const serialValidation = await ValidationService.validateSerialUniqueness(data.serialNumber)
      if (!serialValidation.isValid) throw new Error(serialValidation.message)
    }

    const model = await prisma.equipment_models.findUnique({
      where: { id: data.modelId },
      include: { type: true },
    })
    if (!model) throw new Error('Modelo no encontrado')

    // qrCode es requerido — generamos uno único
    const qrCode = `EQ-${data.code}-${Date.now()}`

    return prisma.equipment.create({
      data: {
        code: data.code,
        serialNumber: data.serialNumber || '',
        modelId: data.modelId,
        brand: model.brand,
        model_old: model.model,
        typeId: model.typeId,
        departmentId: data.departmentId,
        warehouseId: data.warehouseId,
        location: data.physicalLocation,
        condition: (data.condition as any) || 'GOOD',
        ownershipType: (data.propertyType as any) || 'FIXED_ASSET',
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchasePrice: data.purchasePrice,
        accessories: data.accessories?.map(a => a.name) || [],
        notes: data.notes,
        status: 'AVAILABLE' as any,
        batchId: null,
        qrCode,
      },
      include: EQUIPMENT_INCLUDE,
    })
  }

  /** Actualizar equipo */
  static async update(id: string, data: Partial<IndividualEquipmentInput>) {
    if (data.code) {
      const v = await ValidationService.validateCodeUniqueness(data.code, id)
      if (!v.isValid) throw new Error(v.message)
    }
    if (data.serialNumber) {
      const v = await ValidationService.validateSerialUniqueness(data.serialNumber, id)
      if (!v.isValid) throw new Error(v.message)
    }

    return prisma.equipment.update({
      where: { id },
      data: {
        code: data.code,
        serialNumber: data.serialNumber,
        departmentId: data.departmentId,
        warehouseId: data.warehouseId,
        location: data.physicalLocation,
        condition: data.condition as any,
        ownershipType: data.propertyType as any,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        purchasePrice: data.purchasePrice,
        accessories: data.accessories?.map(a => a.name),
        notes: data.notes,
      },
      include: EQUIPMENT_INCLUDE,
    })
  }

  /** Eliminar equipo — marca como RETIRED (no hay deletedAt en este modelo) */
  static async delete(id: string) {
    return prisma.equipment.update({
      where: { id },
      data: { status: 'RETIRED' },
    })
  }

  /** Obtener todos los equipos con filtros */
  static async getAll(filters?: EquipmentFilters) {
    return prisma.equipment.findMany({
      where: buildEquipmentWhere(filters),
      include: EQUIPMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  /** Obtener equipos con paginación */
  static async getPaginated(page = 1, pageSize = 20, filters?: EquipmentFilters) {
    const where = buildEquipmentWhere(filters)
    const [data, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        include: EQUIPMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.equipment.count({ where }),
    ])

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  /** Obtener equipo por ID con todas las relaciones */
  static async getById(id: string) {
    return prisma.equipment.findUnique({
      where: { id },
      include: {
        ...EQUIPMENT_INCLUDE,
        model: { include: { type: true } },
        assignments: {
          include: { receiver: true },
          orderBy: { createdAt: 'desc' },
        },
        maintenanceRecords: {
          include: { technician: true },
          orderBy: { date: 'desc' },
        },
      },
    })
  }
}

/**
 * Servicio de Gestión de Lotes de Equipos
 * Maneja la creación y gestión de lotes de compra (equipment_batches)
 */

import prisma from '@/lib/prisma'
import { EquipmentStatus } from '@prisma/client'
import { generateSequentialCodes, validateManualCodes } from './code-generator.service'

export interface CreateBatchInput {
  batchCode?: string
  description?: string
  modelId: string
  quantity: number
  serialNumbers: string[]
  supplierId?: string
  purchaseDate?: Date
  unitPrice: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
  warehouseId?: string
  receivedBy: string
  notes?: string
  // Datos del equipo
  brand?: string
  model?: string
  typeId?: string
  departmentId?: string
  condition?: string
  ownershipType: string
  accessories?: string[]
  customValues?: Array<{ fieldName: string; fieldValue: string }>
  photoUrl?: string
  // Códigos
  codeMode?: 'auto' | 'manual'
  manualCodes?: string[]
  // Depreciación
  depreciationMethod?: string
  usefulLifeYears?: number
  residualValue?: number
  totalUnits?: number
  usedUnits?: number
  // Familia
  familyId?: string
}

export interface BatchCreateResult {
  batch: {
    id: string
    batchCode: string
    description: string | null
    modelId: string
    quantity: number
    supplierId: string
    purchaseDate: Date
    unitPrice: number
    totalPrice: number
    invoiceNumber: string | null
    purchaseOrderNumber: string | null
    warehouseId: string
    status: string
    receivedBy: string
    receivedAt: Date
    notes: string | null
    createdAt: Date
    updatedAt: Date
  }
  equipment: Array<{
    id: string
    code: string
    serialNumber: string
    status: string
    createdAt: Date
  }>
  summary: {
    batchCode: string
    totalEquipment: number
    totalPrice: number
    firstCode: string
    lastCode: string
    message: string
  }
}

/**
 * Genera un código de lote único
 */
async function generateBatchCode(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `LOTE-${year}`

  // Obtener el último lote del año
  const lastBatch = await prisma.equipment_batches.findFirst({
    where: {
      batchCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      batchCode: 'desc',
    },
  })

  let nextNumber = 1
  if (lastBatch) {
    const match = lastBatch.batchCode.match(/-(\d+)$/)
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1
    }
  }

  return `${prefix}-${nextNumber.toString().padStart(4, '0')}`
}

/**
 * Crea un lote de equipos con sus instancias
 */
export async function createBatch(input: CreateBatchInput): Promise<BatchCreateResult> {
  try {
    // ── Validaciones básicas ───────────────────────────────────────────────
    const codeMode = input.codeMode || 'auto'

    // Seriales: si se proporcionan deben coincidir con la cantidad
    const serialNumbers = (input.serialNumbers || []).filter(s => s.trim().length > 0)
    if (serialNumbers.length > 0 && serialNumbers.length !== input.quantity) {
      throw new Error(
        `La cantidad (${input.quantity}) no coincide con el número de seriales proporcionados (${serialNumbers.length})`
      )
    }

    // Verificar seriales duplicados en el input
    if (serialNumbers.length > 0) {
      const uniqueSerials = new Set(serialNumbers)
      if (uniqueSerials.size !== serialNumbers.length) {
        throw new Error('Hay números de serie duplicados en la lista')
      }
      // Verificar que los seriales no existan en la BD
      const existingSerials = await prisma.equipment.findMany({
        where: { serialNumber: { in: serialNumbers } },
        select: { serialNumber: true },
      })
      if (existingSerials.length > 0) {
        const duplicates = existingSerials.map(e => e.serialNumber).join(', ')
        throw new Error(`Los siguientes números de serie ya existen: ${duplicates}`)
      }
    }

    // ── Obtener modelo ─────────────────────────────────────────────────────
    const model = await prisma.equipment_models.findUnique({
      where: { id: input.modelId },
      include: { type: { include: { family: true } } },
    })
    if (!model) throw new Error('Modelo no encontrado')
    if (!model.type.family) throw new Error('El tipo de equipo debe tener una familia asignada')

    // ── Validar proveedor si se proporciona ────────────────────────────────
    if (input.supplierId) {
      const supplierExists = await prisma.suppliers.findUnique({ where: { id: input.supplierId } })
      if (!supplierExists) throw new Error('Proveedor no encontrado')
    }

    // ── Validar bodega si se proporciona ───────────────────────────────────
    if (input.warehouseId) {
      const warehouseExists = await prisma.warehouses.findUnique({
        where: { id: input.warehouseId },
      })
      if (!warehouseExists) throw new Error('Bodega no encontrada')
    }

    // ── Generar o validar códigos ──────────────────────────────────────────
    let codes: string[]

    if (codeMode === 'manual' && input.manualCodes && input.manualCodes.length > 0) {
      codes = input.manualCodes
      const validation = await validateManualCodes(codes)
      if (!validation.valid) {
        throw new Error(`Los siguientes códigos ya existen: ${validation.duplicates.join(', ')}`)
      }
    } else {
      // Auto: generar códigos secuenciales
      const familyCode = model.type.family.code
      const typeCode = model.type.code
      const year = new Date().getFullYear()
      codes = await generateSequentialCodes(
        input.quantity,
        familyCode,
        typeCode,
        input.ownershipType,
        year
      )
    }

    // ── Generar código de lote ─────────────────────────────────────────────
    const batchCode = input.batchCode || (await generateBatchCode())
    const existingBatch = await prisma.equipment_batches.findUnique({ where: { batchCode } })
    if (existingBatch) throw new Error(`El código de lote ${batchCode} ya existe`)

    const totalPrice = input.unitPrice * input.quantity

    // ── Crear lote y equipos en transacción ───────────────────────────────
    const result = await prisma.$transaction(async tx => {
      // 1. Crear el lote
      const batch = await tx.equipment_batches.create({
        data: {
          batchCode,
          description:
            input.description || `Lote de ${input.quantity} ${model.brand} ${model.model}`,
          modelId: input.modelId,
          quantity: input.quantity,
          supplierId: input.supplierId || model.type.family!.id, // fallback temporal
          purchaseDate: input.purchaseDate || new Date(),
          unitPrice: input.unitPrice,
          totalPrice,
          invoiceNumber: input.invoiceNumber,
          purchaseOrderNumber: input.purchaseOrderNumber,
          warehouseId: input.warehouseId || '',
          status: 'received',
          receivedBy: input.receivedBy,
          receivedAt: new Date(),
          notes: input.notes,
          // Campos del formulario unificado
          customValues: input.customValues ? JSON.parse(JSON.stringify(input.customValues)) : null,
          accessories: input.accessories || [],
          condition: input.condition || 'GOOD',
          propertyType: input.ownershipType,
          departmentId: input.departmentId || null,
        },
      })

      // 2. Crear los equipos con todos los campos
      const equipmentData = codes.map((code, index) => {
        const qrCode = `EQ-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        return {
          code,
          serialNumber: serialNumbers.length > 0 ? serialNumbers[index] : '',
          modelId: input.modelId,
          batchId: batch.id,
          typeId: input.typeId || model.typeId,
          departmentId: input.departmentId || null,
          status: EquipmentStatus.AVAILABLE,
          condition: (input.condition || 'GOOD') as any,
          ownershipType: input.ownershipType as any,
          acquisitionMode: input.ownershipType as any,
          purchasePrice: input.unitPrice || null,
          supplierId: input.supplierId || null,
          purchaseDate: input.purchaseDate || null,
          invoiceNumber: input.invoiceNumber || null,
          purchaseOrderNumber: input.purchaseOrderNumber || null,
          accessories: input.accessories || model.defaultAccessories || [],
          photoUrl: input.photoUrl || model.modelPhotoUrl || null,
          warehouseId: input.warehouseId || null,
          notes: input.notes || null,
          // Depreciación
          depreciationMethod:
            input.ownershipType === 'FIXED_ASSET' && input.depreciationMethod
              ? (input.depreciationMethod as any)
              : null,
          usefulLifeYears:
            input.ownershipType === 'FIXED_ASSET' && input.usefulLifeYears
              ? input.usefulLifeYears
              : null,
          residualValue:
            input.ownershipType === 'FIXED_ASSET' && input.residualValue != null
              ? input.residualValue
              : 0,
          totalUnits: input.totalUnits || null,
          usedUnits: input.usedUnits || null,
          // Campos requeridos
          qrCode,
          brand: model.brand,
          model_old: model.model,
          location: null,
          physicalLocation: null,
        }
      })

      await tx.equipment.createMany({ data: equipmentData })

      // 3. Obtener los equipos creados
      const createdEquipment = await tx.equipment.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true, serialNumber: true, status: true, createdAt: true },
        orderBy: { code: 'asc' },
      })

      return { batch, equipment: createdEquipment }
    })

    const summary = {
      batchCode: result.batch.batchCode,
      totalEquipment: result.equipment.length,
      totalPrice,
      firstCode: codes[0],
      lastCode: codes[codes.length - 1],
      message: `Se creó el lote ${result.batch.batchCode} con ${result.equipment.length} equipos: ${codes[0]} a ${codes[codes.length - 1]}`,
    }

    return {
      batch: result.batch,
      equipment: result.equipment,
      summary,
    }
  } catch (error: any) {
    console.error('Error creando lote:', error)
    throw error
  }
}

/**
 * Obtiene un lote por ID
 */
export async function getBatchById(id: string) {
  try {
    const batch = await prisma.equipment_batches.findUnique({
      where: { id },
      include: {
        model: {
          include: {
            type: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true,
            email: true,
            phone: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!batch) {
      throw new Error('Lote no encontrado')
    }

    return batch
  } catch (error: any) {
    console.error('Error obteniendo lote:', error)
    throw error
  }
}

/**
 * Obtiene lotes por modelo
 */
export async function getBatchesByModel(modelId: string) {
  try {
    const batches = await prisma.equipment_batches.findMany({
      where: { modelId },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: 'desc',
      },
    })

    return batches
  } catch (error: any) {
    console.error('Error obteniendo lotes por modelo:', error)
    throw error
  }
}

/**
 * Actualiza el estado de un lote
 */
export async function updateBatchStatus(id: string, status: string) {
  try {
    const batch = await prisma.equipment_batches.update({
      where: { id },
      data: { status },
    })

    return batch
  } catch (error: any) {
    console.error('Error actualizando estado de lote:', error)
    throw error
  }
}

/**
 * Lista lotes con paginación y filtros
 */
export async function listBatches(params: {
  page?: number
  limit?: number
  modelId?: string
  supplierId?: string
  warehouseId?: string
  status?: string
  startDate?: Date
  endDate?: Date
  /** Si se pasa, filtra solo lotes cuyo tipo de equipo pertenece a esas familias */
  allowedFamilyIds?: string[]
}) {
  try {
    const {
      page = 1,
      limit = 50,
      modelId,
      supplierId,
      warehouseId,
      status,
      startDate,
      endDate,
      allowedFamilyIds,
    } = params

    const where: Prisma.equipment_batchesWhereInput = {
      ...(modelId && { modelId }),
      ...(supplierId && { supplierId }),
      ...(warehouseId && { warehouseId }),
      ...(status && { status }),
      ...(startDate && endDate && { purchaseDate: { gte: startDate, lte: endDate } }),
      // Filtro por familias permitidas — a través del modelo → tipo → familia
      ...(allowedFamilyIds &&
        allowedFamilyIds.length > 0 && {
          model: { type: { familyId: { in: allowedFamilyIds } } },
        }),
    }

    const [batches, total] = await Promise.all([
      prisma.equipment_batches.findMany({
        where,
        include: {
          model: {
            select: {
              id: true,
              brand: true,
              model: true,
              sku: true,
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          purchaseDate: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.equipment_batches.count({ where }),
    ])

    return {
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error: any) {
    console.error('Error listando lotes:', error)
    throw error
  }
}

/**
 * Obtiene equipos de un lote
 */
export async function getBatchEquipment(batchId: string) {
  try {
    const equipment = await prisma.equipment.findMany({
      where: { batchId },
      select: {
        id: true,
        code: true,
        serialNumber: true,
        status: true,
        condition: true,
        location: true,
        physicalLocation: true,
        createdAt: true,
      },
      orderBy: {
        code: 'asc',
      },
    })

    return equipment
  } catch (error: any) {
    console.error('Error obteniendo equipos del lote:', error)
    throw error
  }
}

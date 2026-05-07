/**
 * Servicio de Gestión de Lotes de Equipos
 * Maneja la creación y gestión de lotes de compra (equipment_batches)
 */

import prisma from '@/lib/prisma'
import { EquipmentStatus, Prisma } from '@prisma/client'
import { generateSequentialCodes } from './code-generator.service'

export interface CreateBatchInput {
  batchCode?: string
  description?: string
  modelId: string
  quantity: number
  serialNumbers: string[]
  supplierId: string
  purchaseDate: Date
  unitPrice: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
  warehouseId: string
  receivedBy: string
  notes?: string
  // Datos adicionales para los equipos
  condition?: string
  ownershipType: string
  accessories?: string[]
  photoUrl?: string
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
    // Validaciones
    if (input.quantity !== input.serialNumbers.length) {
      throw new Error(
        `La cantidad (${input.quantity}) no coincide con el número de seriales proporcionados (${input.serialNumbers.length})`
      )
    }

    // Verificar que no haya seriales duplicados en el input
    const uniqueSerials = new Set(input.serialNumbers)
    if (uniqueSerials.size !== input.serialNumbers.length) {
      throw new Error('Hay números de serie duplicados en la lista')
    }

    // Verificar que los seriales no existan en la BD
    const existingSerials = await prisma.equipment.findMany({
      where: {
        serialNumber: {
          in: input.serialNumbers,
        },
      },
      select: {
        serialNumber: true,
      },
    })

    if (existingSerials.length > 0) {
      const duplicates = existingSerials.map(e => e.serialNumber).join(', ')
      throw new Error(`Los siguientes números de serie ya existen: ${duplicates}`)
    }

    // Verificar que el modelo existe
    const model = await prisma.equipment_models.findUnique({
      where: { id: input.modelId },
      include: {
        type: {
          include: {
            family: true,
          },
        },
      },
    })

    if (!model) {
      throw new Error('Modelo no encontrado')
    }

    if (!model.type.family) {
      throw new Error('El tipo de equipo debe tener una familia asignada')
    }

    // Verificar que el proveedor existe
    const supplierExists = await prisma.suppliers.findUnique({
      where: { id: input.supplierId },
    })

    if (!supplierExists) {
      throw new Error('Proveedor no encontrado')
    }

    // Verificar que la bodega existe
    const warehouseExists = await prisma.warehouses.findUnique({
      where: { id: input.warehouseId },
    })

    if (!warehouseExists) {
      throw new Error('Bodega no encontrada')
    }

    // Generar código de lote si no se proporciona
    const batchCode = input.batchCode || (await generateBatchCode())

    // Verificar que el código de lote no exista
    const existingBatch = await prisma.equipment_batches.findUnique({
      where: { batchCode },
    })

    if (existingBatch) {
      throw new Error(`El código de lote ${batchCode} ya existe`)
    }

    // Generar códigos para los equipos
    const familyCode = model.type.family.code
    const typeCode = model.type.code
    const year = new Date().getFullYear()

    const codes = await generateSequentialCodes(
      input.quantity,
      familyCode,
      typeCode,
      input.ownershipType,
      year
    )

    // Calcular precio total
    const totalPrice = input.unitPrice * input.quantity

    // Crear lote y equipos en transacción
    const result = await prisma.$transaction(async tx => {
      // Crear el lote
      const batch = await tx.equipment_batches.create({
        data: {
          batchCode,
          description: input.description,
          modelId: input.modelId,
          quantity: input.quantity,
          supplierId: input.supplierId,
          purchaseDate: input.purchaseDate,
          unitPrice: input.unitPrice,
          totalPrice,
          invoiceNumber: input.invoiceNumber,
          purchaseOrderNumber: input.purchaseOrderNumber,
          warehouseId: input.warehouseId,
          status: 'received',
          receivedBy: input.receivedBy,
          receivedAt: new Date(),
          notes: input.notes,
        },
      })

      // Crear los equipos
      const equipmentData = codes.map((code, index) => ({
        code,
        serialNumber: input.serialNumbers[index],
        modelId: input.modelId,
        batchId: batch.id,
        typeId: model.typeId,
        departmentId: model.type.family.departmentId,
        status: EquipmentStatus.AVAILABLE,
        condition: input.condition || 'GOOD',
        ownershipType: input.ownershipType,
        purchasePrice: input.unitPrice,
        supplierId: input.supplierId,
        purchaseDate: input.purchaseDate,
        specifications: model.specifications || Prisma.JsonNull,
        accessories: input.accessories || model.defaultAccessories || [],
        photoUrl: input.photoUrl || model.modelPhotoUrl,
        warehouseId: input.warehouseId,
        // Campos deprecated (mantener por compatibilidad)
        brand: model.brand,
        model: model.model,
      }))

      await tx.equipment.createMany({
        data: equipmentData,
      })

      // Obtener los equipos creados
      const createdEquipment = await tx.equipment.findMany({
        where: {
          code: {
            in: codes,
          },
        },
        select: {
          id: true,
          code: true,
          serialNumber: true,
          status: true,
          createdAt: true,
        },
        orderBy: {
          code: 'asc',
        },
      })

      return {
        batch,
        equipment: createdEquipment,
      }
    })

    // Preparar resultado
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
    } = params

    const where: Prisma.equipment_batchesWhereInput = {
      ...(modelId && { modelId }),
      ...(supplierId && { supplierId }),
      ...(warehouseId && { warehouseId }),
      ...(status && { status }),
      ...(startDate &&
        endDate && {
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
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

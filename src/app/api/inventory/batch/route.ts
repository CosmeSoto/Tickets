import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const batchCommonDataSchema = z.object({
  modelId: z.string().min(1, 'El modelo es requerido'),
  supplierId: z.string().min(1, 'El proveedor es requerido'),
  departmentId: z.string().optional(),
  condition: z.string().optional(),
  propertyType: z.string().optional(),
  purchaseDate: z.string().optional(),
  unitPrice: z.number().optional(),
  invoiceNumber: z.string().optional(),
  purchaseOrderNumber: z.string().optional(),
  warehouseId: z.string().optional(),
  customValues: z.record(z.any()).optional(),
  accessories: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number(),
      })
    )
    .optional(),
  notes: z.string().optional(),
})

const batchIndividualDataSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  serialNumber: z.string().optional(),
  physicalLocation: z.string().optional(),
  warehouseId: z.string().optional(),
})

const createBatchSchema = z.object({
  commonData: batchCommonDataSchema,
  equipmentData: z.array(batchIndividualDataSchema).min(1, 'Debe haber al menos un equipo'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createBatchSchema.parse(body)
    const { commonData, equipmentData } = validatedData

    // Validar códigos únicos
    const codes = equipmentData.map(e => e.code)
    const uniqueCodes = new Set(codes)
    if (codes.length !== uniqueCodes.size) {
      return NextResponse.json({ error: 'Hay códigos duplicados en el lote' }, { status: 400 })
    }

    // Verificar que los códigos no existan en la BD
    const existingCodes = await prisma.equipment.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    })

    if (existingCodes.length > 0) {
      return NextResponse.json(
        {
          error: 'Algunos códigos ya existen',
          existingCodes: existingCodes.map(e => e.code),
        },
        { status: 400 }
      )
    }

    // Verificar números de serie si existen
    const serialNumbers = equipmentData.filter(e => e.serialNumber).map(e => e.serialNumber!)

    if (serialNumbers.length > 0) {
      const existingSerials = await prisma.equipment.findMany({
        where: { serialNumber: { in: serialNumbers } },
        select: { serialNumber: true },
      })

      if (existingSerials.length > 0) {
        return NextResponse.json(
          {
            error: 'Algunos números de serie ya existen',
            existingSerials: existingSerials.map(e => e.serialNumber),
          },
          { status: 400 }
        )
      }
    }

    // Obtener datos del modelo
    const model = await prisma.equipment_models.findUnique({
      where: { id: commonData.modelId },
      include: { type: true },
    })

    if (!model) {
      return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 })
    }

    // Generar código de lote
    const batchCode = `BATCH-${Date.now()}`
    const quantity = equipmentData.length
    const totalPrice = (commonData.unitPrice || 0) * quantity

    // Crear lote y equipos en transacción
    const result = await prisma.$transaction(async tx => {
      // 1. Crear el lote
      const batch = await tx.equipment_batches.create({
        data: {
          batchCode,
          description: `Lote de ${quantity} ${model.brand} ${model.model}`,
          modelId: commonData.modelId,
          quantity,
          supplierId: commonData.supplierId,
          purchaseDate: commonData.purchaseDate ? new Date(commonData.purchaseDate) : new Date(),
          unitPrice: commonData.unitPrice || 0,
          totalPrice,
          invoiceNumber: commonData.invoiceNumber,
          purchaseOrderNumber: commonData.purchaseOrderNumber,
          warehouseId: commonData.warehouseId || '',
          status: 'received',
          receivedBy: session.user.id,
          receivedAt: new Date(),
          notes: commonData.notes,
          customValues: commonData.customValues || {},
          accessories: commonData.accessories || [],
          condition: commonData.condition,
          propertyType: commonData.propertyType,
          departmentId: commonData.departmentId,
        },
      })

      // 2. Crear los equipos
      const equipmentPromises = equipmentData.map(item => {
        const qrCode = `EQ-${item.code}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        return tx.equipment.create({
          data: {
            code: item.code,
            serialNumber: item.serialNumber || '',
            modelId: commonData.modelId,
            brand: model.brand,
            modelDeprecated: model.model,
            typeId: model.typeId,
            batchId: batch.id,
            departmentId: commonData.departmentId,
            warehouseId: item.warehouseId || commonData.warehouseId,
            location: item.physicalLocation,
            condition: (commonData.condition || 'GOOD') as any,
            ownershipType: (commonData.propertyType || 'FIXED_ASSET') as any,
            purchaseDate: commonData.purchaseDate ? new Date(commonData.purchaseDate) : null,
            purchasePrice: commonData.unitPrice,
            accessories: commonData.accessories?.map(a => a.name) || [],
            notes: commonData.notes,
            status: 'AVAILABLE' as any,
            qrCode,
          },
        })
      })

      const equipment = await Promise.all(equipmentPromises)

      return { batch, equipment }
    })

    return NextResponse.json(
      {
        success: true,
        batchId: result.batch.id,
        batchCode: result.batch.batchCode,
        quantity: result.equipment.length,
        codes: result.equipment.map(e => e.code),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating batch:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      {
        error: 'Error al crear lote',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

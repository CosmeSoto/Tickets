import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

const createEquipmentSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  serialNumber: z.string().optional(),
  modelId: z.string().min(1, 'El modelo es requerido'),
  departmentId: z.string().optional(),
  warehouseId: z.string().optional(),
  physicalLocation: z.string().optional(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
  propertyType: z.enum(['FIXED_ASSET', 'RENTAL', 'LOAN']).optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: z.number().optional(),
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createEquipmentSchema.parse(body)

    // Verificar que el código no exista
    const existingCode = await prisma.equipment.findUnique({
      where: { code: validatedData.code },
    })

    if (existingCode) {
      return NextResponse.json({ error: 'El código ya existe' }, { status: 400 })
    }

    // Verificar número de serie si existe
    if (validatedData.serialNumber) {
      const existingSerial = await prisma.equipment.findFirst({
        where: { serialNumber: validatedData.serialNumber },
      })

      if (existingSerial) {
        return NextResponse.json({ error: 'El número de serie ya existe' }, { status: 400 })
      }
    }

    // Obtener datos del modelo (incluye marca para los campos deprecated)
    const model = await prisma.equipment_models.findUnique({
      where: { id: validatedData.modelId },
      include: { brand: true, type: true },
    })

    if (!model) {
      return NextResponse.json({ error: 'Modelo no encontrado' }, { status: 404 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    try {
      await assertInventoryManageByFamily(toInventoryAccessUser(session.user), model.type.familyId)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    // Crear el equipo
    const qrCode = `EQ-${validatedData.code}-${Date.now()}`
    const equipment = await prisma.equipment.create({
      data: {
        code: validatedData.code,
        serialNumber: validatedData.serialNumber || '',
        modelId: validatedData.modelId,
        brand: model.brand?.name ?? '',
        modelDeprecated: model.model,
        typeId: model.typeId,
        departmentId: validatedData.departmentId,
        warehouseId: validatedData.warehouseId,
        location: validatedData.physicalLocation,
        condition: (validatedData.condition || 'GOOD') as any,
        ownershipType: (validatedData.propertyType || 'FIXED_ASSET') as any,
        purchaseDate: validatedData.purchaseDate ? new Date(validatedData.purchaseDate) : null,
        purchasePrice: validatedData.purchasePrice,
        accessories: validatedData.accessories?.map(a => a.name) || [],
        notes: validatedData.notes,
        status: 'AVAILABLE' as any,
        batchId: null,
        qrCode,
      },
    })

    return NextResponse.json(
      {
        success: true,
        equipment: {
          id: equipment.id,
          code: equipment.code,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating equipment:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al crear equipo' }, { status: 500 })
  }
}

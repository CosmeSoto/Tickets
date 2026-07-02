/**
 * API Routes: Equipment Batches
 * GET /api/inventory/batches - List batches
 * POST /api/inventory/batches - Create batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  createBatch,
  listBatches,
  type CreateBatchInput,
} from '@/lib/services/equipment-batches.service'
import { canManageInventory, canManageAsset } from '@/lib/inventory-access'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'
import { invalidateCache } from '@/lib/api-cache'
import { z } from 'zod'
import { EquipmentCondition } from '@prisma/client'

const equipmentConditionSchema = z.nativeEnum(EquipmentCondition)

// Validation schema — acepta todos los campos del BulkEquipmentForm
const createBatchSchema = z
  .object({
    // Identificación del lote
    batchCode: z.string().max(50).optional(),
    description: z.string().optional(),
    modelId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),

    // Códigos y seriales
    codeMode: z.enum(['auto', 'manual']).default('auto'),
    manualCodes: z.array(z.string().min(1)).optional(),
    serialNumbers: z.array(z.string()).optional().default([]),

    // Datos comunes del equipo
    brand: z.string().min(1),
    model: z.string().min(1),
    typeId: z.string().uuid(),
    departmentId: z.string().uuid().optional().or(z.literal('')),
    condition: equipmentConditionSchema.optional().default(EquipmentCondition.NEW),
    warehouseId: z.string().uuid().optional().or(z.literal('')),
    accessories: z.array(z.string()).optional().default([]),
    customValues: z.array(z.object({ fieldName: z.string(), fieldValue: z.string() })).optional(),
    notes: z.string().optional(),
    photoUrl: z.string().url().optional().or(z.literal('')),

    // Adquisición
    acquisitionMode: z.enum(['FIXED_ASSET', 'RENTAL', 'LOAN']).default('FIXED_ASSET'),
    ownershipType: z.string().optional(), // alias de acquisitionMode para compatibilidad
    supplierId: z.string().uuid().optional().or(z.literal('')),
    purchaseDate: z
      .union([z.string(), z.date()])
      .optional()
      .transform(val => {
        if (!val) return undefined
        const d = val instanceof Date ? val : new Date(val)
        return isNaN(d.getTime()) ? undefined : d
      }),
    purchasePrice: z.number().positive().optional().or(z.literal(0)),
    invoiceNumber: z.string().max(100).optional(),
    purchaseOrderNumber: z.string().max(100).optional(),
    contractId: z.string().uuid().optional().or(z.literal('')),

    // Depreciación (solo FIXED_ASSET)
    depreciationMethod: z.string().optional(),
    usefulLifeYears: z.number().positive().optional(),
    residualValue: z.number().min(0).optional(),
    totalUnits: z.number().positive().optional(),
    usedUnits: z.number().min(0).optional(),

    // Familia (informativo / validación de acceso)
    familyId: z.string().uuid().optional(),
  })
  .refine(
    data =>
      data.codeMode !== 'manual' ||
      (Array.isArray(data.manualCodes) && data.manualCodes.length === data.quantity),
    {
      message: 'Debes proporcionar exactamente un código por unidad en modo manual',
      path: ['manualCodes'],
    }
  )
  .refine(
    data => {
      const serials = (data.serialNumbers ?? []).filter(s => s.trim().length > 0)
      return serials.length === 0 || serials.length === data.quantity
    },
    {
      message: 'La cantidad de números de serie debe coincidir con la cantidad del lote',
      path: ['serialNumbers'],
    }
  )

/**
 * GET /api/inventory/batches
 * List equipment batches with pagination and filters.
 * Filtra por familia según el rol:
 * - SuperAdmin: todos los lotes
 * - Admin normal: lotes de sus familias asignadas
 * - Gestor (canManageInventory): lotes de sus familias en inventory_manager_families
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const role = session.user.role
    const userId = session.user.id
    const invCtx = await getInventorySessionContext(session.user)
    const isSuperAdmin = invCtx.user.isSuperAdmin

    // Solo ADMIN y gestores pueden ver lotes
    if (role !== 'ADMIN' && !invCtx.canManageInventory) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Determinar familias accesibles según rol
    let allowedFamilyIds: string[] | null = null // null = sin restricción (superadmin)

    if (role === 'ADMIN' && !isSuperAdmin) {
      // Admin Normal: usar scope específico de inventario
      const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
      const invFamilyIds = await getModuleFamilyIds(userId, 'inventory')
      if (invFamilyIds.length > 0) {
        allowedFamilyIds = invFamilyIds
      } else {
        allowedFamilyIds = [] // Sin acceso
      }
    } else if (role !== 'ADMIN' && invCtx.canManageInventory) {
      // Gestor: solo sus familias de inventario
      const assignments = await prisma.inventory_manager_families.findMany({
        where: { managerId: userId },
        select: { familyId: true },
      })
      allowedFamilyIds = assignments.map(a => a.familyId)
    }
    // SuperAdmin → allowedFamilyIds = null (sin restricción)

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const modelId = searchParams.get('modelId') || undefined
    const supplierId = searchParams.get('supplierId') || undefined
    const warehouseId = searchParams.get('warehouseId') || undefined
    const status = searchParams.get('status') || undefined
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined

    const result = await listBatches({
      page,
      limit,
      modelId,
      supplierId,
      warehouseId,
      status,
      startDate,
      endDate,
      allowedFamilyIds: allowedFamilyIds ?? undefined,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error listing batches:', error)
    return NextResponse.json({ error: error.message || 'Error al listar lotes' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/batches
 * Create a new equipment batch with equipment instances
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = createBatchSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const data: CreateBatchInput = {
      ...validationResult.data,
      // acquisitionMode tiene prioridad sobre ownershipType legacy
      ownershipType:
        validationResult.data.acquisitionMode ||
        validationResult.data.ownershipType ||
        'FIXED_ASSET',
      // unitPrice = purchasePrice del formulario nuevo
      unitPrice: validationResult.data.purchasePrice || 0,
      // serialNumbers puede ser vacío en el nuevo formulario
      serialNumbers: validationResult.data.serialNumbers || [],
      contractId: validationResult.data.contractId || undefined,
      receivedBy: session.user.id,
    }

    // Verificar acceso a la familia del lote
    const model = await prisma.equipment_models.findUnique({
      where: { id: data.modelId },
      select: { type: { select: { familyId: true } } },
    })
    const assetFamilyId = model?.type?.familyId ?? data.familyId ?? null
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    if (session.user.role !== 'ADMIN' || !isSuperAdmin) {
      const allowed = await canManageAsset(
        session.user.id,
        session.user.role,
        isSuperAdmin,
        assetFamilyId
      )
      if (!allowed) {
        return NextResponse.json(
          { error: 'No tienes permiso para crear lotes en esta área' },
          { status: 403 }
        )
      }
    }

    const result = await createBatch(data)

    // Invalidate relevant caches
    await invalidateCache('equipment:*')
    await invalidateCache(`model:${data.modelId}:*`)

    return NextResponse.json({ ...result, message: result.summary.message }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating batch:', error)

    if (error.message.includes('ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    if (error.message.includes('no coincide') || error.message.includes('duplicados')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: error.message || 'Error al crear lote' }, { status: 500 })
  }
}

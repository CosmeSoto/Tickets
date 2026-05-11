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
import { canManageInventory } from '@/lib/inventory-access'
import { invalidateCache } from '@/lib/api-cache'
import { z } from 'zod'

// Validation schema — acepta todos los campos del BulkEquipmentForm
const createBatchSchema = z.object({
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
  condition: z.string().optional().default('GOOD'),
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
    .string()
    .optional()
    .or(z.date())
    .transform(val => (val ? new Date(val) : undefined)),
  purchasePrice: z.number().positive().optional().or(z.literal(0)),
  invoiceNumber: z.string().max(100).optional(),
  purchaseOrderNumber: z.string().max(100).optional(),

  // Depreciación (solo FIXED_ASSET)
  depreciationMethod: z.string().optional(),
  usefulLifeYears: z.number().positive().optional(),
  residualValue: z.number().min(0).optional(),
  totalUnits: z.number().positive().optional(),
  usedUnits: z.number().min(0).optional(),

  // Familia (informativo)
  familyId: z.string().uuid().optional(),
})

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
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const userCanManageInventory = (session.user as any).canManageInventory === true

    // Solo ADMIN y gestores pueden ver lotes
    if (role !== 'ADMIN' && !userCanManageInventory) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Determinar familias accesibles según rol
    let allowedFamilyIds: string[] | null = null // null = sin restricción (superadmin)

    if (role === 'ADMIN' && !isSuperAdmin) {
      // Admin normal: solo sus familias asignadas
      const assignments = await prisma.admin_family_assignments.findMany({
        where: { adminId: userId, isActive: true },
        select: { familyId: true },
      })
      if (assignments.length > 0) {
        allowedFamilyIds = assignments.map(a => a.familyId)
      }
      // Sin asignaciones → acceso total (admin legacy)
    } else if (role !== 'ADMIN' && userCanManageInventory) {
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
      receivedBy: session.user.id,
    }

    const result = await createBatch(data)

    // Invalidate relevant caches
    await invalidateCache('equipment:*')
    await invalidateCache(`model:${data.modelId}:*`)

    return NextResponse.json(result, { status: 201 })
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

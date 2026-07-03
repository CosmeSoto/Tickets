import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  canReadModuleFamilyConfig,
  canWriteModuleFamilyConfig,
  sanitizeInventoryConfigBody,
} from '@/lib/auth/module-config-access'
import { z } from 'zod'
import { DEFAULT_FAMILY_CONFIG, normalizeSectionsByMode } from '@/lib/inventory/family-config'

const updateConfigSchema = z.object({
  allowedSubtypes: z.array(z.enum(['EQUIPMENT', 'MRO', 'LICENSE'])).optional(),
  visibleSections: z
    .array(z.enum(['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE']))
    .optional(),
  requiredSections: z
    .array(z.enum(['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE']))
    .optional(),
  requireFinancialForNew: z.boolean().optional(),
  sectionsByMode: z
    .record(
      z.object({
        visible: z.array(
          z.enum(['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE'])
        ),
        required: z.array(
          z.enum(['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE'])
        ),
      })
    )
    .nullable()
    .optional(),
  defaultDepreciationMethod: z
    .enum(['LINEAR', 'STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION'])
    .nullable()
    .optional()
    .transform(v => (v === 'STRAIGHT_LINE' ? 'LINEAR' : v)),
  defaultUsefulLifeYears: z.number().positive().nullable().optional(),
  defaultResidualValuePct: z.number().min(0).max(100).nullable().optional(),
  codePrefix: z.string().max(10).nullable().optional(),
  autoApproveDecommission: z.boolean().optional(),
  requireDeliveryAct: z.boolean().optional(),
  inventoryEnabled: z.boolean().optional(),
  batchUtilizationAlertEnabled: z.boolean().nullable().optional(),
  batchUtilizationEmailCritical: z.boolean().nullable().optional(),
  batchUtilizationEmailWarning: z.boolean().nullable().optional(),
  batchLowStockThresholdPct: z.number().min(1).max(100).nullable().optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }
  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  const canRead = await canReadModuleFamilyConfig(userId, role, isSuperAdmin, familyId, 'inventory')
  if (!canRead) {
    return NextResponse.json(
      { error: 'No tienes permiso para ver la configuración de esta familia' },
      { status: 403 }
    )
  }

  try {
    const config = await prisma.inventory_family_config.findUnique({
      where: { familyId },
    })

    if (!config) {
      return NextResponse.json({
        success: true,
        data: { familyId, ...DEFAULT_FAMILY_CONFIG, inventoryEnabled: true },
      })
    }

    const normalizedSectionsByMode = normalizeSectionsByMode(
      config.sectionsByMode as Parameters<typeof normalizeSectionsByMode>[0]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        sectionsByMode: normalizedSectionsByMode ?? null,
        inventoryEnabled: config.inventoryEnabled ?? true,
      },
    })
  } catch (error) {
    console.error('Error al obtener configuración:', error)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  const { familyId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }
  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  const canWrite = await canWriteModuleFamilyConfig(
    userId,
    role,
    isSuperAdmin,
    familyId,
    'inventory'
  )
  if (!canWrite) {
    return NextResponse.json(
      { error: 'No tienes permiso para modificar la configuración de esta familia' },
      { status: 403 }
    )
  }

  try {
    const rawBody = await req.json()
    const body = sanitizeInventoryConfigBody(rawBody as Record<string, unknown>, isSuperAdmin)
    const validated = updateConfigSchema.parse(body)

    const family = await prisma.families.findUnique({ where: { id: familyId } })
    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inventoryEnabled: _inv, sectionsByMode, ...restConfigData } = validated

    // Prisma requiere Prisma.DbNull para campos JSON nullable — no acepta null directamente
    const configData = {
      ...restConfigData,
      sectionsByMode:
        sectionsByMode === null
          ? Prisma.DbNull
          : sectionsByMode !== undefined
            ? (sectionsByMode as Prisma.InputJsonValue)
            : undefined,
    } as any // cast necesario porque Zod infiere string en lugar del enum DepreciationMethod

    // inventoryEnabled: solo Super Admin puede cambiarlo
    const inventoryEnabledPatch =
      isSuperAdmin && validated.inventoryEnabled !== undefined
        ? { inventoryEnabled: validated.inventoryEnabled }
        : {}

    const config = await prisma.inventory_family_config.upsert({
      where: { familyId },
      create: {
        familyId,
        inventoryEnabled: isSuperAdmin ? (validated.inventoryEnabled ?? true) : true,
        ...configData,
      },
      update: { ...configData, ...inventoryEnabledPatch },
    })

    // Invalidar caché de módulos — inventoryEnabled cambió
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      const { invalidateBatchAlertSettingsCache } =
        await import('@/lib/inventory/batch-alert-settings')
      await Promise.all([invalidateCache('user:modules:*'), invalidateCache('dashboard:*')])
      invalidateBatchAlertSettingsCache(familyId)
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración actualizada correctamente',
      data: config,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    console.error('Error al actualizar configuración:', error)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}

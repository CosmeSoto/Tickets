import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { z } from 'zod'
import { DEFAULT_FAMILY_CONFIG } from '@/lib/inventory/family-config'

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
    .enum(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION'])
    .nullable()
    .optional(),
  defaultUsefulLifeYears: z.number().positive().nullable().optional(),
  defaultResidualValuePct: z.number().min(0).max(100).nullable().optional(),
  codePrefix: z.string().max(10).nullable().optional(),
  autoApproveDecommission: z.boolean().optional(),
  requireDeliveryAct: z.boolean().optional(),
  inventoryEnabled: z.boolean().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { familyId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }
  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  // Verificar permisos
  if (role !== 'ADMIN' && !isSuperAdmin) {
    const allowed = await canManageInventory(userId, role)
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para ver la configuración' },
        { status: 403 }
      )
    }
  }

  try {
    const config = await prisma.inventory_family_config.findUnique({
      where: { familyId: params.familyId },
    })

    if (!config) {
      // Retornar configuración por defecto
      return NextResponse.json({
        success: true,
        data: {
          familyId: params.familyId,
          ...DEFAULT_FAMILY_CONFIG,
          inventoryEnabled: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        inventoryEnabled: true, // Por ahora siempre true, se puede agregar campo en el futuro
      },
    })
  } catch (error) {
    console.error('Error al obtener configuración:', error)
    return NextResponse.json({ error: 'Error al obtener configuración' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { familyId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role } = session.user as { role: string; id: string }
  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  // Verificar permisos
  if (role !== 'ADMIN' && !isSuperAdmin) {
    return NextResponse.json(
      { error: 'No tienes permiso para modificar la configuración' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const validated = updateConfigSchema.parse(body)

    // Verificar que la familia existe
    const family = await prisma.families.findUnique({
      where: { id: params.familyId },
    })

    if (!family) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    // Preparar datos para actualizar (excluir inventoryEnabled que no está en el schema DB)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { inventoryEnabled: _inv, ...configData } = validated

    // Upsert configuración
    const config = await prisma.inventory_family_config.upsert({
      where: { familyId: params.familyId },
      create: {
        familyId: params.familyId,
        ...configData,
      },
      update: configData,
    })

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

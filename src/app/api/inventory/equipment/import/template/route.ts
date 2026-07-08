import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import {
  buildTemplateCsv,
  buildTemplateWorkbook,
  VALID_ACQUISITION_MODES,
} from '@/lib/inventory/equipment-import'

/**
 * GET /api/inventory/equipment/import/template
 * Query: familyId, typeId, brandId, modelId, acquisitionMode?, format=csv|xlsx
 */
export const dynamic = 'force-dynamic'

function fileResponse(body: Buffer | Uint8Array | string, contentType: string, filename: string) {
  const payload =
    typeof body === 'string' ? body : body instanceof Uint8Array ? body : new Uint8Array(body)

  return new NextResponse(payload, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')?.trim()
    const typeId = searchParams.get('typeId')?.trim()
    const brandId = searchParams.get('brandId')?.trim()
    const modelId = searchParams.get('modelId')?.trim()
    const acquisitionMode = (searchParams.get('acquisitionMode') ?? 'FIXED_ASSET').trim()
    const format = (searchParams.get('format') ?? 'xlsx').toLowerCase()

    if (!familyId || !typeId || !brandId || !modelId) {
      return NextResponse.json(
        { error: 'familyId, typeId, brandId y modelId son obligatorios' },
        { status: 400 }
      )
    }

    if (
      !VALID_ACQUISITION_MODES.includes(acquisitionMode as (typeof VALID_ACQUISITION_MODES)[number])
    ) {
      return NextResponse.json({ error: 'acquisitionMode inválido' }, { status: 400 })
    }

    const user = toInventoryAccessUser(
      session.user as { id: string; role: string; isSuperAdmin?: boolean }
    )
    await assertInventoryManageByFamily(user, familyId)

    const [family, equipmentType, brand, model, attributes, warehouses] = await Promise.all([
      prisma.families.findUnique({ where: { id: familyId }, select: { name: true } }),
      prisma.equipment_types.findUnique({
        where: { id: typeId },
        select: { name: true, familyId: true },
      }),
      prisma.equipment_brands.findUnique({ where: { id: brandId }, select: { name: true } }),
      prisma.equipment_models.findUnique({
        where: { id: modelId },
        select: { model: true, brandId: true },
      }),
      prisma.equipment_type_attributes.findMany({
        where: { equipmentTypeId: typeId },
        orderBy: { order: 'asc' },
        select: {
          attributeName: true,
          attributeLabel: true,
          attributeType: true,
          isRequired: true,
          options: true,
        },
      }),
      prisma.warehouses.findMany({
        where: { familyId, isActive: true },
        select: { name: true, location: true },
        orderBy: { name: 'asc' },
      }),
    ])

    if (!family || !equipmentType || !brand || !model) {
      return NextResponse.json({ error: 'Catálogo no encontrado' }, { status: 404 })
    }
    if (equipmentType.familyId !== familyId) {
      return NextResponse.json({ error: 'El tipo no pertenece a la familia' }, { status: 400 })
    }
    if (model.brandId !== brandId) {
      return NextResponse.json({ error: 'El modelo no pertenece a la marca' }, { status: 400 })
    }

    const meta = {
      familyName: family.name,
      typeName: equipmentType.name,
      brandName: brand.name,
      modelName: model.model,
      acquisitionMode,
      attributes,
      warehouses,
    }

    if (format === 'csv') {
      const csv = buildTemplateCsv(meta)
      return fileResponse(csv, 'text/csv; charset=utf-8', 'plantilla-equipos.csv')
    }

    const buf = buildTemplateWorkbook(meta)
    return fileResponse(
      buf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'plantilla-equipos.xlsx'
    )
  } catch (error) {
    if (error instanceof InventoryAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error('[IMPORT TEMPLATE]', error)
    return NextResponse.json({ error: 'Error al generar plantilla' }, { status: 500 })
  }
}

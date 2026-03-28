import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { randomUUID } from 'crypto'
import { getFamilyConfig, validateSubtypeForFamily } from '@/lib/inventory/family-config'
import { validateSupplierRequirement, validateContractRequirement } from '@/lib/inventory/asset-validation'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }

  const { searchParams } = req.nextUrl
  const familyIdParam = searchParams.get('familyId') ?? undefined
  const subtypeParam = searchParams.get('subtype') ?? undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? '20', 10) || 20

  if (pageSizeRaw > 100) {
    return NextResponse.json({ error: 'El tamaño de página máximo es 100' }, { status: 400 })
  }
  const pageSize = pageSizeRaw

  // Determinar familias permitidas para el usuario
  let allowedFamilyIds: string[] | undefined

  if (role !== 'ADMIN') {
    const allowed = await canManageInventory(userId, role)
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para gestionar el inventario' },
        { status: 403 }
      )
    }
    // Gestor: filtrar por familias asignadas
    const assignments = await prisma.inventory_manager_families.findMany({
      where: { managerId: userId },
      select: { familyId: true },
    })
    allowedFamilyIds = assignments.map((a) => a.familyId)
  }

  // Si se pasa familyId como query param, intersectar con las familias permitidas
  const effectiveFamilyIds: string[] | undefined = (() => {
    if (familyIdParam) {
      if (allowedFamilyIds) {
        return allowedFamilyIds.includes(familyIdParam) ? [familyIdParam] : []
      }
      return [familyIdParam]
    }
    return allowedFamilyIds
  })()

  // Ejecutar 3 queries en paralelo
  const [equipmentItems, consumableItems, licenseItems] = await Promise.all([
    // Solo incluir EQUIPMENT si no se filtra por subtype o el subtype es EQUIPMENT
    subtypeParam && subtypeParam !== 'EQUIPMENT'
      ? Promise.resolve([])
      : prisma.equipment.findMany({
          where: effectiveFamilyIds
            ? { type: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: {
            type: {
              include: { family: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),

    // Solo incluir MRO si no se filtra por subtype o el subtype es MRO
    subtypeParam && subtypeParam !== 'MRO'
      ? Promise.resolve([])
      : prisma.consumables.findMany({
          where: effectiveFamilyIds
            ? { consumableType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: {
            consumableType: {
              include: { family: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),

    // Solo incluir LICENSE si no se filtra por subtype o el subtype es LICENSE
    subtypeParam && subtypeParam !== 'LICENSE'
      ? Promise.resolve([])
      : prisma.software_licenses.findMany({
          where: effectiveFamilyIds
            ? { licenseType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: {
            licenseType: {
              include: { family: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
  ])

  // Mapear a UnifiedAsset
  type UnifiedAsset = {
    id: string
    name: string
    subtype: 'EQUIPMENT' | 'MRO' | 'LICENSE'
    familyId: string
    family: { name: string; icon: string | null; color: string | null }
    status: string
    code?: string
    acquisitionMode?: string
    createdAt: string
  }

  const mappedEquipment: UnifiedAsset[] = equipmentItems.map((item) => ({
    id: item.id,
    name: `${item.brand} ${item.model}`,
    subtype: 'EQUIPMENT' as const,
    familyId: item.type.familyId ?? '',
    family: {
      name: item.type.family?.name ?? '',
      icon: item.type.family?.icon ?? null,
      color: item.type.family?.color ?? null,
    },
    status: item.status,
    code: item.code,
    acquisitionMode: item.acquisitionMode ?? item.ownershipType ?? undefined,
    createdAt: item.createdAt.toISOString(),
  }))

  const mappedConsumables: UnifiedAsset[] = consumableItems.map((item) => ({
    id: item.id,
    name: item.name,
    subtype: 'MRO' as const,
    familyId: item.consumableType.familyId ?? '',
    family: {
      name: item.consumableType.family?.name ?? '',
      icon: item.consumableType.family?.icon ?? null,
      color: item.consumableType.family?.color ?? null,
    },
    status: 'ACTIVE',
    acquisitionMode: undefined,
    createdAt: item.createdAt.toISOString(),
  }))

  const mappedLicenses: UnifiedAsset[] = licenseItems.map((item) => ({
    id: item.id,
    name: item.name,
    subtype: 'LICENSE' as const,
    familyId: item.licenseType?.familyId ?? '',
    family: {
      name: item.licenseType?.family?.name ?? '',
      icon: item.licenseType?.family?.icon ?? null,
      color: item.licenseType?.family?.color ?? null,
    },
    status: 'ACTIVE',
    acquisitionMode: undefined,
    createdAt: item.createdAt.toISOString(),
  }))

  // Combinar, ordenar por createdAt DESC y paginar
  const allItems = [...mappedEquipment, ...mappedConsumables, ...mappedLicenses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const total = allItems.length
  const totalPages = Math.ceil(total / pageSize)
  const items = allItems.slice((page - 1) * pageSize, page * pageSize)

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }

  if (role !== 'ADMIN') {
    const allowed = await canManageInventory(userId, role)
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para gestionar el inventario' },
        { status: 403 }
      )
    }
  }

  const body = await req.json()
  const {
    subtype,
    familyId,
    name,
    acquisitionMode,
    supplierId,
    contractAction,
    contractId: bodyContractId,
    contractNumber,
    contractStartDate,
    contractEndDate,
    contractMonthlyCost,
    // EQUIPMENT
    code,
    serialNumber,
    brand,
    model,
    typeId,
    warehouseId,
    purchaseDate,
    purchasePrice,
    invoiceNumber,
    usefulLifeYears,
    residualValue,
    depreciationMethod,
    // MRO
    unitOfMeasureId,
    // LICENSE
    key,
    expirationDate,
    cost,
  } = body

  // Obtener config de familia y validar subtipo
  const config = await getFamilyConfig(familyId)
  const subtypeValidation = validateSubtypeForFamily(subtype, config)
  if (!subtypeValidation.valid) {
    return NextResponse.json({ error: subtypeValidation.error }, { status: 422 })
  }

  // Validar proveedor
  const supplierValidation = validateSupplierRequirement(acquisitionMode, supplierId)
  if (!supplierValidation.valid) {
    return NextResponse.json({ error: supplierValidation.error }, { status: 422 })
  }

  // Validar contrato
  const contractValidation = validateContractRequirement(acquisitionMode, bodyContractId, contractAction)
  if (!contractValidation.valid) {
    return NextResponse.json({ error: contractValidation.error }, { status: 422 })
  }

  // Crear contrato si contractAction === 'create'
  let resolvedContractId: string | undefined = bodyContractId ?? undefined

  if (contractAction === 'create') {
    // Buscar un tipo de licencia disponible
    const defaultLicenseType = await prisma.license_types.findFirst({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })

    const newContract = await prisma.software_licenses.create({
      data: {
        id: randomUUID(),
        name: contractNumber ?? 'Contrato',
        typeId: defaultLicenseType?.id ?? '',
        vendor: supplierId ?? undefined,
        cost: contractMonthlyCost ?? undefined,
        purchaseDate: contractStartDate ? new Date(contractStartDate) : undefined,
        expirationDate: contractEndDate ? new Date(contractEndDate) : undefined,
        supplierId: supplierId ?? undefined,
      },
    })
    resolvedContractId = newContract.id
  }

  // Generar código automático si no se proporcionó uno
  const resolvedCode = (code && String(code).trim())
    ? String(code).trim()
    : await generateAssetCode(familyId, subtype, acquisitionMode)

  // Enrutar creación según subtype
  let asset: { id: string; [key: string]: unknown }

  if (subtype === 'EQUIPMENT') {
    asset = await prisma.equipment.create({
      data: {
        id: randomUUID(),
        code: resolvedCode,
        serialNumber: serialNumber ?? '',
        brand: brand ?? '',
        model: model ?? '',
        typeId: typeId ?? '',
        ownershipType: acquisitionMode ?? 'FIXED_ASSET',
        acquisitionMode: acquisitionMode ?? undefined,
        supplierId: supplierId ?? undefined,
        contractId: resolvedContractId ?? undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        purchasePrice: purchasePrice ?? undefined,
        invoiceNumber: invoiceNumber ?? undefined,
        usefulLifeYears: usefulLifeYears ?? undefined,
        residualValue: residualValue ?? undefined,
        depreciationMethod: depreciationMethod ?? undefined,
        warehouseId: warehouseId ?? undefined,
        qrCode: randomUUID(),
      },
    })
  } else if (subtype === 'MRO') {
    asset = await prisma.consumables.create({
      data: {
        id: randomUUID(),
        name: name ?? '',
        typeId: typeId ?? '',
        unitOfMeasureId: unitOfMeasureId ?? '',
        currentStock: 0,
        minStock: 0,
        maxStock: 0,
        supplierId: supplierId ?? undefined,
        warehouseId: warehouseId ?? undefined,
      },
    })
  } else if (subtype === 'LICENSE') {
    asset = await prisma.software_licenses.create({
      data: {
        id: randomUUID(),
        name: name ?? '',
        typeId: typeId ?? '',
        key: key ?? undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        supplierId: supplierId ?? undefined,
        cost: cost ?? undefined,
      },
    })
  } else {
    return NextResponse.json({ error: 'Subtipo no válido' }, { status: 422 })
  }

  // Registrar en audit_logs
  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'CREATE',
      entityType: 'asset',
      entityId: asset.id,
      userId,
      details: { subtype, familyId, acquisitionMode: acquisitionMode ?? null },
    },
  })

  return NextResponse.json({ ...asset, subtype }, { status: 201 })
}

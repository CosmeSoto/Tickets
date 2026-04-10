import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { randomUUID } from 'crypto'
import { getFamilyConfig, validateSubtypeForFamily } from '@/lib/inventory/family-config'
import { validateSupplierRequirement, validateContractRequirement } from '@/lib/inventory/asset-validation'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'
import { calculateConsumableStatus } from '@/lib/inventory/consumable-status'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  const userCanManageInventory = (session.user as any).canManageInventory === true

  const { searchParams } = req.nextUrl
  const familyIdParam = searchParams.get('familyId') ?? undefined
  const subtypeParam = searchParams.get('subtype') ?? undefined
  const searchQuery = searchParams.get('search')?.trim().toLowerCase() ?? ''
  const personalOnly = searchParams.get('personalOnly') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? '20', 10) || 20

  if (pageSizeRaw > 100) {
    return NextResponse.json({ error: 'El tamaño de página máximo es 100' }, { status: 400 })
  }
  const pageSize = pageSizeRaw

  // Equipos asignados personalmente al usuario (aplica a TODOS los roles sin excepción)
  const personalAssignments = await prisma.equipment_assignments.findMany({
    where: { receiverId: userId, isActive: true },
    select: { equipmentId: true },
  })
  const personalEquipmentIds = personalAssignments.map(a => a.equipmentId)

  // Si personalOnly=true, ignorar lógica de familias y mostrar solo equipos asignados al usuario
  if (personalOnly) {
    const items = await prisma.equipment.findMany({
      where: { id: { in: personalEquipmentIds } },
      include: { type: { include: { family: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const mapped = items.map((item) => ({
      id: item.id,
      name: `${item.brand} ${item.model}`,
      subtype: 'EQUIPMENT' as const,
      familyId: item.type?.familyId ?? '',
      family: {
        name: item.type?.family?.name ?? '',
        icon: item.type?.family?.icon ?? null,
        color: item.type?.family?.color ?? null,
      },
      status: item.status,
      code: item.code,
      acquisitionMode: (item as any).acquisitionMode ?? (item as any).ownershipType ?? undefined,
      createdAt: item.createdAt.toISOString(),
    }))
    const filtered = mapped.filter(i =>
      !searchQuery || i.name.toLowerCase().includes(searchQuery) || (i.code ?? '').toLowerCase().includes(searchQuery)
    )
    const total = filtered.length
    return NextResponse.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  }

  // Familias accesibles según rol:
  // - SuperAdmin → undefined (todo)
  // - Admin normal → sus familias en admin_family_assignments (o todo si no tiene ninguna)
  // - Gestor → sus familias en inventory_manager_families
  // - CLIENT/TECHNICIAN sin gestión → undefined aquí, se aplica restrictToAssignedOnly abajo
  const { getAccessibleFamilyIds } = await import('@/lib/inventory/family-access')
  let allowedFamilyIds: string[] | undefined
  let restrictToAssignedOnly = false

  if (role === 'ADMIN' || userCanManageInventory) {
    allowedFamilyIds = await getAccessibleFamilyIds(userId, role, isSuperAdmin, userCanManageInventory)
  } else if (role === 'CLIENT') {
    // Cliente sin gestión: solo sus equipos asignados personalmente
    restrictToAssignedOnly = true
  }
  // TECHNICIAN sin gestión: acceso de lectura a todo el inventario

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

  // Construir filtro de equipos:
  // - Cliente sin gestión: solo sus equipos asignados
  // - Gestor/Técnico/Admin: equipos de sus familias + equipos asignados personalmente (OR)
  function buildEquipmentWhere() {
    if (restrictToAssignedOnly) {
      return { id: { in: personalEquipmentIds } }
    }
    if (effectiveFamilyIds !== undefined) {
      // Gestor con familias: equipos de sus familias OR asignados a él
      const conditions: object[] = [
        { type: { familyId: { in: effectiveFamilyIds } } },
      ]
      if (personalEquipmentIds.length > 0) {
        conditions.push({ id: { in: personalEquipmentIds } })
      }
      return conditions.length > 1 ? { OR: conditions } : conditions[0]
    }
    // Sin restricción (ADMIN o TECHNICIAN sin gestión)
    return {}
  }

  // Ejecutar 3 queries en paralelo
  const [equipmentItems, consumableItems, licenseItems] = await Promise.all([
    // EQUIPMENT
    subtypeParam && subtypeParam !== 'EQUIPMENT'
      ? Promise.resolve([])
      : prisma.equipment.findMany({
          where: buildEquipmentWhere(),
          include: { type: { include: { family: true } } },
          orderBy: { createdAt: 'desc' },
        }),

    // MRO — clientes sin gestión no ven MRO
    restrictToAssignedOnly || (subtypeParam && subtypeParam !== 'MRO')
      ? Promise.resolve([])
      : prisma.consumables.findMany({
          where: effectiveFamilyIds
            ? { consumableType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: { consumableType: { include: { family: true } } },
          orderBy: { createdAt: 'desc' },
        }),

    // LICENSE — clientes sin gestión no ven licencias
    restrictToAssignedOnly || (subtypeParam && subtypeParam !== 'LICENSE')
      ? Promise.resolve([])
      : prisma.software_licenses.findMany({
          where: effectiveFamilyIds
            ? { licenseType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: { licenseType: { include: { family: true } } },
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

  // Combinar, filtrar por búsqueda, ordenar por createdAt DESC y paginar
  const allItems = [...mappedEquipment, ...mappedConsumables, ...mappedLicenses]
    .filter(item =>
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery) ||
      (item.code ?? '').toLowerCase().includes(searchQuery)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

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
    departmentId,
    warehouseId,
    purchaseDate,
    purchasePrice,
    invoiceNumber,
    usefulLifeYears,
    residualValue,
    depreciationMethod,
    // MRO
    unitOfMeasureId,
    currentStock,
    minStock,
    maxStock,
    expirationDate,
    // LICENSE
    key,
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

  // Resolver bodega por defecto una sola vez
  let defaultWarehouseId: string | undefined
  const defaultWarehouseSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory.default_warehouse_id' },
  })
  if (defaultWarehouseSetting?.value) defaultWarehouseId = defaultWarehouseSetting.value

  // Enrutar creación según subtype
  let asset: { id: string; [key: string]: unknown }

  if (subtype === 'EQUIPMENT') {
    const resolvedEquipmentWarehouseId = warehouseId ?? defaultWarehouseId
    asset = await prisma.equipment.create({
      data: {
        id: randomUUID(),
        code: resolvedCode,
        serialNumber: serialNumber ?? '',
        brand: brand ?? '',
        model: model ?? '',
        typeId: typeId ?? '',
        departmentId: departmentId ?? undefined,
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
        warehouseId: resolvedEquipmentWarehouseId,
        qrCode: randomUUID(),
      },
    })
  } else if (subtype === 'MRO') {
    const resolvedWarehouseId = warehouseId ?? defaultWarehouseId
    const initialStatus = calculateConsumableStatus(
      currentStock ?? 0,
      minStock ?? 0,
      expirationDate ? new Date(expirationDate) : null
    )
    asset = await prisma.consumables.create({
      data: {
        id: randomUUID(),
        name: name ?? '',
        typeId: typeId ?? '',
        unitOfMeasureId: unitOfMeasureId ?? '',
        currentStock: currentStock ?? 0,
        minStock: minStock ?? 0,
        maxStock: maxStock ?? 0,
        supplierId: supplierId ?? undefined,
        warehouseId: resolvedWarehouseId,
        status: initialStatus,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
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
      details: {
        subtype,
        familyId,
        acquisitionMode: acquisitionMode ?? null,
        ...(subtype === 'MRO' && {
          warehouseId: warehouseId ?? defaultWarehouseId,
          initialStock: currentStock ?? 0,
        }),
        ...(subtype === 'EQUIPMENT' && {
          warehouseId: warehouseId ?? defaultWarehouseId,
        }),
      },
    },
  })

  return NextResponse.json({ ...asset, subtype }, { status: 201 })
}

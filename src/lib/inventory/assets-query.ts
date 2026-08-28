/**
 * Lógica de consulta (GET) para el listado unificado de activos.
 * Extraído de /api/inventory/assets/route.ts para mantener ese archivo manejable.
 */
import { prisma } from '@/lib/prisma'
import { formatAttributesString } from '@/lib/inventory/attribute-labels'

const EQUIPMENT_TYPE_INCLUDE = {
  family: { select: { id: true, name: true, icon: true, color: true } },
  attributes: {
    orderBy: { order: 'asc' as const },
    select: { attributeName: true, attributeLabel: true, order: true },
  },
} as const

const ACTIVE_ASSIGNMENT_INCLUDE = {
  where: { isActive: true },
  orderBy: { startDate: 'desc' as const },
  take: 1,
  select: {
    startDate: true,
    receiver: { select: { name: true } },
    deliverer: { select: { name: true } },
  },
} as const

const EQUIPMENT_LIST_INCLUDE = {
  type: { include: EQUIPMENT_TYPE_INCLUDE },
  model: { select: { brand: true, model: true } },
  batch: { select: { id: true, batchCode: true } },
  warehouse: { select: { name: true } },
  customValues: { select: { fieldName: true, fieldValue: true } },
  assignments: ACTIVE_ASSIGNMENT_INCLUDE,
} as const

export interface AssetsQueryParams {
  userId: string
  role: string
  isSuperAdmin: boolean
  userCanManageInventory: boolean
  familyIdParam?: string
  subtypeParam?: string
  searchQuery: string
  personalOnly: boolean
  statusFilter: string
  conditionFilter: string
  batchFilter: string
  page: number
  pageSize: number
}

export interface UnifiedAssetItem {
  id: string
  name: string
  subtype: 'EQUIPMENT' | 'MRO' | 'LICENSE'
  familyId: string
  family: { name: string; icon: string | null; color: string | null }
  status: string
  code?: string
  typeName?: string
  acquisitionMode?: string
  condition?: string
  createdAt: string
  purchaseDate?: string
  purchasePrice?: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
  attributes?: string
  accessories?: string
  serialNumber?: string
  warehouseName?: string
  physicalLocation?: string
  notes?: string
  batchId?: string | null
  batchCode?: string | null
  assignedToName?: string
  assignedAt?: string
  assignedByName?: string
}

export interface AssetsQueryResult {
  items: UnifiedAssetItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function queryAssets(params: AssetsQueryParams): Promise<AssetsQueryResult> {
  const {
    userId,
    role,
    isSuperAdmin,
    userCanManageInventory,
    familyIdParam,
    subtypeParam,
    searchQuery,
    personalOnly,
    statusFilter,
    conditionFilter,
    batchFilter,
    page,
    pageSize,
  } = params

  // Equipos asignados personalmente al usuario
  const personalAssignments = await prisma.equipment_assignments.findMany({
    where: { receiverId: userId, isActive: true },
    select: { equipmentId: true },
  })
  const personalEquipmentIds = personalAssignments.map(a => a.equipmentId)

  // personalOnly: solo equipos del usuario
  if (personalOnly) {
    const items = await prisma.equipment.findMany({
      where: { id: { in: personalEquipmentIds } },
      include: EQUIPMENT_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    const mapped = items.map(mapEquipmentItem)
    const filtered = searchQuery
      ? mapped.filter(
          i =>
            i.name.toLowerCase().includes(searchQuery) ||
            (i.code ?? '').toLowerCase().includes(searchQuery) ||
            (i.serialNumber ?? '').toLowerCase().includes(searchQuery) ||
            (i.batchCode ?? '').toLowerCase().includes(searchQuery) ||
            (i.assignedToName ?? '').toLowerCase().includes(searchQuery)
        )
      : mapped
    return paginate(filtered, page, pageSize)
  }

  // Familias accesibles
  const { getAccessibleFamilyIds } = await import('@/lib/inventory/family-access')
  let allowedFamilyIds: string[] | undefined
  let restrictToAssignedOnly = false

  if (role === 'ADMIN' || userCanManageInventory) {
    allowedFamilyIds = await getAccessibleFamilyIds(
      userId,
      role,
      isSuperAdmin,
      userCanManageInventory
    )
  } else if (role === 'CLIENT') {
    restrictToAssignedOnly = true
  } else if (role === 'TECHNICIAN') {
    allowedFamilyIds = await getAccessibleFamilyIds(
      userId,
      role,
      isSuperAdmin,
      userCanManageInventory
    )
  }

  const effectiveFamilyIds: string[] | undefined = (() => {
    if (familyIdParam) {
      if (allowedFamilyIds) return allowedFamilyIds.includes(familyIdParam) ? [familyIdParam] : []
      return [familyIdParam]
    }
    return allowedFamilyIds
  })()

  function buildEquipmentWhere() {
    const extra: Record<string, any> = {}
    if (statusFilter) extra.status = statusFilter
    if (conditionFilter) extra.condition = conditionFilter
    if (batchFilter === 'with_batch') extra.batchId = { not: null }
    else if (batchFilter === 'without_batch') extra.batchId = null
    else if (batchFilter && batchFilter !== 'all') extra.batchId = batchFilter

    if (restrictToAssignedOnly) return { id: { in: personalEquipmentIds }, ...extra }
    if (effectiveFamilyIds !== undefined) {
      const conditions: object[] = [{ type: { familyId: { in: effectiveFamilyIds } } }]
      if (personalEquipmentIds.length > 0) conditions.push({ id: { in: personalEquipmentIds } })
      const familyFilter = conditions.length > 1 ? { OR: conditions } : conditions[0]
      return { ...familyFilter, ...extra }
    }
    return extra
  }

  const dbLimit = page * pageSize + pageSize

  const [equipmentItems, consumableItems, licenseItems] = await Promise.all([
    subtypeParam && subtypeParam !== 'EQUIPMENT'
      ? Promise.resolve([] as any[])
      : prisma.equipment.findMany({
          where: buildEquipmentWhere(),
          include: EQUIPMENT_LIST_INCLUDE,
          orderBy: { createdAt: 'desc' },
          take: dbLimit,
        }),

    restrictToAssignedOnly || (subtypeParam && subtypeParam !== 'MRO')
      ? Promise.resolve([] as any[])
      : prisma.consumables.findMany({
          where: effectiveFamilyIds
            ? { consumableType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: {
            consumableType: { include: { family: true } },
            warehouse: { select: { name: true } },
            assignedEquipment: {
              select: {
                code: true,
                model: { select: { brand: { select: { name: true } }, model: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: dbLimit,
        }),

    restrictToAssignedOnly || (subtypeParam && subtypeParam !== 'LICENSE')
      ? Promise.resolve([] as any[])
      : prisma.software_licenses.findMany({
          where: effectiveFamilyIds
            ? { licenseType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: {
            licenseType: { include: { family: true } },
            user: { select: { name: true } },
            department: { select: { name: true } },
            equipment: {
              select: {
                code: true,
                model: { select: { brand: { select: { name: true } }, model: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: dbLimit,
        }),
  ])

  const mapped: UnifiedAssetItem[] = [
    ...equipmentItems.map(mapEquipmentItem),
    ...consumableItems.map((item: any) => {
      const eqLabel = formatLinkedEquipmentName(item.assignedEquipment)
      return {
        id: item.id,
        name: item.name,
        subtype: 'MRO' as const,
        familyId: item.consumableType?.familyId ?? '',
        family: {
          name: item.consumableType?.family?.name ?? '',
          icon: item.consumableType?.family?.icon ?? null,
          color: item.consumableType?.family?.color ?? null,
        },
        typeName: item.consumableType?.name ?? undefined,
        status: item.status ?? 'ACTIVE',
        createdAt: item.createdAt.toISOString(),
        warehouseName: item.warehouse?.name ?? undefined,
        assignedToName: eqLabel ? `Equipo: ${eqLabel}` : undefined,
      }
    }),
    ...licenseItems.map((item: any) => {
      const assignment = licenseAssignment(item)
      return {
        id: item.id,
        name: item.name,
        subtype: 'LICENSE' as const,
        familyId: item.licenseType?.familyId ?? '',
        family: {
          name: item.licenseType?.family?.name ?? '',
          icon: item.licenseType?.family?.icon ?? null,
          color: item.licenseType?.family?.color ?? null,
        },
        typeName: item.licenseType?.name ?? undefined,
        status: assignment.assignedToName ? 'ASSIGNED' : 'AVAILABLE',
        createdAt: item.createdAt.toISOString(),
        purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString() : undefined,
        purchasePrice: item.cost ?? undefined,
        invoiceNumber: item.invoiceNumber ?? undefined,
        purchaseOrderNumber: item.purchaseOrderNumber ?? undefined,
        assignedToName: assignment.assignedToName,
        assignedAt: assignment.assignedAt,
      }
    }),
  ]

  const filtered = searchQuery
    ? mapped.filter(
        i =>
          i.name.toLowerCase().includes(searchQuery) ||
          (i.code ?? '').toLowerCase().includes(searchQuery) ||
          (i.serialNumber ?? '').toLowerCase().includes(searchQuery) ||
          (i.batchCode ?? '').toLowerCase().includes(searchQuery) ||
          (i.assignedToName ?? '').toLowerCase().includes(searchQuery)
      )
    : mapped

  const sorted = filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return paginate(sorted, page, pageSize)
}

function mapEquipmentItem(item: any): UnifiedAssetItem {
  const attributesStr = formatAttributesString(item.customValues, item.type?.attributes ?? [])
  const current = item.assignments?.[0]

  return {
    id: item.id,
    name: item.model
      ? `${item.model.brand?.name ?? ''} ${item.model.model}`.trim()
      : `${item.brand ?? ''} ${item.modelDeprecated ?? ''}`.trim(),
    subtype: 'EQUIPMENT',
    familyId: item.type?.family?.id ?? '',
    family: {
      name: item.type?.family?.name ?? '',
      icon: item.type?.family?.icon ?? null,
      color: item.type?.family?.color ?? null,
    },
    typeName: item.type?.name ?? undefined,
    status: item.status ?? 'ACTIVE',
    code: item.code ?? undefined,
    acquisitionMode: item.acquisitionMode ?? item.ownershipType ?? undefined,
    condition: item.condition ?? undefined,
    createdAt: item.createdAt.toISOString(),
    purchaseDate: item.purchaseDate ? new Date(item.purchaseDate).toISOString() : undefined,
    purchasePrice: item.purchasePrice ?? undefined,
    invoiceNumber: item.invoiceNumber ?? undefined,
    purchaseOrderNumber: item.purchaseOrderNumber ?? undefined,
    attributes: attributesStr,
    accessories: item.accessories?.length ? item.accessories.join(', ') : undefined,
    serialNumber: item.serialNumber ?? undefined,
    warehouseName: item.warehouse?.name ?? undefined,
    physicalLocation: item.physicalLocation ?? undefined,
    notes: item.notes ?? undefined,
    batchId: item.batchId ?? item.batch?.id ?? null,
    batchCode: item.batch?.batchCode ?? null,
    assignedToName: current?.receiver?.name ?? undefined,
    assignedAt: current?.startDate ? new Date(current.startDate).toISOString() : undefined,
    assignedByName: current?.deliverer?.name ?? undefined,
  }
}

function formatLinkedEquipmentName(
  eq:
    | {
        code?: string | null
        model?: { brand?: { name?: string | null } | null; model?: string | null } | null
      }
    | null
    | undefined
): string | undefined {
  if (!eq) return undefined
  const modelName = `${eq.model?.brand?.name ?? ''} ${eq.model?.model ?? ''}`.trim()
  if (modelName && eq.code) return `${modelName} (${eq.code})`
  return modelName || eq.code || undefined
}

function licenseAssignment(item: any): { assignedToName?: string; assignedAt?: string } {
  if (item.user?.name) {
    return { assignedToName: item.user.name }
  }
  const eqLabel = formatLinkedEquipmentName(item.equipment)
  if (eqLabel) {
    return { assignedToName: `Equipo: ${eqLabel}` }
  }
  if (item.department?.name) {
    return { assignedToName: `Depto: ${item.department.name}` }
  }
  return {}
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
    totalPages,
  }
}

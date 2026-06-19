/**
 * Lógica de consulta (GET) para el listado unificado de activos.
 * Extraído de /api/inventory/assets/route.ts para mantener ese archivo manejable.
 */
import { prisma } from '@/lib/prisma'

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
  acquisitionMode?: string
  condition?: string
  createdAt: string
  purchaseDate?: string
  purchasePrice?: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
  attributes?: string
  accessories?: string
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
      include: {
        type: {
          include: {
            family: { include: { customFields: { orderBy: { order: 'asc' } } } },
            attributes: { orderBy: { order: 'asc' } },
          },
        },
        model: { select: { brand: true, model: true } },
        customValues: { select: { fieldName: true, fieldValue: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    const mapped = items.map(mapEquipmentItem)
    const filtered = searchQuery
      ? mapped.filter(
          i =>
            i.name.toLowerCase().includes(searchQuery) ||
            (i.code ?? '').toLowerCase().includes(searchQuery)
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
    const techAssignments = await prisma.technician_family_assignments.findMany({
      where: { technicianId: userId, isActive: true },
      select: { familyId: true },
    })
    if (techAssignments.length > 0) allowedFamilyIds = techAssignments.map(a => a.familyId)
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
          include: {
            type: {
              include: { family: { include: { customFields: { orderBy: { order: 'asc' } } } } },
            },
            model: { select: { brand: true, model: true } },
            customValues: { select: { fieldName: true, fieldValue: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: dbLimit,
        }),

    restrictToAssignedOnly || (subtypeParam && subtypeParam !== 'MRO')
      ? Promise.resolve([] as any[])
      : prisma.consumables.findMany({
          where: effectiveFamilyIds
            ? { consumableType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: { consumableType: { include: { family: true } } },
          orderBy: { createdAt: 'desc' },
          take: dbLimit,
        }),

    restrictToAssignedOnly || (subtypeParam && subtypeParam !== 'LICENSE')
      ? Promise.resolve([] as any[])
      : prisma.software_licenses.findMany({
          where: effectiveFamilyIds
            ? { licenseType: { familyId: { in: effectiveFamilyIds } } }
            : undefined,
          include: { licenseType: { include: { family: true } } },
          orderBy: { createdAt: 'desc' },
          take: dbLimit,
        }),
  ])

  const mapped: UnifiedAssetItem[] = [
    ...equipmentItems.map(mapEquipmentItem),
    ...consumableItems.map((item: any) => ({
      id: item.id,
      name: item.name,
      subtype: 'MRO' as const,
      familyId: item.consumableType?.familyId ?? '',
      family: {
        name: item.consumableType?.family?.name ?? '',
        icon: item.consumableType?.family?.icon ?? null,
        color: item.consumableType?.family?.color ?? null,
      },
      status: 'ACTIVE',
      createdAt: item.createdAt.toISOString(),
    })),
    ...licenseItems.map((item: any) => ({
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
      createdAt: item.createdAt.toISOString(),
    })),
  ]

  const filtered = searchQuery
    ? mapped.filter(
        i =>
          i.name.toLowerCase().includes(searchQuery) ||
          (i.code ?? '').toLowerCase().includes(searchQuery)
      )
    : mapped

  const sorted = filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return paginate(sorted, page, pageSize)
}

function mapEquipmentItem(item: any): UnifiedAssetItem {
  // Catálogo de campos: primero del tipo de equipo (equipment_type_attributes), fallback a familia (legacy)
  const typeAttrs: Array<{ attributeName: string; attributeLabel: string; order: number }> =
    item.type?.attributes ?? []
  const familyFields: Array<{ fieldName: string; fieldLabel: string; order: number }> =
    item.type?.family?.customFields ?? []

  // Construir mapa de metadata: type attributes tienen prioridad sobre family fields
  const fieldMeta = new Map<string, { label: string; order: number }>()
  // Primero agregar family fields (legacy)
  familyFields.forEach(f => fieldMeta.set(f.fieldName, { label: f.fieldLabel, order: f.order }))
  // Luego sobreescribir con type attributes (nuevos, tienen prioridad)
  typeAttrs.forEach(a =>
    fieldMeta.set(a.attributeName, { label: a.attributeLabel, order: a.order })
  )

  // Ordenar customValues según el catálogo de la familia
  const sortedValues = [...(item.customValues ?? [])].sort((a, b) => {
    const oA = fieldMeta.get(a.fieldName)?.order ?? 999
    const oB = fieldMeta.get(b.fieldName)?.order ?? 999
    return oA - oB
  })

  // Formatear como "Label: Valor" usando el fieldLabel del catálogo (no el fieldName snake_case)
  const attributesStr = sortedValues.length
    ? sortedValues
        .map(cv => {
          const label = fieldMeta.get(cv.fieldName)?.label ?? cv.fieldName
          return `${label}: ${cv.fieldValue}`
        })
        .join(', ')
    : undefined

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
  }
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

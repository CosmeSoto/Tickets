/**
 * Servicio de Agrupación de Equipos
 * Agrupa equipos idénticos por marca, modelo, tipo, condición y precio
 * Mantiene trazabilidad individual de cada unidad
 */

import type {
  EquipmentGroup,
  PublicEquipmentItem,
  GroupedInventoryRow,
  EquipmentSummary,
} from '@/types/equipment-grouping'
import { generateGroupId, extractGroupingCriteria } from '@/types/equipment-grouping'

/**
 * Agrupa equipos por modelo (marca, modelo, tipo, condición, precio)
 *
 * Criterios de agrupación:
 * - Misma marca (brand)
 * - Mismo modelo (model)
 * - Mismo tipo (typeId)
 * - Misma condición (condition)
 * - Mismo precio de venta (saleListingPrice) o ambos null
 *
 * @param equipment - Array de equipos públicos a agrupar
 * @returns Array de grupos de equipos con unidades individuales
 *
 * @example
 * ```typescript
 * const equipment = await prisma.equipment.findMany({
 *   where: { status: 'FOR_SALE' },
 *   include: { type: { include: { family: true } } }
 * })
 * const groups = groupByModel(equipment)
 * // groups[0].availableUnits = 5
 * // groups[0].units.length = 5
 * ```
 */
export function groupByModel(equipment: PublicEquipmentItem[]): EquipmentGroup[] {
  // Mapa para agrupar equipos por groupId
  const groupsMap = new Map<string, PublicEquipmentItem[]>()

  // Agrupar equipos por criterios
  for (const item of equipment) {
    const criteria = extractGroupingCriteria(item)
    const groupId = generateGroupId(criteria)

    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, [])
    }

    groupsMap.get(groupId)!.push(item)
  }

  // Convertir mapa a array de grupos
  const groups: EquipmentGroup[] = []

  for (const [groupId, units] of groupsMap.entries()) {
    // Usar el primer item como representante del grupo (todos tienen los mismos datos comunes)
    const representative = units[0]

    // Extraer atributos comunes (que todos los equipos del grupo comparten)
    const commonAttributes: Record<
      string,
      {
        value: string
        label: string
        type: string
      }
    > = {}

    if (representative.customAttributes) {
      // Verificar qué atributos son comunes a todas las unidades
      for (const [key, attr] of Object.entries(representative.customAttributes)) {
        const isCommon = units.every(
          unit =>
            unit.customAttributes &&
            unit.customAttributes[key] &&
            unit.customAttributes[key].value === attr.value
        )

        if (isCommon) {
          commonAttributes[key] = attr
        }
      }
    }

    groups.push({
      groupId,
      brand: representative.brand,
      model: representative.model,
      type: representative.type,
      condition: representative.condition,
      saleListingPrice: representative.saleListingPrice,
      photoUrl: representative.photoUrl,
      specifications: representative.specifications,
      commonAttributes: Object.keys(commonAttributes).length > 0 ? commonAttributes : undefined,
      units,
      availableUnits: units.length,
      contactWhatsapp:
        units.find(u => u.contactWhatsapp)?.contactWhatsapp ??
        representative.contactWhatsapp ??
        null,
      createdAt: representative.createdAt,
      updatedAt: new Date(), // Fecha actual como última actualización del grupo
    })
  }

  // Ordenar grupos por fecha de creación (más recientes primero)
  groups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return groups
}

/**
 * Agrupa equipos para vista de inventario interno con contadores por estado
 *
 * Similar a groupByModel pero incluye contadores de estado y más detalles
 * para la vista administrativa
 *
 * @param equipment - Array de equipos con relaciones completas
 * @returns Array de filas agrupadas con contadores por estado
 *
 * @example
 * ```typescript
 * const equipment = await prisma.equipment.findMany({
 *   include: {
 *     type: { include: { family: true } },
 *     assignments: { include: { receiver: true } }
 *   }
 * })
 * const rows = groupForInventoryView(equipment)
 * // rows[0].total = 10
 * // rows[0].available = 5
 * // rows[0].assigned = 3
 * ```
 */
export function groupForInventoryView(
  equipment: Array<{
    id: string
    code: string
    serialNumber: string
    brand: string
    model: string
    status: string
    condition: string
    location: string | null
    physicalLocation: string | null
    createdAt: Date
    updatedAt: Date
    type: {
      id: string
      name: string
      code: string
      family: {
        id: string
        name: string
        icon: string | null
        color: string | null
      } | null
    }
    assignments?: Array<{
      receiver: {
        id: string
        name: string
        email: string
      }
    }>
  }>
): GroupedInventoryRow[] {
  // Mapa para agrupar por marca + modelo + tipo
  const groupsMap = new Map<
    string,
    {
      brand: string
      model: string
      type: { id: string; name: string; code: string }
      family: { id: string; name: string; icon: string | null; color: string | null } | null
      units: EquipmentSummary[]
      statusCounts: Record<string, number>
    }
  >()

  // Agrupar equipos
  for (const item of equipment) {
    // Clave de agrupación: brand + model + typeId
    const groupKey = `${item.brand}::${item.model}::${item.type.id}`

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        brand: item.brand,
        model: item.model,
        type: {
          id: item.type.id,
          name: item.type.name,
          code: item.type.code,
        },
        family: item.type.family,
        units: [],
        statusCounts: {
          AVAILABLE: 0,
          ASSIGNED: 0,
          MAINTENANCE: 0,
          FOR_SALE: 0,
          SOLD: 0,
          RETIRED: 0,
        },
      })
    }

    const group = groupsMap.get(groupKey)!

    // Agregar unidad al grupo
    const assignedTo =
      item.assignments && item.assignments.length > 0
        ? {
            id: item.assignments[0].receiver.id,
            name: item.assignments[0].receiver.name,
            email: item.assignments[0].receiver.email,
          }
        : null

    group.units.push({
      id: item.id,
      code: item.code,
      serialNumber: item.serialNumber,
      status: item.status as any,
      condition: item.condition as any,
      location: item.location,
      physicalLocation: item.physicalLocation,
      assignedTo,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })

    // Incrementar contador de estado
    if (group.statusCounts[item.status] !== undefined) {
      group.statusCounts[item.status]++
    }
  }

  // Convertir mapa a array de filas
  const rows: GroupedInventoryRow[] = []

  for (const [groupKey, group] of groupsMap.entries()) {
    rows.push({
      groupId: groupKey,
      brand: group.brand,
      model: group.model,
      type: group.type,
      family: group.family,
      total: group.units.length,
      available: group.statusCounts.AVAILABLE,
      assigned: group.statusCounts.ASSIGNED,
      maintenance: group.statusCounts.MAINTENANCE,
      forSale: group.statusCounts.FOR_SALE,
      sold: group.statusCounts.SOLD,
      retired: group.statusCounts.RETIRED,
      units: group.units,
    })
  }

  // Ordenar por total descendente (modelos con más unidades primero)
  rows.sort((a, b) => b.total - a.total)

  return rows
}

/**
 * Filtra grupos de equipos por criterios de búsqueda
 *
 * @param groups - Array de grupos a filtrar
 * @param searchTerm - Término de búsqueda (busca en marca, modelo, tipo)
 * @param familyId - ID de familia para filtrar (opcional)
 * @param typeId - ID de tipo para filtrar (opcional)
 * @returns Array de grupos filtrados
 *
 * @example
 * ```typescript
 * const filtered = filterGroups(groups, 'dell', null, null)
 * // Retorna solo grupos con "dell" en marca, modelo o tipo
 * ```
 */
export function filterGroups(
  groups: EquipmentGroup[],
  searchTerm?: string,
  familyId?: string,
  typeId?: string
): EquipmentGroup[] {
  let filtered = groups

  // Filtrar por término de búsqueda
  if (searchTerm && searchTerm.trim().length > 0) {
    const term = searchTerm.toLowerCase().trim()
    filtered = filtered.filter(
      group =>
        group.brand.toLowerCase().includes(term) ||
        group.model.toLowerCase().includes(term) ||
        group.type.name.toLowerCase().includes(term)
    )
  }

  // Filtrar por familia
  if (familyId) {
    filtered = filtered.filter(group => group.type.family?.id === familyId)
  }

  // Filtrar por tipo
  if (typeId) {
    filtered = filtered.filter(group => group.type.id === typeId)
  }

  return filtered
}

/**
 * Filtra filas de inventario agrupado por criterios de búsqueda
 *
 * @param rows - Array de filas a filtrar
 * @param searchTerm - Término de búsqueda (busca en marca, modelo, tipo)
 * @param familyId - ID de familia para filtrar (opcional)
 * @param typeId - ID de tipo para filtrar (opcional)
 * @returns Array de filas filtradas
 */
export function filterInventoryRows(
  rows: GroupedInventoryRow[],
  searchTerm?: string,
  familyId?: string,
  typeId?: string
): GroupedInventoryRow[] {
  let filtered = rows

  // Filtrar por término de búsqueda
  if (searchTerm && searchTerm.trim().length > 0) {
    const term = searchTerm.toLowerCase().trim()
    filtered = filtered.filter(
      row =>
        row.brand.toLowerCase().includes(term) ||
        row.model.toLowerCase().includes(term) ||
        row.type.name.toLowerCase().includes(term)
    )
  }

  // Filtrar por familia
  if (familyId) {
    filtered = filtered.filter(row => row.family?.id === familyId)
  }

  // Filtrar por tipo
  if (typeId) {
    filtered = filtered.filter(row => row.type.id === typeId)
  }

  return filtered
}

/**
 * Ordena grupos de equipos por un campo específico
 *
 * @param groups - Array de grupos a ordenar
 * @param sortBy - Campo por el cual ordenar
 * @param sortOrder - Orden ascendente o descendente
 * @returns Array de grupos ordenados
 */
export function sortGroups(
  groups: EquipmentGroup[],
  sortBy: 'brand' | 'model' | 'type' | 'availableUnits' | 'createdAt',
  sortOrder: 'asc' | 'desc' = 'asc'
): EquipmentGroup[] {
  const sorted = [...groups]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'brand':
        comparison = a.brand.localeCompare(b.brand)
        break
      case 'model':
        comparison = a.model.localeCompare(b.model)
        break
      case 'type':
        comparison = a.type.name.localeCompare(b.type.name)
        break
      case 'availableUnits':
        comparison = a.availableUnits - b.availableUnits
        break
      case 'createdAt':
        comparison = a.createdAt.getTime() - b.createdAt.getTime()
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  return sorted
}

/**
 * Ordena filas de inventario agrupado por un campo específico
 *
 * @param rows - Array de filas a ordenar
 * @param sortBy - Campo por el cual ordenar
 * @param sortOrder - Orden ascendente o descendente
 * @returns Array de filas ordenadas
 */
export function sortInventoryRows(
  rows: GroupedInventoryRow[],
  sortBy:
    | 'brand'
    | 'model'
    | 'type'
    | 'total'
    | 'available'
    | 'assigned'
    | 'maintenance'
    | 'forSale'
    | 'sold'
    | 'retired',
  sortOrder: 'asc' | 'desc' = 'asc'
): GroupedInventoryRow[] {
  const sorted = [...rows]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'brand':
        comparison = a.brand.localeCompare(b.brand)
        break
      case 'model':
        comparison = a.model.localeCompare(b.model)
        break
      case 'type':
        comparison = a.type.name.localeCompare(b.type.name)
        break
      case 'total':
        comparison = a.total - b.total
        break
      case 'available':
        comparison = a.available - b.available
        break
      case 'assigned':
        comparison = a.assigned - b.assigned
        break
      case 'maintenance':
        comparison = a.maintenance - b.maintenance
        break
      case 'forSale':
        comparison = a.forSale - b.forSale
        break
      case 'sold':
        comparison = a.sold - b.sold
        break
      case 'retired':
        comparison = a.retired - b.retired
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  return sorted
}

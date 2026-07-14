import prisma from '@/lib/prisma'
import {
  CONSUMABLE_STATUS_ES,
  EQUIPMENT_STATUS_ES,
  formatCurrency,
  formatDate,
  MAINTENANCE_STATUS_ES,
  toCSV,
} from '@/lib/inventory/report-utils'
import { ExcelGenerator } from '@/lib/services/export/excel-generator'
import { ALL_FILTER } from './catalog'
import type { ReportResponse, ReportRunParams, ReportSummaryItem } from './types'
import {
  consumableScopeWhere,
  contractFamilyFilter,
  equipmentScopeWhere,
  licenseScopeWhere,
  type ReportScopeContext,
} from './scope'
import { runInventoryReportTemplate } from './template-runner'
import {
  aggregateGroupableRows,
  buildGroupedDatasetResponse,
  getDatasetGroupByConfig,
  GROUP_BY_ROW_LIMIT,
  isGroupByActive,
  monthKey,
  type GroupableRow,
} from './group-by'

/** Datasets explorables que reutilizan la lógica de plantillas fijas. */
const TEMPLATE_DATASET_SLUGS: Record<string, string> = {
  expiring: 'expiring',
  'stock-movements': 'stock-movements',
  locations: 'locations',
  decommissions: 'decommissioned',
}

const ACQUISITION_LABELS: Record<string, string> = {
  FIXED_ASSET: 'Activo fijo',
  RENTAL: 'Arrendamiento',
  LOAN: 'Comodato',
}

const CONTRACT_STATUS_ES: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  EXPIRED: 'Vencido',
  CANCELLED: 'Cancelado',
  SUSPENDED: 'Suspendido',
}

const CONTRACT_CATEGORY_ES: Record<string, string> = {
  SERVICE: 'Servicio',
  SUBSCRIPTION: 'Suscripción',
  RENTAL: 'Arrendamiento',
  SOFTWARE: 'Software',
  MAINTENANCE: 'Mantenimiento',
}

function parsePagination(params: ReportRunParams) {
  const page = Math.max(1, parseInt(String(params.page ?? 1), 10) || 1)
  const limit = Math.min(500, Math.max(1, parseInt(String(params.limit ?? 100), 10) || 100))
  return { page, limit, skip: (page - 1) * limit }
}

function dateRangeFilter(
  params: ReportRunParams,
  field: string
): Record<string, unknown> | undefined {
  const dateFrom = params.dateFrom ? String(params.dateFrom) : undefined
  const dateTo = params.dateTo ? String(params.dateTo) : undefined
  if (!dateFrom && !dateTo) return undefined
  return {
    [field]: {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {}),
    },
  }
}

function pickColumns(
  rows: Record<string, unknown>[],
  columns?: string[]
): Record<string, unknown>[] {
  if (!columns?.length) return rows
  return rows.map(row => {
    const picked: Record<string, unknown> = {}
    for (const col of columns) {
      if (col in row) picked[col] = row[col]
    }
    return picked
  })
}

function summarizeCount(
  label: string,
  value: string | number,
  detail: string
): ReportSummaryItem {
  return { title: label, value, description: detail }
}

export async function runInventoryReportDataset(
  datasetId: string,
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  if (scope.noAccess) {
    return emptyResponse(datasetId, params)
  }

  switch (datasetId) {
    case 'equipment':
      return runEquipmentDataset(params, scope)
    case 'licenses':
      return runLicensesDataset(params, scope)
    case 'consumables':
      return runConsumablesDataset(params, scope)
    case 'contracts':
      return runContractsDataset(params, scope)
    case 'assignments':
      return runAssignmentsDataset(params, scope)
    case 'maintenance':
      return runMaintenanceDataset(params, scope)
    case 'sales':
      return runSalesDataset(params, scope)
    case 'rentals':
      return runRentalsDataset(params, scope)
    case 'expiring':
    case 'stock-movements':
    case 'locations':
    case 'decommissions':
      return runTemplateBackedDataset(datasetId, params, scope)
    default:
      throw new Error(`Dataset de reporte no soportado: ${datasetId}`)
  }
}

async function runTemplateBackedDataset(
  datasetId: string,
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const templateSlug = TEMPLATE_DATASET_SLUGS[datasetId]
  if (!templateSlug) {
    throw new Error(`Dataset de plantilla no configurado: ${datasetId}`)
  }

  const stringParams: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (key === 'dataset' || value == null) continue
    stringParams[key] = String(value)
  }

  const result = await runInventoryReportTemplate(templateSlug, stringParams, scope)
  const { page, limit, skip } = parsePagination(params)
  const allData = pickColumns(result.data, params.columns)
  const paginated = allData.slice(skip, skip + limit)

  return {
    ...result,
    data: paginated,
    totalCount: allData.length,
    meta: { dataset: datasetId, page, limit, columns: params.columns },
  }
}

function emptyResponse(datasetId: string, params: ReportRunParams): ReportResponse {
  return {
    summary: [summarizeCount('Registros', 0, 'Sin acceso a familias')],
    data: [],
    filters: { ...params, dataset: datasetId },
    generatedAt: new Date().toISOString(),
    totalCount: 0,
    meta: { dataset: datasetId, page: 1, limit: 100 },
  }
}

async function runEquipmentDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit, skip } = parsePagination(params)
  const where: Record<string, unknown> = {
    ...equipmentScopeWhere(scope.familyIds),
  }

  const status = params.status ? String(params.status) : undefined
  if (status && status !== ALL_FILTER) where.status = status

  const acquisitionMode = params.acquisitionMode ? String(params.acquisitionMode) : undefined
  if (acquisitionMode && acquisitionMode !== ALL_FILTER) {
    where.acquisitionMode = acquisitionMode
  }

  const purchaseDateFilter = dateRangeFilter(params, 'purchaseDate')
  if (purchaseDateFilter) Object.assign(where, purchaseDateFilter)

  const search = params.search ? String(params.search).trim() : ''
  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { modelDeprecated: { contains: search, mode: 'insensitive' } },
    ]
  }

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('equipment') : null
  if (groupByKey && groupConfig) {
    const records = await prisma.equipment.findMany({
      where,
      take: GROUP_BY_ROW_LIMIT,
      orderBy: { code: 'asc' },
      select: {
        status: true,
        acquisitionMode: true,
        purchasePrice: true,
        purchaseDate: true,
        rentalMonthlyCost: true,
        type: { select: { name: true, family: { select: { name: true } } } },
      },
    })
    const groupable: GroupableRow[] = records.map(eq => ({
      groupValues: {
        familia: eq.type?.family?.name ?? '—',
        estado: EQUIPMENT_STATUS_ES[eq.status] ?? eq.status,
        modalidad: ACQUISITION_LABELS[eq.acquisitionMode ?? 'FIXED_ASSET'] ?? eq.acquisitionMode ?? '—',
        tipo: eq.type?.name ?? '—',
        mesCompra: monthKey(eq.purchaseDate),
      },
      sums: {
        valorCompra: eq.purchasePrice ?? 0,
        rentaMensual: eq.rentalMonthlyCost ?? 0,
      },
    }))
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('equipment', grouped, params, groupByKey)
  }

  const [records, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { code: 'asc' },
      select: {
        code: true,
        brand: true,
        modelDeprecated: true,
        status: true,
        acquisitionMode: true,
        physicalLocation: true,
        purchasePrice: true,
        purchaseDate: true,
        rentalMonthlyCost: true,
        rentalEndDate: true,
        type: { select: { name: true, family: { select: { name: true } } } },
        model: { select: { brand: true, model: true } },
        assignments: {
          where: { isActive: true },
          take: 1,
          select: { receiver: { select: { name: true } } },
        },
      },
    }),
    prisma.equipment.count({ where }),
  ])

  const data = records.map(eq => {
    const brandName =
      typeof eq.model?.brand === 'object' && eq.model.brand && 'name' in eq.model.brand
        ? String((eq.model.brand as { name: string }).name)
        : eq.brand
    const modelName = eq.model?.model ?? eq.modelDeprecated
    return {
      codigo: eq.code,
      equipo: `${brandName} ${modelName}`.trim(),
      familia: eq.type?.family?.name ?? '—',
      tipo: eq.type?.name ?? '—',
      estado: EQUIPMENT_STATUS_ES[eq.status] ?? eq.status,
      modalidad: ACQUISITION_LABELS[eq.acquisitionMode ?? 'FIXED_ASSET'] ?? eq.acquisitionMode,
      ubicacion: eq.physicalLocation ?? '—',
      asignadoA: eq.assignments[0]?.receiver?.name ?? '—',
      precioCompra: eq.purchasePrice != null ? formatCurrency(eq.purchasePrice) : '—',
      rentaMensual: eq.rentalMonthlyCost != null ? formatCurrency(eq.rentalMonthlyCost) : '—',
      fechaCompra: eq.purchaseDate ? formatDate(eq.purchaseDate) : '—',
      finContrato: eq.rentalEndDate ? formatDate(eq.rentalEndDate) : '—',
    }
  })

  const columns = params.columns?.length ? params.columns.map(String) : undefined

  return {
    summary: [
      summarizeCount('Equipos', total, 'Total en el scope seleccionado'),
      summarizeCount('Página', `${page}/${Math.ceil(total / limit) || 1}`, `${limit} por página`),
    ],
    data: pickColumns(data, columns),
    filters: { ...params, dataset: 'equipment' },
    generatedAt: new Date().toISOString(),
    totalCount: total,
    meta: { dataset: 'equipment', page, limit, columns },
  }
}

async function runLicensesDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit, skip } = parsePagination(params)
  const where: Record<string, unknown> = {
    ...licenseScopeWhere(scope.familyIds),
  }

  const expiringDays = params.expiringDays ? String(params.expiringDays) : undefined
  const now = new Date()
  if (expiringDays === 'expired') {
    where.expirationDate = { lt: now }
  } else if (expiringDays && expiringDays !== ALL_FILTER) {
    const days = parseInt(expiringDays, 10)
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + days)
    where.expirationDate = { gte: now, lte: horizon }
  }

  const search = params.search ? String(params.search).trim() : ''
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { vendor: { contains: search, mode: 'insensitive' } },
    ]
  }

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('licenses') : null
  if (groupByKey && groupConfig) {
    const records = await prisma.software_licenses.findMany({
      where,
      take: GROUP_BY_ROW_LIMIT,
      orderBy: { expirationDate: 'asc' },
      select: {
        cost: true,
        renewalCost: true,
        expirationDate: true,
        licenseType: {
          select: { name: true, family: { select: { name: true } } },
        },
      },
    })
    const groupable: GroupableRow[] = records.map(lic => ({
      groupValues: {
        familia: lic.licenseType?.family?.name ?? '—',
        tipo: lic.licenseType?.name ?? '—',
        mesVencimiento: monthKey(lic.expirationDate),
      },
      sums: {
        costo: lic.cost ?? 0,
        renovacion: lic.renewalCost ?? 0,
      },
    }))
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('licenses', grouped, params, groupByKey)
  }

  const [records, total] = await Promise.all([
    prisma.software_licenses.findMany({
      where,
      skip,
      take: limit,
      orderBy: { expirationDate: 'asc' },
      select: {
        name: true,
        cost: true,
        renewalCost: true,
        expirationDate: true,
        licenseScope: true,
        supplier: { select: { name: true } },
        licenseType: {
          select: { name: true, family: { select: { name: true } } },
        },
      },
    }),
    prisma.software_licenses.count({ where }),
  ])

  const SCOPE_ES: Record<string, string> = {
    INDIVIDUAL: 'Individual',
    DEPARTMENT: 'Departamento',
    COMPANY: 'Empresa',
  }

  const data = records.map(lic => ({
    nombre: lic.name,
    familia: lic.licenseType?.family?.name ?? '—',
    tipo: lic.licenseType?.name ?? '—',
    proveedor: lic.supplier?.name ?? '—',
    costo: lic.cost != null ? formatCurrency(lic.cost) : '—',
    renovacion: lic.renewalCost != null ? formatCurrency(lic.renewalCost) : '—',
    vencimiento: lic.expirationDate ? formatDate(lic.expirationDate) : '—',
    alcance: lic.licenseScope ? (SCOPE_ES[lic.licenseScope] ?? lic.licenseScope) : '—',
  }))

  return buildDatasetResponse('licenses', data, total, page, limit, params)
}

async function runConsumablesDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit } = parsePagination(params)
  const where: Record<string, unknown> = {
    ...consumableScopeWhere(scope.familyIds),
  }

  const stockLevel = params.stockLevel ? String(params.stockLevel) : undefined

  const search = params.search ? String(params.search).trim() : ''
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('consumables') : null

  const records = await prisma.consumables.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      name: true,
      currentStock: true,
      minStock: true,
      costPerUnit: true,
      status: true,
      unitOfMeasure: { select: { name: true, symbol: true } },
      consumableType: { select: { family: { select: { name: true } } } },
    },
  })

  let filtered = records
  if (stockLevel === 'low') {
    filtered = records.filter(c => c.currentStock <= c.minStock)
  } else if (stockLevel === 'ok') {
    filtered = records.filter(c => c.currentStock > c.minStock)
  }

  if (groupByKey && groupConfig) {
    const groupable: GroupableRow[] = filtered.slice(0, GROUP_BY_ROW_LIMIT).map(c => ({
      groupValues: {
        familia: c.consumableType?.family?.name ?? '—',
        estado: CONSUMABLE_STATUS_ES[c.status] ?? c.status,
      },
      sums: {
        valorStock: (c.costPerUnit ?? 0) * c.currentStock,
      },
    }))
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('consumables', grouped, params, groupByKey)
  }

  const total = filtered.length
  const skip = (page - 1) * limit
  const pageRows = filtered.slice(skip, skip + limit)

  const data = pageRows.map(c => ({
    nombre: c.name,
    familia: c.consumableType?.family?.name ?? '—',
    stock: c.currentStock,
    minimo: c.minStock,
    unidad: c.unitOfMeasure?.symbol ?? c.unitOfMeasure?.name ?? '—',
    costoUnitario: c.costPerUnit != null ? formatCurrency(c.costPerUnit) : '—',
    valorTotal:
      c.costPerUnit != null ? formatCurrency(c.costPerUnit * c.currentStock) : '—',
    estado: CONSUMABLE_STATUS_ES[c.status] ?? c.status,
  }))

  return buildDatasetResponse('consumables', data, total, page, limit, params)
}

async function runContractsDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit, skip } = parsePagination(params)
  const where: Record<string, unknown> = {
    ...contractFamilyFilter(scope.familyIds),
  }

  const status = params.status ? String(params.status) : undefined
  if (status && status !== ALL_FILTER) where.status = status

  const category = params.category ? String(params.category) : undefined
  if (category && category !== ALL_FILTER) where.category = category

  const endDateFilter = dateRangeFilter(params, 'endDate')
  if (endDateFilter) Object.assign(where, endDateFilter)

  const search = params.search ? String(params.search).trim() : ''
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { contractNumber: { contains: search, mode: 'insensitive' } },
    ]
  }

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('contracts') : null
  if (groupByKey && groupConfig) {
    const records = await prisma.contracts.findMany({
      where,
      take: GROUP_BY_ROW_LIMIT,
      orderBy: { endDate: 'asc' },
      select: {
        category: true,
        status: true,
        monthlyCost: true,
        family: { select: { name: true } },
      },
    })
    const groupable: GroupableRow[] = records.map(c => ({
      groupValues: {
        familia: c.family?.name ?? '—',
        categoria: CONTRACT_CATEGORY_ES[c.category] ?? c.category,
        estado: CONTRACT_STATUS_ES[c.status] ?? c.status,
      },
      sums: { costoMensual: c.monthlyCost ?? 0 },
    }))
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('contracts', grouped, params, groupByKey)
  }

  const [records, total] = await Promise.all([
    prisma.contracts.findMany({
      where,
      skip,
      take: limit,
      orderBy: { endDate: 'asc' },
      select: {
        contractNumber: true,
        name: true,
        category: true,
        status: true,
        startDate: true,
        endDate: true,
        monthlyCost: true,
        billingCycle: true,
        family: { select: { name: true } },
        supplier: { select: { name: true } },
        custodian: { select: { name: true } },
      },
    }),
    prisma.contracts.count({ where }),
  ])

  const data = records.map(c => ({
    numero: c.contractNumber ?? '—',
    nombre: c.name,
    familia: c.family?.name ?? '—',
    categoria: CONTRACT_CATEGORY_ES[c.category] ?? c.category,
    estado: CONTRACT_STATUS_ES[c.status] ?? c.status,
    proveedor: c.supplier?.name ?? '—',
    custodio: c.custodian?.name ?? '—',
    inicio: c.startDate ? formatDate(c.startDate) : '—',
    fin: c.endDate ? formatDate(c.endDate) : '—',
    costoMensual: c.monthlyCost != null ? formatCurrency(c.monthlyCost) : '—',
    ciclo: c.billingCycle ?? '—',
  }))

  return buildDatasetResponse('contracts', data, total, page, limit, params)
}

async function runAssignmentsDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit, skip } = parsePagination(params)
  const where: Record<string, unknown> = {
    isActive: true,
    equipment: equipmentScopeWhere(scope.familyIds),
  }

  const assignedFilter = dateRangeFilter(params, 'startDate')
  if (assignedFilter) Object.assign(where, assignedFilter)

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('assignments') : null
  if (groupByKey && groupConfig) {
    const records = await prisma.equipment_assignments.findMany({
      where,
      take: GROUP_BY_ROW_LIMIT,
      orderBy: { startDate: 'desc' },
      select: {
        receiver: {
          select: {
            departments: { select: { name: true } },
          },
        },
        equipment: {
          select: {
            type: { select: { family: { select: { name: true } } } },
          },
        },
      },
    })
    const groupable: GroupableRow[] = records.map(a => ({
      groupValues: {
        familia: a.equipment.type?.family?.name ?? '—',
        departamento: a.receiver?.departments?.name ?? '—',
      },
      sums: {},
    }))
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('assignments', grouped, params, groupByKey)
  }

  const [records, total] = await Promise.all([
    prisma.equipment_assignments.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: 'desc' },
      select: {
        startDate: true,
        receiver: {
          select: {
            name: true,
            departments: { select: { name: true } },
          },
        },
        equipment: {
          select: {
            code: true,
            brand: true,
            modelDeprecated: true,
            physicalLocation: true,
            type: { select: { family: { select: { name: true } } } },
            model: { select: { brand: true, model: true } },
          },
        },
      },
    }),
    prisma.equipment_assignments.count({ where }),
  ])

  const data = records.map(a => {
    const eq = a.equipment
    const brandName =
      typeof eq.model?.brand === 'object' && eq.model.brand && 'name' in eq.model.brand
        ? String((eq.model.brand as { name: string }).name)
        : eq.brand
    return {
      equipo: `${brandName} ${eq.model?.model ?? eq.modelDeprecated}`.trim(),
      codigo: eq.code,
      usuario: a.receiver?.name ?? '—',
      departamento: a.receiver?.departments?.name ?? '—',
      familia: eq.type?.family?.name ?? '—',
      fechaAsignacion: formatDate(a.startDate),
      ubicacion: eq.physicalLocation ?? '—',
    }
  })

  return buildDatasetResponse('assignments', data, total, page, limit, params)
}

async function runMaintenanceDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit, skip } = parsePagination(params)
  const where: Record<string, unknown> = {
    equipment: equipmentScopeWhere(scope.familyIds),
  }

  const status = params.status ? String(params.status) : undefined
  if (status && status !== ALL_FILTER) where.status = status

  const dateFilter = dateRangeFilter(params, 'date')
  if (dateFilter) Object.assign(where, dateFilter)

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('maintenance') : null

  const TYPE_ES: Record<string, string> = {
    PREVENTIVE: 'Preventivo',
    CORRECTIVE: 'Correctivo',
  }

  if (groupByKey && groupConfig) {
    const records = await prisma.maintenance_records.findMany({
      where,
      take: GROUP_BY_ROW_LIMIT,
      orderBy: { date: 'desc' },
      select: {
        type: true,
        status: true,
        date: true,
        cost: true,
        equipment: {
          select: {
            type: { select: { family: { select: { name: true } } } },
          },
        },
      },
    })
    const groupable: GroupableRow[] = records.map(m => ({
      groupValues: {
        estado: MAINTENANCE_STATUS_ES[m.status] ?? m.status,
        tipo: TYPE_ES[m.type] ?? m.type,
        mes: monthKey(m.date),
        familia: m.equipment.type?.family?.name ?? '—',
      },
      sums: { costo: m.cost ?? 0 },
    }))
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('maintenance', grouped, params, groupByKey)
  }

  const [records, total] = await Promise.all([
    prisma.maintenance_records.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      select: {
        type: true,
        status: true,
        date: true,
        cost: true,
        description: true,
        technician: { select: { name: true } },
        equipment: { select: { code: true, brand: true, modelDeprecated: true } },
      },
    }),
    prisma.maintenance_records.count({ where }),
  ])

  const data = records.map(m => ({
    equipo: `${m.equipment.code} — ${m.equipment.brand} ${m.equipment.modelDeprecated}`,
    tipo: TYPE_ES[m.type] ?? m.type,
    estado: MAINTENANCE_STATUS_ES[m.status] ?? m.status,
    fecha: formatDate(m.date),
    tecnico: m.technician?.name ?? '—',
    costo: m.cost != null ? formatCurrency(m.cost) : '—',
    descripcion: m.description,
  }))

  return buildDatasetResponse('maintenance', data, total, page, limit, params)
}

async function runSalesDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit, skip } = parsePagination(params)
  const where: Record<string, unknown> = {
    equipment: equipmentScopeWhere(scope.familyIds),
  }

  const status = params.status ? String(params.status) : undefined
  if (status && status !== ALL_FILTER) where.status = status

  const saleDateFilter = dateRangeFilter(params, 'saleDate')
  if (saleDateFilter) Object.assign(where, saleDateFilter)

  const STATUS_ES: Record<string, string> = {
    APPROVED: 'Aprobada',
    PENDING: 'Pendiente',
    REJECTED: 'Rechazada',
  }

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('sales') : null
  if (groupByKey && groupConfig) {
    const records = await prisma.equipment_sales.findMany({
      where,
      take: GROUP_BY_ROW_LIMIT,
      orderBy: { saleDate: 'desc' },
      select: {
        salePrice: true,
        saleDate: true,
        status: true,
        equipment: { select: { purchasePrice: true } },
      },
    })
    const groupable: GroupableRow[] = records.map(s => {
      const profit =
        s.equipment.purchasePrice != null ? s.salePrice - s.equipment.purchasePrice : 0
      return {
        groupValues: {
          estado: STATUS_ES[s.status] ?? s.status,
          mes: monthKey(s.saleDate),
        },
        sums: {
          precioVenta: s.salePrice,
          resultado: profit,
        },
      }
    })
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('sales', grouped, params, groupByKey)
  }

  const [records, total] = await Promise.all([
    prisma.equipment_sales.findMany({
      where,
      skip,
      take: limit,
      orderBy: { saleDate: 'desc' },
      select: {
        salePrice: true,
        saleDate: true,
        status: true,
        buyerName: true,
        equipment: {
          select: {
            code: true,
            brand: true,
            model: true,
            purchasePrice: true,
          },
        },
      },
    }),
    prisma.equipment_sales.count({ where }),
  ])

  const data = records.map(s => {
    const bookValue = s.equipment.purchasePrice
    const profit =
      bookValue != null ? s.salePrice - bookValue : null
    return {
      codigo: s.equipment.code,
      equipo: `${s.equipment.brand} ${s.equipment.model}`,
      comprador: s.buyerName,
      precioVenta: formatCurrency(s.salePrice),
      valorLibro: bookValue != null ? formatCurrency(bookValue) : '—',
      resultado:
        profit != null
          ? profit >= 0
            ? `+${formatCurrency(profit)}`
            : formatCurrency(profit)
          : '—',
      fechaVenta: formatDate(s.saleDate),
      estado: STATUS_ES[s.status] ?? s.status,
    }
  })

  return buildDatasetResponse('sales', data, total, page, limit, params)
}

async function runRentalsDataset(
  params: ReportRunParams,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const { page, limit, skip } = parsePagination(params)
  const where: Record<string, unknown> = {
    ...equipmentScopeWhere(scope.familyIds),
    acquisitionMode: 'RENTAL',
  }

  const expiringDays = params.expiringDays ? String(params.expiringDays) : undefined
  if (expiringDays && expiringDays !== ALL_FILTER) {
    const days = parseInt(expiringDays, 10)
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + days)
    where.rentalEndDate = { gte: new Date(), lte: horizon }
  }

  const groupByKey = isGroupByActive(params) ? String(params.groupBy) : null
  const groupConfig = groupByKey ? getDatasetGroupByConfig('rentals') : null
  if (groupByKey && groupConfig) {
    const records = await prisma.equipment.findMany({
      where,
      take: GROUP_BY_ROW_LIMIT,
      orderBy: { rentalEndDate: 'asc' },
      select: {
        rentalMonthlyCost: true,
        rentalEndDate: true,
        type: { select: { family: { select: { name: true } } } },
      },
    })
    const groupable: GroupableRow[] = records.map(eq => ({
      groupValues: {
        familia: eq.type?.family?.name ?? '—',
        mesFin: monthKey(eq.rentalEndDate),
      },
      sums: { rentaMensual: eq.rentalMonthlyCost ?? 0 },
    }))
    const grouped = aggregateGroupableRows(groupable, groupByKey, groupConfig)
    return buildGroupedDatasetResponse('rentals', grouped, params, groupByKey)
  }

  const [records, total] = await Promise.all([
    prisma.equipment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { rentalEndDate: 'asc' },
      select: {
        code: true,
        brand: true,
        modelDeprecated: true,
        rentalContractNumber: true,
        rentalMonthlyCost: true,
        rentalStartDate: true,
        rentalEndDate: true,
        type: { select: { family: { select: { name: true } } } },
        model: { select: { brand: true, model: true } },
        assignments: {
          where: { isActive: true },
          take: 1,
          select: { receiver: { select: { name: true } } },
        },
      },
    }),
    prisma.equipment.count({ where }),
  ])

  const data = records.map(eq => {
    const brandName =
      typeof eq.model?.brand === 'object' && eq.model.brand && 'name' in eq.model.brand
        ? String((eq.model.brand as { name: string }).name)
        : eq.brand
    return {
      codigo: eq.code,
      equipo: `${brandName} ${eq.model?.model ?? eq.modelDeprecated}`.trim(),
      familia: eq.type?.family?.name ?? '—',
      contrato: eq.rentalContractNumber ?? '—',
      rentaMensual: eq.rentalMonthlyCost != null ? formatCurrency(eq.rentalMonthlyCost) : '—',
      inicio: eq.rentalStartDate ? formatDate(eq.rentalStartDate) : '—',
      fin: eq.rentalEndDate ? formatDate(eq.rentalEndDate) : '—',
      asignadoA: eq.assignments[0]?.receiver?.name ?? '—',
    }
  })

  return buildDatasetResponse('rentals', data, total, page, limit, params)
}

function buildDatasetResponse(
  datasetId: string,
  data: Record<string, unknown>[],
  total: number,
  page: number,
  limit: number,
  params: ReportRunParams
): ReportResponse {
  const columns = params.columns?.length ? params.columns.map(String) : undefined
  return {
    summary: [
      summarizeCount('Registros', total, 'Total en el scope seleccionado'),
      summarizeCount('Página', `${page}/${Math.ceil(total / limit) || 1}`, `${limit} por página`),
    ],
    data: pickColumns(data, columns),
    filters: { ...params, dataset: datasetId },
    generatedAt: new Date().toISOString(),
    totalCount: total,
    meta: { dataset: datasetId, page, limit, columns },
  }
}

export function exportReportCsv(data: Record<string, unknown>[]): string {
  if (!data.length) return ''
  return toCSV(data)
}

export function exportReportXlsx(
  data: Record<string, unknown>[],
  sheetName = 'Reporte'
): Buffer {
  const safeName = sheetName.slice(0, 31) || 'Reporte'
  return ExcelGenerator.generate([{ name: safeName, data }], {
    title: safeName,
    subject: 'Centro de Reportes — Inventario',
  })
}

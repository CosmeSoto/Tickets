import { prisma } from '@/lib/prisma'
import {
  CONSUMABLE_STATUS_ES,
  DECOMMISSION_REASON_ES,
  EQUIPMENT_STATUS_ES,
  MAINTENANCE_STATUS_ES,
  daysUntil,
  formatCurrency,
  formatDate,
} from '@/lib/inventory/report-utils'
import {
  buildConsumableFamilyWhere,
  buildEquipmentFamilyWhere,
  buildLicenseFamilyWhere,
} from '@/lib/inventory/scope-filter'
import { emptyReportResponse } from './empty-report'
import {
  consumableScopeWhere,
  equipmentScopeWhere,
  type ReportScopeContext,
} from './scope'
import type { ReportResponse } from './types'
import { InventoryReportService } from '@/lib/services/inventory-report.service'

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  DISCOUNT: 'Descuento de rol',
}

const SALES_STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Aprobada',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazada',
}

/** IDs de familia listos para consulta Prisma (undefined = sin restricción). */
export function familyIdsForQuery(scope: ReportScopeContext): string[] | undefined {
  return scope.familyIds
}

function calcBookValue(
  purchasePrice: number | null,
  purchaseDate: Date | null,
  usefulLifeYears: number | null,
  residualValue: number | null,
  saleDate: Date
): number | null {
  if (!purchasePrice || !purchaseDate || !usefulLifeYears) return null
  const years = (saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const depPerYear = (purchasePrice - (residualValue ?? 0)) / usefulLifeYears
  return Math.max(purchasePrice - depPerYear * years, residualValue ?? 0)
}

function fmtCurrency(v: number | null): string {
  if (v === null) return '—'
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v)
}

export async function runInventoryReportTemplate(
  slug: string,
  params: Record<string, string>,
  scope: ReportScopeContext,
  sessionUser?: { role: string; isSuperAdmin?: boolean }
): Promise<ReportResponse> {
  if (slug !== 'financial-summary' && scope.noAccess) {
    return emptyReportResponse(templateFilters(slug, params))
  }

  switch (slug) {
    case 'summary':
      return runSummaryTemplate(params, scope)
    case 'assignments':
      return runAssignmentsTemplate(params, scope)
    case 'expiring':
      return runExpiringTemplate(params, scope)
    case 'maintenance':
      return runMaintenanceTemplate(params, scope)
    case 'stock-movements':
      return runStockMovementsTemplate(params, scope)
    case 'decommissioned':
      return runDecommissionedTemplate(params, scope)
    case 'locations':
      return runLocationsTemplate(params, scope)
    case 'sales':
      return runSalesTemplate(params, scope)
    case 'financial-summary':
      return runFinancialSummaryTemplate(params, sessionUser)
    case 'by-model':
      return runByModelTemplate(params, scope)
    case 'by-batch':
      return runByBatchTemplate(params, scope)
    default:
      throw new Error(`Plantilla de reporte desconocida: ${slug}`)
  }
}

function templateFilters(slug: string, params: Record<string, string>): Record<string, unknown> {
  switch (slug) {
    case 'summary':
      return {
        familyId: params.familyId ?? null,
        subtype: params.subtype ?? null,
      }
    case 'assignments':
      return {
        familyId: params.familyId ?? null,
        userId: params.userId ?? null,
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
      }
    case 'expiring':
      return {
        days: parseInt(params.days || '90', 10),
        familyId: params.familyId ?? null,
      }
    case 'maintenance':
      return {
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
        equipmentId: params.equipmentId ?? null,
        status: params.status ?? null,
      }
    case 'stock-movements':
      return {
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
        consumableId: params.consumableId ?? null,
        type: params.type ?? null,
      }
    case 'decommissioned':
      return {
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
        familyId: params.familyId ?? null,
        reason: params.reason ?? null,
      }
    case 'locations':
      return {
        familyId: params.familyId ?? null,
        onlyWithLocation: params.onlyWithLocation === 'true',
      }
    case 'sales':
      return {
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
        status: params.status ?? null,
        familyId: params.familyId ?? null,
      }
    case 'by-model':
      return {
        reportType: params.reportType ?? 'inventory',
        dateFrom: params.dateFrom ?? null,
        dateTo: params.dateTo ?? null,
        modelId: params.modelId ?? null,
        familyId: params.familyId ?? null,
      }
    case 'by-batch':
      return {
        batchId: params.batchId ?? null,
        supplierId: params.supplierId ?? null,
        familyId: params.familyId ?? null,
      }
    default:
      return { ...params }
  }
}

// ── summary ─────────────────────────────────────────────────────────────────

interface SummaryRow extends Record<string, unknown> {
  familia: string
  subtipo: string
  cantidad: number
  valorTotal: string
  estado: string
}

async function runSummaryTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<SummaryRow>> {
  const familyId = params.familyId || undefined
  const subtype = params.subtype || undefined
  const familyIds = familyIdsForQuery(scope)

  const equipmentData = await prisma.equipment.findMany({
    where: buildEquipmentFamilyWhere(familyIds),
    select: {
      status: true,
      purchasePrice: true,
      type: {
        select: {
          family: { select: { name: true } },
        },
      },
    },
  })

  const consumableData = await prisma.consumables.findMany({
    where: buildConsumableFamilyWhere(familyIds),
    select: {
      status: true,
      costPerUnit: true,
      currentStock: true,
      consumableType: {
        select: {
          family: { select: { name: true } },
        },
      },
    },
  })

  const licenseData = await prisma.software_licenses.findMany({
    where: buildLicenseFamilyWhere(familyIds),
    select: {
      cost: true,
      licenseType: {
        select: {
          family: { select: { name: true } },
        },
      },
    },
  })

  const rows: SummaryRow[] = []

  const equipByFamilyStatus = new Map<string, { count: number; value: number }>()
  for (const eq of equipmentData) {
    const familia = eq.type?.family?.name ?? 'Sin familia'
    const estado = EQUIPMENT_STATUS_ES[eq.status] ?? eq.status
    const key = `${familia}||EQUIPMENT||${estado}`
    const prev = equipByFamilyStatus.get(key) ?? { count: 0, value: 0 }
    equipByFamilyStatus.set(key, {
      count: prev.count + 1,
      value: prev.value + (eq.purchasePrice ?? 0),
    })
  }
  for (const [key, { count, value }] of equipByFamilyStatus) {
    const [familia, , estado] = key.split('||')
    if (!subtype || subtype === 'EQUIPMENT') {
      rows.push({
        familia,
        subtipo: 'Equipo',
        cantidad: count,
        valorTotal: formatCurrency(value),
        estado,
      })
    }
  }

  const consByFamilyStatus = new Map<string, { count: number; value: number }>()
  for (const c of consumableData) {
    const familia = c.consumableType?.family?.name ?? 'Sin familia'
    const estado = CONSUMABLE_STATUS_ES[c.status] ?? c.status
    const key = `${familia}||MRO||${estado}`
    const prev = consByFamilyStatus.get(key) ?? { count: 0, value: 0 }
    consByFamilyStatus.set(key, {
      count: prev.count + 1,
      value: prev.value + (c.costPerUnit ?? 0) * c.currentStock,
    })
  }
  for (const [key, { count, value }] of consByFamilyStatus) {
    const [familia, , estado] = key.split('||')
    if (!subtype || subtype === 'MRO') {
      rows.push({
        familia,
        subtipo: 'Consumible',
        cantidad: count,
        valorTotal: formatCurrency(value),
        estado,
      })
    }
  }

  const licByFamily = new Map<string, { count: number; value: number }>()
  for (const lic of licenseData) {
    const familia = lic.licenseType?.family?.name ?? 'Sin familia'
    const key = `${familia}||LICENSE`
    const prev = licByFamily.get(key) ?? { count: 0, value: 0 }
    licByFamily.set(key, { count: prev.count + 1, value: prev.value + (lic.cost ?? 0) })
  }
  for (const [key, { count, value }] of licByFamily) {
    const [familia] = key.split('||')
    if (!subtype || subtype === 'LICENSE') {
      rows.push({
        familia,
        subtipo: 'Licencia/Contrato',
        cantidad: count,
        valorTotal: formatCurrency(value),
        estado: 'Activo',
      })
    }
  }

  const totalActivos = equipmentData.length + consumableData.length + licenseData.length
  const totalValor = [
    ...equipmentData.map(e => e.purchasePrice ?? 0),
    ...consumableData.map(c => (c.costPerUnit ?? 0) * c.currentStock),
    ...licenseData.map(l => l.cost ?? 0),
  ].reduce((a, b) => a + b, 0)

  const equipRetired = equipmentData.filter(e => e.status === 'RETIRED').length
  const equipActive = equipmentData.length - equipRetired

  const summary = [
    {
      title: 'Total de activos',
      value: totalActivos,
      description: `${equipActive} equipos activos, ${consumableData.length} materiales MRO, ${licenseData.length} licencias`,
    },
    {
      title: 'Valor total estimado',
      value: formatCurrency(totalValor),
      description: 'Suma del precio de compra de todos los activos',
    },
    {
      title: 'Activos dados de baja',
      value: equipRetired,
      description: `${equipRetired} equipos con estado "Dado de baja"`,
    },
  ]

  return {
    summary,
    data: rows,
    filters: {
      familyId: familyId ?? null,
      subtype: subtype ?? null,
    },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── assignments ─────────────────────────────────────────────────────────────

interface AssignmentRow extends Record<string, unknown> {
  equipmentCode: string
  equipmentName: string
  familia: string
  estado: string
  usuarioAsignado: string
  departamento: string
  ubicacionFisica: string
  fechaAsignacion: string
  fechaFin: string
  tipoAsignacion: string
}

async function runAssignmentsTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<AssignmentRow>> {
  const familyId = params.familyId || undefined
  const userId = params.userId || undefined
  const dateFrom = params.dateFrom || undefined
  const dateTo = params.dateTo || undefined
  const familyIds = familyIdsForQuery(scope)

  const where: Record<string, unknown> = { isActive: true }

  if (userId) {
    where.receiverId = userId
  }

  if (dateFrom || dateTo) {
    where.startDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }

  const equipmentFamilyWhere = buildEquipmentFamilyWhere(familyIds)
  if (Object.keys(equipmentFamilyWhere).length > 0) {
    where.equipment = equipmentFamilyWhere
  }

  const assignments = await (prisma.equipment_assignments.findMany as any)({
    where,
    include: {
      equipment: {
        select: {
          code: true,
          brand: true,
          model: true,
          status: true,
          physicalLocation: true,
          type: {
            select: {
              family: { select: { name: true } },
            },
          },
        },
      },
      receiver: {
        select: {
          name: true,
          departments: { select: { name: true } },
        },
      },
    },
    orderBy: { startDate: 'desc' },
  })

  const rows: AssignmentRow[] = assignments.map((a: any) => ({
    equipmentCode: a.equipment.code,
    equipmentName: `${a.equipment.brand} ${a.equipment.model}`,
    familia: a.equipment.type?.family?.name ?? '—',
    estado: EQUIPMENT_STATUS_ES[a.equipment.status] ?? a.equipment.status,
    usuarioAsignado: a.receiver.name ?? '—',
    departamento: (a.receiver as any).departments?.name ?? '—',
    ubicacionFisica: (a.equipment as any).physicalLocation ?? '—',
    fechaAsignacion: formatDate(a.startDate),
    fechaFin: a.endDate ? formatDate(a.endDate) : 'Indefinida',
    tipoAsignacion:
      a.assignmentType === 'PERMANENT'
        ? 'Permanente'
        : a.assignmentType === 'TEMPORARY'
          ? 'Temporal'
          : 'Préstamo',
  }))

  const totalAsignados = rows.length
  const uniqueUsers = new Set(assignments.map((a: any) => a.receiverId)).size
  const permanentes = assignments.filter((a: any) => a.assignmentType === 'PERMANENT').length

  const summary = [
    {
      title: 'Equipos asignados actualmente',
      value: totalAsignados,
      description: 'Asignaciones activas en este momento',
    },
    {
      title: 'Usuarios con equipos',
      value: uniqueUsers,
      description: 'Número de usuarios distintos con al menos un equipo asignado',
    },
    {
      title: 'Asignaciones permanentes',
      value: permanentes,
      description: `${permanentes} de ${totalAsignados} asignaciones son de tipo permanente`,
    },
  ]

  return {
    summary,
    data: rows,
    filters: {
      familyId: familyId ?? null,
      userId: userId ?? null,
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
    },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── expiring ────────────────────────────────────────────────────────────────

interface ExpiringRow extends Record<string, unknown> {
  tipo: string
  nombre: string
  codigo: string
  familia: string
  fechaVencimiento: string
  diasRestantes: number
  urgencia: string
}

async function runExpiringTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<ExpiringRow>> {
  const days = parseInt(params.days || '90', 10)
  const familyId = params.familyId || undefined
  const familyIds = familyIdsForQuery(scope)

  const now = new Date()
  const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  const rows: ExpiringRow[] = []

  const licenses = await prisma.software_licenses.findMany({
    where: {
      expirationDate: { gte: now, lte: cutoff },
      ...buildLicenseFamilyWhere(familyIds),
    },
    select: {
      id: true,
      name: true,
      expirationDate: true,
      licenseType: {
        select: { family: { select: { name: true } } },
      },
    },
  })

  for (const lic of licenses) {
    const dias = daysUntil(lic.expirationDate) ?? 0
    rows.push({
      tipo: 'Licencia/Contrato',
      nombre: lic.name,
      codigo: lic.id.slice(0, 8).toUpperCase(),
      familia: lic.licenseType?.family?.name ?? '—',
      fechaVencimiento: formatDate(lic.expirationDate),
      diasRestantes: dias,
      urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
    })
  }

  const consumables = await prisma.consumables.findMany({
    where: {
      expirationDate: { gte: now, lte: cutoff },
      status: { notIn: ['EXPIRED', 'RETIRED'] },
      ...buildConsumableFamilyWhere(familyIds),
    },
    include: {
      consumableType: {
        select: { family: { select: { name: true } } },
      },
    },
  })

  for (const c of consumables) {
    const dias = daysUntil(c.expirationDate) ?? 0
    rows.push({
      tipo: 'Consumible',
      nombre: c.name,
      codigo: c.id.slice(0, 8).toUpperCase(),
      familia: c.consumableType?.family?.name ?? '—',
      fechaVencimiento: formatDate(c.expirationDate),
      diasRestantes: dias,
      urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
    })
  }

  const equipmentWarranty = await prisma.equipment.findMany({
    where: {
      warrantyExpiration: { gte: now, lte: cutoff },
      status: { not: 'RETIRED' },
      ...buildEquipmentFamilyWhere(familyIds),
    },
    select: {
      id: true,
      code: true,
      brand: true,
      model: true,
      warrantyExpiration: true,
      type: {
        select: { family: { select: { name: true } } },
      },
    },
  })

  for (const eq of equipmentWarranty) {
    const dias = daysUntil(eq.warrantyExpiration) ?? 0
    rows.push({
      tipo: 'Garantía de Equipo',
      nombre: `${eq.brand} ${eq.model}`,
      codigo: eq.code,
      familia: eq.type?.family?.name ?? '—',
      fechaVencimiento: formatDate(eq.warrantyExpiration),
      diasRestantes: dias,
      urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
    })
  }

  const rentalEquipment = await prisma.equipment.findMany({
    where: {
      rentalEndDate: { gte: now, lte: cutoff },
      ownershipType: 'RENTAL',
      status: { not: 'RETIRED' },
      ...buildEquipmentFamilyWhere(familyIds),
    },
    select: {
      id: true,
      code: true,
      brand: true,
      model: true,
      rentalEndDate: true,
      type: {
        select: { family: { select: { name: true } } },
      },
    },
  })

  for (const eq of rentalEquipment) {
    const dias = daysUntil(eq.rentalEndDate) ?? 0
    rows.push({
      tipo: 'Contrato de Renta',
      nombre: `${eq.brand} ${eq.model}`,
      codigo: eq.code,
      familia: eq.type?.family?.name ?? '—',
      fechaVencimiento: formatDate(eq.rentalEndDate),
      diasRestantes: dias,
      urgencia: dias <= 7 ? 'Crítico' : dias <= 30 ? 'Alto' : 'Normal',
    })
  }

  rows.sort((a, b) => a.diasRestantes - b.diasRestantes)

  const criticos = rows.filter(r => r.urgencia === 'Crítico').length
  const altos = rows.filter(r => r.urgencia === 'Alto').length
  const vencenEsteMes = rows.filter(r => r.diasRestantes <= 30).length

  const summary = [
    {
      title: 'Activos próximos a vencer',
      value: rows.length,
      description: `En los próximos ${days} días`,
    },
    {
      title: 'Vencimientos críticos',
      value: criticos,
      description: 'Vencen en 7 días o menos — requieren atención inmediata',
    },
    {
      title: 'Vencen este mes',
      value: vencenEsteMes,
      description: `${altos} con prioridad alta (8-30 días)`,
    },
  ]

  return {
    summary,
    data: rows,
    filters: {
      days,
      familyId: familyId ?? null,
    },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── maintenance ─────────────────────────────────────────────────────────────

interface MaintenanceRow extends Record<string, unknown> {
  fecha: string
  equipo: string
  codigoEquipo: string
  familia: string
  tipo: string
  estado: string
  descripcion: string
  tecnico: string
  costo: string
  fechaCompletado: string
}

async function runMaintenanceTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<MaintenanceRow>> {
  const dateFrom = params.dateFrom || undefined
  const dateTo = params.dateTo || undefined
  const equipmentId = params.equipmentId || undefined
  const status = params.status || undefined
  const familyIds = familyIdsForQuery(scope)

  const where: Record<string, unknown> = {}

  if (equipmentId) {
    where.equipmentId = equipmentId
  }

  if (status) {
    where.status = status
  }

  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }

  const equipmentFamilyWhere = equipmentScopeWhere(familyIds)
  if (Object.keys(equipmentFamilyWhere).length > 0) {
    where.equipment = equipmentFamilyWhere
  }

  const records = await prisma.maintenance_records.findMany({
    where,
    include: {
      equipment: {
        select: {
          code: true,
          brand: true,
          model: true,
          type: { select: { family: { select: { name: true } } } },
        },
      },
      technician: { select: { name: true } },
    },
    orderBy: { date: 'desc' },
  })

  const rows: MaintenanceRow[] = records.map(r => ({
    fecha: formatDate(r.date),
    equipo: `${r.equipment.brand} ${r.equipment.model}`,
    codigoEquipo: r.equipment.code,
    familia: r.equipment.type?.family?.name ?? '—',
    tipo: r.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo',
    estado: MAINTENANCE_STATUS_ES[r.status] ?? r.status,
    descripcion: r.description,
    tecnico: r.technician?.name ?? '—',
    costo: formatCurrency(r.cost),
    fechaCompletado: r.completedAt ? formatDate(r.completedAt) : '—',
  }))

  const totalMantenimientos = rows.length
  const completados = records.filter(r => r.status === 'COMPLETED').length
  const costoTotal = records.reduce((s, r) => s + (r.cost ?? 0), 0)

  const summary = [
    {
      title: 'Total de mantenimientos',
      value: totalMantenimientos,
      description: `${completados} completados, ${totalMantenimientos - completados} en proceso o pendientes`,
    },
    {
      title: 'Costo total',
      value: formatCurrency(costoTotal),
      description: 'Suma de costos de todos los mantenimientos en el período',
    },
    {
      title: 'Tasa de completado',
      value:
        totalMantenimientos > 0
          ? `${Math.round((completados / totalMantenimientos) * 100)}%`
          : '0%',
      description: `${completados} de ${totalMantenimientos} mantenimientos completados`,
    },
  ]

  return {
    summary,
    data: rows,
    filters: {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      equipmentId: equipmentId ?? null,
      status: status ?? null,
    },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── stock-movements ─────────────────────────────────────────────────────────

interface StockMovementRow extends Record<string, unknown> {
  fecha: string
  consumible: string
  familia: string
  tipo: string
  cantidad: number
  unidad: string
  motivo: string
  usuario: string
}

async function runStockMovementsTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<StockMovementRow>> {
  const dateFrom = params.dateFrom || undefined
  const dateTo = params.dateTo || undefined
  const consumableId = params.consumableId || undefined
  const type = params.type || undefined
  const familyIds = familyIdsForQuery(scope)

  const where: Record<string, unknown> = {}

  if (consumableId) {
    where.consumableId = consumableId
  }

  if (type) {
    where.type = type
  }

  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }

  const consumableFamilyWhere = consumableScopeWhere(familyIds)
  if (Object.keys(consumableFamilyWhere).length > 0) {
    where.consumable = consumableFamilyWhere
  }

  const movements = await prisma.stock_movements.findMany({
    where,
    include: {
      consumable: {
        select: {
          name: true,
          consumableType: {
            select: {
              family: { select: { name: true } },
            },
          },
          unitOfMeasure: { select: { symbol: true } },
        },
      },
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rows: StockMovementRow[] = movements.map(m => ({
    fecha: formatDate(m.createdAt),
    consumible: m.consumable.name,
    familia: m.consumable.consumableType?.family?.name ?? '—',
    tipo: m.type === 'ENTRY' ? 'Entrada' : m.type === 'EXIT' ? 'Salida' : 'Ajuste',
    cantidad: m.quantity,
    unidad: m.consumable.unitOfMeasure?.symbol ?? '',
    motivo: m.reason ?? '—',
    usuario: m.user.name ?? '—',
  }))

  const totalEntradas = movements
    .filter(m => m.type === 'ENTRY')
    .reduce((s, m) => s + m.quantity, 0)
  const totalSalidas = movements
    .filter(m => m.type === 'EXIT')
    .reduce((s, m) => s + m.quantity, 0)
  const uniqueConsumables = new Set(movements.map(m => m.consumableId)).size

  const summary = [
    {
      title: 'Total de movimientos',
      value: movements.length,
      description: `${movements.filter(m => m.type === 'ENTRY').length} entradas, ${movements.filter(m => m.type === 'EXIT').length} salidas`,
    },
    {
      title: 'Unidades consumidas (salidas)',
      value: totalSalidas,
      description: `vs ${totalEntradas} unidades ingresadas`,
    },
    {
      title: 'Materiales distintos movidos',
      value: uniqueConsumables,
      description: 'Número de materiales MRO con al menos un movimiento',
    },
  ]

  return {
    summary,
    data: rows,
    filters: {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      consumableId: consumableId ?? null,
      type: type ?? null,
    },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── decommissioned ────────────────────────────────────────────────────────────

interface DecommissionedRow extends Record<string, unknown> {
  folio: string
  fechaBaja: string
  tipoActivo: string
  nombreActivo: string
  codigoActivo: string
  familia: string
  motivo: string
  solicitadoPor: string
  aprobadoPor: string
}

async function runDecommissionedTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<DecommissionedRow>> {
  const dateFrom = params.dateFrom || undefined
  const dateTo = params.dateTo || undefined
  const familyId = params.familyId || undefined
  const reason = params.reason || undefined
  const familyIds = familyIdsForQuery(scope)

  const where: Record<string, unknown> = {}

  if (dateFrom || dateTo) {
    where.approvedAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    }
  }

  const requestWhere: Record<string, unknown> = {}
  if (reason) {
    requestWhere.reason = { contains: reason, mode: 'insensitive' }
  }

  const equipFamilyWhere = buildEquipmentFamilyWhere(familyIds)
  const licFamilyWhere = buildLicenseFamilyWhere(familyIds)
  const orClauses: Record<string, unknown>[] = []
  if (Object.keys(equipFamilyWhere).length > 0) {
    orClauses.push({ equipment: equipFamilyWhere })
  }
  if (Object.keys(licFamilyWhere).length > 0) {
    orClauses.push({ license: licFamilyWhere })
  }
  if (orClauses.length > 0) {
    requestWhere.OR = orClauses
  }

  if (Object.keys(requestWhere).length > 0) {
    where.request = requestWhere
  }

  const acts = await prisma.decommission_acts.findMany({
    where,
    include: {
      request: {
        include: {
          equipment: {
            select: {
              code: true,
              brand: true,
              model: true,
              type: { select: { family: { select: { name: true } } } },
            },
          },
          license: {
            select: {
              name: true,
              licenseType: { select: { family: { select: { name: true } } } },
            },
          },
          requester: { select: { name: true } },
        },
      },
      approvedBy: { select: { name: true } },
    },
    orderBy: { approvedAt: 'desc' },
  })

  const rows: DecommissionedRow[] = acts.map(act => {
    const req = act.request
    const isEquipment = req.assetType === 'EQUIPMENT'
    const nombreActivo = isEquipment
      ? req.equipment
        ? `${req.equipment.brand} ${req.equipment.model}`
        : '—'
      : (req.license?.name ?? '—')
    const codigoActivo = isEquipment
      ? (req.equipment?.code ?? '—')
      : (req.licenseId?.slice(0, 8).toUpperCase() ?? '—')
    const familia = isEquipment
      ? (req.equipment?.type?.family?.name ?? '—')
      : (req.license?.licenseType?.family?.name ?? '—')

    return {
      folio: act.folio,
      fechaBaja: formatDate(act.approvedAt),
      tipoActivo: isEquipment ? 'Equipo' : 'Licencia/Contrato',
      nombreActivo,
      codigoActivo,
      familia,
      motivo: DECOMMISSION_REASON_ES[req.reason] ?? req.reason,
      solicitadoPor: req.requester.name ?? '—',
      aprobadoPor: act.approvedBy.name ?? '—',
    }
  })

  const totalBajas = rows.length
  const equiposBaja = rows.filter(r => r.tipoActivo === 'Equipo').length
  const motivoMasComun = (() => {
    const counts = new Map<string, number>()
    rows.forEach(r => counts.set(r.motivo, (counts.get(r.motivo) ?? 0) + 1))
    let max = 0
    let motivo = '—'
    counts.forEach((v, k) => {
      if (v > max) {
        max = v
        motivo = k
      }
    })
    return motivo
  })()

  const summary = [
    {
      title: 'Total de bajas',
      value: totalBajas,
      description: `${equiposBaja} equipos y ${totalBajas - equiposBaja} licencias/contratos dados de baja`,
    },
    {
      title: 'Equipos dados de baja',
      value: equiposBaja,
      description: 'Equipos físicos retirados del inventario',
    },
    {
      title: 'Motivo más frecuente',
      value: motivoMasComun,
      description: 'Causa principal de baja en el período',
    },
  ]

  return {
    summary,
    data: rows,
    filters: {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      familyId: familyId ?? null,
      reason: reason ?? null,
    },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── locations ───────────────────────────────────────────────────────────────

interface LocationRow extends Record<string, unknown> {
  equipmentCode: string
  equipmentName: string
  familia: string
  estado: string
  ubicacionFisica: string
  bodega: string
  usuarioAsignado: string
  departamento: string
  fechaAsignacion: string
}

async function runLocationsTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<LocationRow>> {
  const familyId = params.familyId || undefined
  const onlyWithLocation = params.onlyWithLocation === 'true'
  const familyIds = familyIdsForQuery(scope)

  const equipment = await (prisma.equipment.findMany as any)({
    where: {
      status: { not: 'RETIRED' },
      ...buildEquipmentFamilyWhere(familyIds),
      ...(onlyWithLocation ? { physicalLocation: { not: null } } : {}),
    },
    select: {
      code: true,
      brand: true,
      model: true,
      status: true,
      physicalLocation: true,
      warehouse: { select: { name: true } },
      type: { select: { family: { select: { name: true } } } },
      assignments: {
        where: { isActive: true },
        take: 1,
        select: {
          startDate: true,
          receiver: {
            select: {
              name: true,
              departments: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: [{ physicalLocation: 'asc' }, { code: 'asc' }],
  })

  const rows: LocationRow[] = equipment.map((e: any) => {
    const assignment = e.assignments[0]
    return {
      equipmentCode: e.code,
      equipmentName: `${e.brand} ${e.model}`,
      familia: e.type?.family?.name ?? '—',
      estado: EQUIPMENT_STATUS_ES[e.status] ?? e.status,
      ubicacionFisica: e.physicalLocation ?? '—',
      bodega: e.warehouse?.name ?? '—',
      usuarioAsignado: assignment?.receiver?.name ?? '—',
      departamento: (assignment?.receiver as any)?.departments?.name ?? '—',
      fechaAsignacion: assignment ? formatDate(assignment.startDate) : '—',
    }
  })

  const byLocation = rows.reduce<Record<string, number>>((acc, r) => {
    const loc = r.ubicacionFisica === '—' ? 'Sin ubicación registrada' : r.ubicacionFisica
    acc[loc] = (acc[loc] ?? 0) + 1
    return acc
  }, {})

  const topLocations = Object.entries(byLocation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([loc, count]) => `${loc} (${count})`)
    .join(', ')

  const conUbicacion = rows.filter(r => r.ubicacionFisica !== '—').length
  const sinUbicacion = rows.length - conUbicacion

  const summary = [
    {
      title: 'Total de equipos activos',
      value: rows.length,
      description: 'Equipos no retirados del inventario',
    },
    {
      title: 'Con ubicación registrada',
      value: conUbicacion,
      description: `${rows.length > 0 ? Math.round((conUbicacion / rows.length) * 100) : 0}% tienen ubicación física registrada`,
    },
    {
      title: 'Sin ubicación registrada',
      value: sinUbicacion,
      description: 'Equipos sin ubicación física definida',
    },
    {
      title: 'Ubicaciones más frecuentes',
      value: topLocations || '—',
      description: 'Top 5 ubicaciones con más equipos',
    },
  ]

  return {
    summary,
    data: rows,
    filters: { familyId: familyId ?? null, onlyWithLocation },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── sales ───────────────────────────────────────────────────────────────────

interface SalesRow extends Record<string, unknown> {
  codigo: string
  equipo: string
  tipo: string
  serie: string
  comprador: string
  empresa: string
  ruc: string
  precioVenta: string
  precioCompra: string
  valorLibro: string
  resultado: string
  fechaVenta: string
  formaPago: string
  factura: string
  estado: string
  solicitadoPor: string
  aprobadoPor: string
}

async function runSalesTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse<SalesRow>> {
  const dateFrom = params.dateFrom || undefined
  const dateTo = params.dateTo || undefined
  const status = params.status || undefined
  const familyId = params.familyId || undefined
  const familyIds = familyIdsForQuery(scope)

  const where: Record<string, unknown> = {}

  const equipmentFamilyWhere = buildEquipmentFamilyWhere(familyIds)
  if (Object.keys(equipmentFamilyWhere).length > 0) {
    where.equipment = equipmentFamilyWhere
  }

  if (status && status !== 'all') {
    where.status = status
  }

  if (dateFrom || dateTo) {
    where.saleDate = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {}),
    }
  }

  const sales = await prisma.equipment_sales.findMany({
    where,
    include: {
      equipment: {
        select: {
          code: true,
          brand: true,
          model: true,
          serialNumber: true,
          purchasePrice: true,
          purchaseDate: true,
          usefulLifeYears: true,
          residualValue: true,
          type: { select: { name: true } },
        },
      },
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
    },
    orderBy: { saleDate: 'desc' },
  })

  const rows: SalesRow[] = sales.map(s => {
    const bookValue = calcBookValue(
      s.equipment.purchasePrice,
      s.equipment.purchaseDate,
      s.equipment.usefulLifeYears,
      s.equipment.residualValue,
      s.saleDate
    )
    const profit = bookValue !== null ? s.salePrice - bookValue : null

    return {
      codigo: s.equipment.code,
      equipo: `${s.equipment.brand} ${s.equipment.model}`,
      tipo: s.equipment.type.name,
      serie: s.equipment.serialNumber,
      comprador: s.buyerName,
      empresa: s.buyerCompany ?? '—',
      ruc: s.buyerIdNumber ?? '—',
      precioVenta: fmtCurrency(s.salePrice),
      precioCompra: fmtCurrency(s.equipment.purchasePrice),
      valorLibro: fmtCurrency(bookValue),
      resultado:
        profit !== null ? (profit >= 0 ? `+${fmtCurrency(profit)}` : fmtCurrency(profit)) : '—',
      fechaVenta: formatDate(s.saleDate),
      formaPago: s.paymentMethod ? (PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod) : '—',
      factura: s.invoiceNumber ?? '—',
      estado: SALES_STATUS_LABELS[s.status] ?? s.status,
      solicitadoPor: s.requestedBy.name,
      aprobadoPor: s.approvedBy?.name ?? '—',
    }
  })

  const approved = sales.filter(s => s.status === 'APPROVED')
  const totalRevenue = approved.reduce((sum, s) => sum + s.salePrice, 0)
  const totalProfit = approved.reduce((sum, s) => {
    const bv = calcBookValue(
      s.equipment.purchasePrice,
      s.equipment.purchaseDate,
      s.equipment.usefulLifeYears,
      s.equipment.residualValue,
      s.saleDate
    )
    return bv !== null ? sum + (s.salePrice - bv) : sum
  }, 0)

  const summary = [
    {
      title: 'Ventas aprobadas',
      value: approved.length,
      description: `${sales.filter(s => s.status === 'PENDING').length} pendientes de aprobación`,
    },
    {
      title: 'Ingresos por ventas',
      value: fmtCurrency(totalRevenue),
      description: 'Total recaudado en ventas aprobadas',
    },
    {
      title: 'Resultado financiero',
      value: fmtCurrency(totalProfit),
      description: totalProfit >= 0 ? 'Ganancia vs valor libro' : 'Pérdida vs valor libro',
    },
  ]

  return {
    summary,
    data: rows,
    filters: {
      dateFrom: dateFrom ?? null,
      dateTo: dateTo ?? null,
      status: status ?? null,
      familyId: familyId ?? null,
    },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── financial-summary ───────────────────────────────────────────────────────

interface FinancialRow extends Record<string, unknown> {
  familia: string
  equiposActivos: number
  valorEquipos: string
  costoRentaMensual: string
  costoRentaAnual: string
  licencias: number
  valorLicencias: string
  materiales: number
  valorMateriales: string
  costoMantenimiento: string
  valorTotal: string
}

async function runFinancialSummaryTemplate(
  params: Record<string, string>,
  sessionUser?: { role: string; isSuperAdmin?: boolean }
): Promise<ReportResponse<FinancialRow>> {
  const isSuperAdmin = sessionUser?.isSuperAdmin === true
  if (sessionUser?.role !== 'ADMIN' || !isSuperAdmin) {
    throw new Error('Solo el Super Administrador puede ver el resumen financiero global')
  }

  const familyId = params.familyId || undefined

  const familiesWhere = familyId ? { id: familyId } : {}
  const families = await prisma.families.findMany({
    where: familiesWhere,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const rows: FinancialRow[] = []

  for (const family of families) {
    const [equipmentStats, licenseStats, consumableStats, maintenanceStats] = await Promise.all([
      prisma.equipment.aggregate({
        where: {
          type: { familyId: family.id },
          status: { not: 'RETIRED' },
        },
        _count: true,
        _sum: { purchasePrice: true, rentalMonthlyCost: true },
      }),
      prisma.software_licenses.aggregate({
        where: { licenseType: { familyId: family.id } },
        _count: true,
        _sum: { cost: true },
      }),
      prisma.consumables.aggregate({
        where: { consumableType: { familyId: family.id } },
        _count: true,
        _sum: { costPerUnit: true },
      }),
      prisma.maintenance_records.aggregate({
        where: {
          equipment: { type: { familyId: family.id } },
          status: 'COMPLETED',
        },
        _sum: { cost: true },
      }),
    ])

    const rentalMensual = equipmentStats._sum.rentalMonthlyCost ?? 0
    const valorEquipos = equipmentStats._sum.purchasePrice ?? 0
    const valorLicencias = licenseStats._sum.cost ?? 0
    const valorMateriales = consumableStats._sum.costPerUnit ?? 0
    const costoMant = maintenanceStats._sum.cost ?? 0
    const valorTotal = valorEquipos + valorLicencias + valorMateriales

    rows.push({
      familia: family.name,
      equiposActivos: equipmentStats._count,
      valorEquipos: formatCurrency(valorEquipos),
      costoRentaMensual: formatCurrency(rentalMensual),
      costoRentaAnual: formatCurrency(rentalMensual * 12),
      licencias: licenseStats._count,
      valorLicencias: formatCurrency(valorLicencias),
      materiales: consumableStats._count,
      valorMateriales: formatCurrency(valorMateriales),
      costoMantenimiento: formatCurrency(costoMant),
      valorTotal: formatCurrency(valorTotal),
    })
  }

  const [globalEquipment, globalLicenses, globalConsumables, globalMaintenance] = await Promise.all([
    prisma.equipment.aggregate({
      where: { status: { not: 'RETIRED' } },
      _count: true,
      _sum: { purchasePrice: true, rentalMonthlyCost: true },
    }),
    prisma.software_licenses.aggregate({
      _count: true,
      _sum: { cost: true },
    }),
    prisma.consumables.aggregate({
      _count: true,
      _sum: { costPerUnit: true },
    }),
    prisma.maintenance_records.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { cost: true },
    }),
  ])

  const totalValorActivos =
    (globalEquipment._sum.purchasePrice ?? 0) +
    (globalLicenses._sum.cost ?? 0) +
    (globalConsumables._sum.costPerUnit ?? 0)

  const totalRentaMensual = globalEquipment._sum.rentalMonthlyCost ?? 0

  const summary = [
    {
      title: 'Valor total del inventario',
      value: formatCurrency(totalValorActivos),
      description: `Equipos + licencias + materiales de ${families.length} familia${families.length !== 1 ? 's' : ''}`,
    },
    {
      title: 'Costo de renta mensual',
      value: formatCurrency(totalRentaMensual),
      description: `${formatCurrency(totalRentaMensual * 12)} anuales en equipos arrendados`,
    },
    {
      title: 'Costo total de mantenimientos',
      value: formatCurrency(globalMaintenance._sum.cost ?? 0),
      description: 'Suma de todos los mantenimientos completados',
    },
  ]

  return {
    summary,
    data: rows,
    filters: { familyId: familyId ?? null },
    generatedAt: new Date().toISOString(),
    totalCount: rows.length,
  }
}

// ── by-model ────────────────────────────────────────────────────────────────

async function runByModelTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const reportType = params.reportType || 'inventory'
  const modelId = params.modelId || undefined
  const dateFrom = params.dateFrom || undefined
  const dateTo = params.dateTo || undefined
  const familyIds = familyIdsForQuery(scope)

  if (reportType === 'maintenance') {
    const raw = await InventoryReportService.getMaintenanceByModel({
      familyIds,
      modelId,
      startDate: dateFrom ? new Date(dateFrom) : undefined,
      endDate: dateTo ? new Date(dateTo) : undefined,
    })

    const data = raw.map(row => ({
      modelo: `${row.brand} ${row.model}`.trim(),
      mantenimientos: row.totalMaintenances,
      costoTotal: formatCurrency(row.totalCost),
      costoPromedio: formatCurrency(row.avgCost),
    }))

    const totalMaint = raw.reduce((s, r) => s + r.totalMaintenances, 0)
    const totalCost = raw.reduce((s, r) => s + r.totalCost, 0)

    return {
      summary: [
        {
          title: 'Modelos con mantenimiento',
          value: data.length,
          description: 'Modelos distintos con al menos un registro',
        },
        {
          title: 'Total mantenimientos',
          value: totalMaint,
          description: 'Registros en el período seleccionado',
        },
        {
          title: 'Costo total',
          value: formatCurrency(totalCost),
          description: 'Suma de costos de mantenimiento',
        },
      ],
      data,
      filters: templateFilters('by-model', params),
      generatedAt: new Date().toISOString(),
      totalCount: data.length,
    }
  }

  const raw = await InventoryReportService.getEquipmentByModel({
    familyIds,
    modelId,
  })

  const data = raw.map(row => ({
    modelo: `${row.brand} ${row.model}`.trim(),
    tipo: row.type,
    sku: row.sku ?? '—',
    total: row.total,
    disponibles: row.available,
    asignados: row.assigned,
    mantenimiento: row.maintenance,
    retirados: row.retired,
    valorTotal: formatCurrency(row.totalValue),
    enRenta: row.rentalCount,
    rentaMensual: formatCurrency(row.rentalMonthlyCost),
  }))

  const totalEquipos = raw.reduce((s, r) => s + r.total, 0)
  const totalValor = raw.reduce((s, r) => s + r.totalValue, 0)

  return {
    summary: [
      {
        title: 'Modelos en inventario',
        value: data.length,
        description: 'Modelos con al menos un equipo activo',
      },
      {
        title: 'Total equipos',
        value: totalEquipos,
        description: 'Suma de instancias en todos los modelos',
      },
      {
        title: 'Valor total',
        value: formatCurrency(totalValor),
        description: 'Suma de precios de compra',
      },
    ],
    data,
    filters: templateFilters('by-model', params),
    generatedAt: new Date().toISOString(),
    totalCount: data.length,
  }
}

// ── by-batch ────────────────────────────────────────────────────────────────

async function runByBatchTemplate(
  params: Record<string, string>,
  scope: ReportScopeContext
): Promise<ReportResponse> {
  const batchId = params.batchId || undefined
  const supplierId = params.supplierId || undefined
  const familyIds = familyIdsForQuery(scope)

  const raw = await InventoryReportService.getEquipmentByBatch({
    familyIds,
    batchId,
    supplierId,
  })

  const data = raw.map(row => ({
    lote: row.batchCode,
    modelo: row.model,
    proveedor: row.supplier,
    cantidadLote: row.quantity,
    equiposRegistrados: row.equipmentCount,
    disponibles: row.available,
    asignados: row.assigned,
    mantenimiento: row.maintenance,
    retirados: row.retired,
    precioUnitario: formatCurrency(row.unitPrice),
    precioTotal: formatCurrency(row.totalPrice),
    fechaCompra: row.purchaseDate ? formatDate(row.purchaseDate) : '—',
  }))

  const totalEquipos = raw.reduce((s, r) => s + r.equipmentCount, 0)
  const totalValor = raw.reduce((s, r) => s + (r.totalPrice ?? 0), 0)

  return {
    summary: [
      {
        title: 'Lotes',
        value: data.length,
        description: 'Lotes de compra con equipos en scope',
      },
      {
        title: 'Equipos registrados',
        value: totalEquipos,
        description: 'Instancias vinculadas a lotes',
      },
      {
        title: 'Valor total lotes',
        value: formatCurrency(totalValor),
        description: 'Suma de precios totales de compra',
      },
    ],
    data,
    filters: templateFilters('by-batch', params),
    generatedAt: new Date().toISOString(),
    totalCount: data.length,
  }
}

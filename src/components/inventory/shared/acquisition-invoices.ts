/**
 * Tipos, endpoints y helpers compartidos por todo lo que lee o escribe
 * facturas/pagos de adquisición de Equipos y Licencias — usado por
 * `AcquisitionInvoicesCard` (ficha del activo), `AcquisitionInvoiceFormDialog`
 * y `AcquisitionPaymentDialog` (los dos modales reutilizables), y por la
 * pestaña "Activos" de /inventory/payments.
 *
 * Vive en un solo lugar a propósito: antes había dos implementaciones del
 * mismo par de modales (una en la ficha del activo, otra reescrita a mano en
 * /inventory/payments) que fueron divergiendo con el tiempo — mismo campo,
 * distinto comportamiento según por dónde entrabas. Un solo tipo y un solo
 * mapa de endpoints hace imposible que eso vuelva a pasar.
 */

import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react'

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'PARTIALLY_PAID'
export type AcquisitionAssetType = 'equipment' | 'license'

export interface InvoiceInstallment {
  id: string
  amount: number
  paidDate: string
  paymentMethod?: string | null
  referenceNumber?: string | null
  bankEntity?: string | null
  cardLast4?: string | null
  cardBrand?: string | null
  transactionId?: string | null
  notes?: string | null
  createdAt: string
  creator?: { id: string; name: string } | null
}

export interface AcquisitionInvoice {
  id: string
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  amount: number
  currency: string
  dueDate?: string | null
  paidDate?: string | null
  status: InvoiceStatus
  paymentMethod?: string | null
  supplierId?: string | null
  supplierName?: string | null
  referenceNumber?: string | null
  bankEntity?: string | null
  cardLast4?: string | null
  cardBrand?: string | null
  transactionId?: string | null
  notes?: string | null
  createdAt: string
  supplier?: { id: string; name: string } | null
  creator?: { id: string; name: string } | null
  /** Suma de abonos registrados — ver installments. Calculado en el servidor. */
  paidAmount: number
  installments: InvoiceInstallment[]
  /** Plan de cuotas: presente cuando esta factura es una cuota "hermana" de
   * otras (ver scheduleGroupId en el servicio) — ausente en pago único. */
  installmentNumber?: number | null
  installmentCount?: number | null
  /** Id compartido por todas las cuotas "hermanas" de un mismo plan — usado
   * en el listado para agruparlas bajo una sola fila colapsable en vez de
   * mostrar cada cuota suelta. */
  scheduleGroupId?: string | null
  /** Contexto del activo — presente cuando el modal se abre desde una lista
   * agregada (Pagos) que no tiene el activo como contexto implícito. */
  equipment?: {
    id: string
    code: string
    brand: string
    modelDeprecated: string
    model?: { model: string } | null
  } | null
  license?: {
    id: string
    name: string
  } | null
}

// ── Endpoints por tipo de activo ────────────────────────────────────────────

export const ACQUISITION_INVOICE_API: Record<
  AcquisitionAssetType,
  {
    list: (assetId: string) => string
    item: (invoiceId: string) => string
    installmentItem: (installmentId: string) => string
    /** Reemplaza una factura de pago único (sin abonos) por un plan de
     * cuotas que hereda su proveedor/moneda/N° factura/OC/notas. */
    convertToSchedule: (invoiceId: string) => string
  }
> = {
  equipment: {
    list: assetId => `/api/inventory/equipment/${assetId}/invoices`,
    item: invoiceId => `/api/inventory/equipment/invoices/${invoiceId}`,
    installmentItem: installmentId =>
      `/api/inventory/equipment/invoices/installments/${installmentId}`,
    convertToSchedule: invoiceId =>
      `/api/inventory/equipment/invoices/${invoiceId}/convert-to-schedule`,
  },
  license: {
    list: assetId => `/api/inventory/licenses/${assetId}/invoices`,
    item: invoiceId => `/api/inventory/licenses/invoices/${invoiceId}`,
    installmentItem: installmentId =>
      `/api/inventory/licenses/invoices/installments/${installmentId}`,
    convertToSchedule: invoiceId =>
      `/api/inventory/licenses/invoices/${invoiceId}/convert-to-schedule`,
  },
}

// ── Helpers de presentación ─────────────────────────────────────────────────

export const ACQUISITION_STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ElementType
    className?: string
  }
> = {
  PENDING: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  PAID: { label: 'Pagado', variant: 'default', icon: CheckCircle2 },
  OVERDUE: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
  CANCELLED: { label: 'Cancelado', variant: 'outline', icon: XCircle },
  PARTIALLY_PAID: {
    label: 'Parcial',
    variant: 'outline',
    icon: Clock,
    className:
      'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40',
  },
}

export function fmtAcquisitionCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function fmtAcquisitionDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function todayISO() {
  return new Date().toISOString().split('T')[0]
}

/** Etiqueta corta del activo dueño de la factura, cuando viene con contexto
 * (equipment/license poblados) — usado por modales abiertos desde una lista
 * agregada como Pagos, donde el activo no es evidente por el resto de la
 * pantalla. */
export function acquisitionAssetLabel(inv: Pick<AcquisitionInvoice, 'equipment' | 'license'>) {
  if (inv.license) return inv.license.name
  if (inv.equipment) {
    const model = inv.equipment.model?.model ?? inv.equipment.modelDeprecated
    return `${inv.equipment.code} — ${inv.equipment.brand} ${model}`.trim()
  }
  return null
}

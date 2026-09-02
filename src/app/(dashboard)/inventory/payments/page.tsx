'use client'

/**
 * /inventory/payments
 *
 * Dos pestañas:
 *  · Contratos — cuotas de arrendamiento/suscripciones (contract_payments)
 *  · Activos   — facturas de adquisición de equipos (equipment_invoices)
 *
 * Features por pestaña:
 *  ✓ Stats KPIs (total, pendiente, vencido, pagado, monto)
 *  ✓ Filtros: estado, área/familia, búsqueda, rango de fechas
 *  ✓ Ordenamiento por columna (useTableSort)
 *  ✓ Paginación cliente (usePagination)
 *  ✓ Exportación CSV / Excel / PDF (useExport)
 *  ✓ Toolbar estándar (ListTableToolbar)
 *  ✓ Dialog de "registrar pago" con método de pago
 *  ✓ Scope de familias por rol
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  Receipt,
  Wallet,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Undo2,
  Plus,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CurrencySelect } from '@/components/ui/currency-select'
import { DateInput } from '@/components/ui/date-input'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { useFetch } from '@/hooks/common/use-fetch'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import { useInventoryPermissions } from '@/hooks/use-inventory-permissions'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PaymentInstallment = {
  id: string
  amount: number
  paidDate: string
  paymentMethod?: string | null
  referenceNumber?: string | null
  notes?: string | null
  createdAt: string
}

type ContractPayment = {
  id: string
  amount: number
  currency: string
  dueDate: string
  paidDate?: string | null
  status: string
  paymentMethod?: string | null
  referenceNumber?: string | null
  notes?: string | null
  createdAt: string
  /** Suma de abonos registrados — calculado en el servidor. */
  paidAmount: number
  installments: PaymentInstallment[]
  contract: {
    id: string
    name: string
    contractNumber?: string | null
    billingCycle?: string | null
    supplier?: { name: string } | null
    family?: { id: string; name: string; color?: string | null } | null
  }
  creator?: { id: string; name: string } | null
}

type AssetInvoice = {
  id: string
  assetKind: 'EQUIPMENT' | 'LICENSE'
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  amount: number
  currency: string
  dueDate?: string | null
  paidDate?: string | null
  status: string
  paymentMethod?: string | null
  supplierName?: string | null
  notes?: string | null
  createdAt: string
  /** Suma de abonos registrados — calculado en el servidor. */
  paidAmount: number
  installments: PaymentInstallment[]
  /** Plan de cuotas: presente cuando esta factura es una cuota "hermana" de
   * otras (ver scheduleGroupId en el servicio) — ausente en pago único. */
  installmentNumber?: number | null
  installmentCount?: number | null
  equipment?: {
    id: string
    code: string
    brand: string
    modelDeprecated: string
    model?: { model: string } | null
    type?: {
      name: string
      family?: { id: string; name: string; color?: string | null } | null
    } | null
  }
  license?: {
    id: string
    name: string
    licenseType?: {
      name: string
      family?: { id: string; name: string; color?: string | null } | null
    } | null
  }
  supplier?: { id: string; name: string } | null
  creator?: { id: string; name: string } | null
}

/** Info de despliegue del activo (equipo o licencia) unificada para la tabla/export/dialog. */
function assetDisplay(inv: AssetInvoice) {
  if (inv.assetKind === 'LICENSE' && inv.license) {
    return {
      code: inv.license.name,
      subtitle: '',
      typeName: inv.license.licenseType?.name ?? null,
      family: inv.license.licenseType?.family ?? null,
      href: `/inventory/license/${inv.license.id}`,
    }
  }
  const eq = inv.equipment
  return {
    code: eq?.code ?? '—',
    subtitle: `${eq?.brand ?? ''} ${eq?.model?.model ?? eq?.modelDeprecated ?? ''}`.trim(),
    typeName: eq?.type?.name ?? null,
    family: eq?.type?.family ?? null,
    href: eq ? `/inventory/equipment/${eq.id}` : '#',
  }
}

// ── Constantes y helpers ──────────────────────────────────────────────────────

const CONTRACT_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'OVERDUE', label: 'Vencidos' },
  { value: 'DUE', label: 'Vence hoy' },
  { value: 'PARTIALLY_PAID', label: 'Parcial' },
  { value: 'SCHEDULED', label: 'Programados' },
  { value: 'PAID', label: 'Pagados' },
  { value: 'CANCELLED', label: 'Cancelados' },
]

const ASSET_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos los estados' },
  { value: 'OVERDUE', label: 'Vencidos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'PARTIALLY_PAID', label: 'Parcial' },
  { value: 'PAID', label: 'Pagados' },
  { value: 'CANCELLED', label: 'Cancelados' },
]

const PARTIALLY_PAID_BADGE_CLS =
  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40'

const CONTRACT_STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ElementType
    className?: string
  }
> = {
  SCHEDULED: { label: 'Programado', variant: 'secondary', icon: Clock },
  DUE: { label: 'Vence hoy', variant: 'default', icon: AlertCircle },
  OVERDUE: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
  PAID: { label: 'Pagado', variant: 'default', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelado', variant: 'outline', icon: XCircle },
  PARTIALLY_PAID: {
    label: 'Parcial',
    variant: 'outline',
    icon: Clock,
    className: PARTIALLY_PAID_BADGE_CLS,
  },
}

const ASSET_STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ElementType
    className?: string
  }
> = {
  PENDING: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  OVERDUE: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
  PAID: { label: 'Pagado', variant: 'default', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelado', variant: 'outline', icon: XCircle },
  PARTIALLY_PAID: {
    label: 'Parcial',
    variant: 'outline',
    icon: Clock,
    className: PARTIALLY_PAID_BADGE_CLS,
  },
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtCurrency(n: number, currency = 'USD') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(n)
}

/** Suma `amount` agrupado por `currency` — evita mezclar montos de distinta moneda en un solo total. */
function sumByCurrency<T extends { amount: number; currency: string }>(
  items: T[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const it of items) out[it.currency] = (out[it.currency] ?? 0) + it.amount
  return out
}

/** Un total por cada moneda presente, ej. "US$800 + $50.000 CLP" — nunca un solo número mezclado. */
function fmtMultiCurrency(sums: Record<string, number>): string {
  const entries = Object.entries(sums).filter(([, v]) => v !== 0)
  if (entries.length === 0) return fmtCurrency(0)
  return entries.map(([cur, amt]) => fmtCurrency(amt, cur)).join(' + ')
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function StatusBadge({ status, cfg }: { status: string; cfg: typeof CONTRACT_STATUS_CONFIG }) {
  const c = cfg[status] ?? { label: status, variant: 'secondary' as const, icon: Clock }
  const Icon = c.icon
  return (
    <Badge variant={c.variant} className={`gap-1 text-xs whitespace-nowrap ${c.className ?? ''}`}>
      <Icon className='h-3 w-3' />
      {c.label}
    </Badge>
  )
}

// ── Sub-componente: stats KPI ─────────────────────────────────────────────────

function StatsRow({
  items,
  isCurrency = false,
}: {
  items: { label: string; value: string | number; cls: string }[]
  isCurrency?: boolean
}) {
  return (
    <div className='grid grid-cols-2 sm:grid-cols-5 gap-2'>
      {items.map(item => (
        <div key={item.label} className='rounded-lg border bg-muted/30 px-3 py-2.5 text-center'>
          <p className={`text-xl font-bold tabular-nums ${item.cls}`}>{item.value}</p>
          <p className='text-xs text-muted-foreground mt-0.5'>{item.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Sub-componente: controles de paginación ───────────────────────────────────

function PaginationBar({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalItems,
  prevPage,
  nextPage,
  hasPrevPage,
  hasNextPage,
}: {
  currentPage: number
  totalPages: number
  startIndex: number
  endIndex: number
  totalItems: number
  prevPage: () => void
  nextPage: () => void
  hasPrevPage: boolean
  hasNextPage: boolean
}) {
  if (totalPages <= 1) return null
  return (
    <div className='flex items-center justify-between pt-2 text-sm text-muted-foreground'>
      <span>
        {startIndex}–{endIndex} de {totalItems}
      </span>
      <div className='flex items-center gap-1'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={prevPage}
          disabled={!hasPrevPage}
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>
        <span className='px-2'>
          {currentPage} / {totalPages}
        </span>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={nextPage}
          disabled={!hasNextPage}
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
      </div>
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

type Section = 'contracts' | 'assets'

export default function InventoryPaymentsPage() {
  const { canManageContracts } = useInventoryPermissions()
  const { families } = useFamilyOptions()

  // ── Sección activa
  const [section, setSection] = useState<Section>('assets')

  // ── Filtros contratos
  const [cStatus, setCStatus] = useState('ALL')
  const [cFamily, setCFamily] = useState('all')
  const [cSearch, setCSearch] = useState('')
  const [cFromDate, setCFromDate] = useState('')
  const [cToDate, setCToDate] = useState('')

  // ── Filtros activos
  const [aStatus, setAStatus] = useState('ALL')
  const [aFamily, setAFamily] = useState('all')
  const [aSearch, setASearch] = useState('')
  const [aFromDate, setAFromDate] = useState('')
  const [aToDate, setAToDate] = useState('')

  // ── Dialogs — pago de contrato
  const [markingContract, setMarkingContract] = useState<ContractPayment | null>(null)
  const [cPaidDate, setCPaidDate] = useState(todayISO())
  const [cPaidMethod, setCPaidMethod] = useState<string>('')
  const [cPaidRef, setCPaidRef] = useState('')
  const [cPayAmount, setCPayAmount] = useState('')
  const [savingC, setSavingC] = useState(false)

  // ── Dialogs — pago de activo
  const [markingAsset, setMarkingAsset] = useState<AssetInvoice | null>(null)
  const [aPaidDate, setAPaidDate] = useState(todayISO())
  const [aPaidMethod, setAPaidMethod] = useState<string>('')
  const [aPaidRef, setAPaidRef] = useState('')
  const [aPayAmount, setAPayAmount] = useState('')
  const [savingA, setSavingA] = useState(false)

  // ── Dialogs — eliminar / deshacer abono
  const [deletingContract, setDeletingContract] = useState<ContractPayment | null>(null)
  const [deletingAsset, setDeletingAsset] = useState<AssetInvoice | null>(null)
  const [undoingContractInstallment, setUndoingContractInstallment] =
    useState<PaymentInstallment | null>(null)
  const [undoingAssetInstallment, setUndoingAssetInstallment] = useState<PaymentInstallment | null>(
    null
  )

  // ── Dialog — nueva factura de activo (crear sin salir de Pagos) ───────────
  // Pago único solamente — el plan de cuotas irregulares sigue viviendo en la
  // ficha del propio equipo/licencia (AcquisitionInvoicesCard), que ya lo
  // soporta con el mismo backend; acá se cubre el caso más común: registrar
  // una factura nueva sin tener que navegar hasta el activo primero.
  const [showNewInvoice, setShowNewInvoice] = useState(false)
  const [niQuery, setNiQuery] = useState('')
  const [niResults, setNiResults] = useState<
    { id: string; kind: 'equipment' | 'license'; label: string }[]
  >([])
  const [niSearching, setNiSearching] = useState(false)
  const [niAsset, setNiAsset] = useState<{
    id: string
    kind: 'equipment' | 'license'
    label: string
  } | null>(null)
  const [niForm, setNiForm] = useState({
    invoiceNumber: '',
    purchaseOrderNumber: '',
    amount: '',
    currency: 'USD',
    dueDate: '',
    supplierId: '',
    supplierName: '',
    notes: '',
  })
  const [niSaving, setNiSaving] = useState(false)

  useEffect(() => {
    if (!showNewInvoice || niAsset) return
    const q = niQuery.trim()
    if (q.length < 2) {
      setNiResults([])
      return
    }
    const t = setTimeout(async () => {
      setNiSearching(true)
      try {
        const res = await fetch(`/api/inventory/assets?search=${encodeURIComponent(q)}&pageSize=15`)
        const json = await res.json()
        const items = (json.items ?? []).filter(
          (i: { subtype: string }) => i.subtype === 'EQUIPMENT' || i.subtype === 'LICENSE'
        )
        setNiResults(
          items.map((i: { id: string; subtype: string; code?: string; name: string }) => ({
            id: i.id,
            kind: i.subtype === 'LICENSE' ? ('license' as const) : ('equipment' as const),
            label: i.code ? `${i.code} — ${i.name}` : i.name,
          }))
        )
      } catch {
        setNiResults([])
      } finally {
        setNiSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [niQuery, showNewInvoice, niAsset])

  async function selectNewInvoiceAsset(item: {
    id: string
    kind: 'equipment' | 'license'
    label: string
  }) {
    setNiAsset(item)
    setNiQuery(item.label)
    setNiResults([])
    // Proveedor pre-llenado desde el activo — mismo criterio que
    // AcquisitionInvoicesCard (Parte 3a); si falla, el campo queda vacío y
    // no bloquea el flujo.
    try {
      if (item.kind === 'equipment') {
        const res = await fetch(`/api/inventory/equipment/${item.id}`)
        const json = await res.json()
        setNiForm(f => ({
          ...f,
          supplierId: json.equipment?.supplierId ?? '',
          supplierName: json.equipment?.supplier?.name ?? '',
        }))
      } else {
        const res = await fetch(`/api/inventory/licenses/${item.id}`)
        const json = await res.json()
        setNiForm(f => ({
          ...f,
          supplierId: json.supplier?.id ?? '',
          supplierName: json.supplier?.name ?? '',
        }))
      }
    } catch {
      // proveedor queda vacío — no bloquea el registro de la factura
    }
  }

  function closeNewInvoiceDialog() {
    setShowNewInvoice(false)
    setNiAsset(null)
    setNiQuery('')
    setNiResults([])
    setNiForm({
      invoiceNumber: '',
      purchaseOrderNumber: '',
      amount: '',
      currency: 'USD',
      dueDate: '',
      supplierId: '',
      supplierName: '',
      notes: '',
    })
  }

  async function handleCreateNewInvoice() {
    if (!niAsset) {
      toast({ title: 'Elige un equipo o licencia', variant: 'destructive' })
      return
    }
    if (!niForm.amount || Number(niForm.amount) <= 0) {
      toast({ title: 'El monto debe ser mayor a 0', variant: 'destructive' })
      return
    }
    setNiSaving(true)
    try {
      const base =
        niAsset.kind === 'license' ? '/api/inventory/licenses' : '/api/inventory/equipment'
      const res = await fetch(`${base}/${niAsset.id}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: niForm.invoiceNumber || null,
          purchaseOrderNumber: niForm.purchaseOrderNumber || null,
          amount: Number(niForm.amount),
          currency: niForm.currency || 'USD',
          dueDate: niForm.dueDate || null,
          supplierId: niForm.supplierId || null,
          supplierName: niForm.supplierName || null,
          notes: niForm.notes || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar')
      toast({ title: 'Factura registrada' })
      closeNewInvoiceDialog()
      reloadA()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setNiSaving(false)
    }
  }

  // ── Dialog — nuevo pago de contrato (crear sin salir de Pagos) ────────────
  // Cuota ad hoc — complementa "Generar pagos" (ciclo completo, en la ficha
  // del contrato) para el caso de una cuota suelta (cargo extra, corrección).
  const [showNewPayment, setShowNewPayment] = useState(false)
  const [npQuery, setNpQuery] = useState('')
  const [npResults, setNpResults] = useState<{ id: string; label: string }[]>([])
  const [npContract, setNpContract] = useState<{ id: string; label: string } | null>(null)
  const [npForm, setNpForm] = useState({
    amount: '',
    currency: 'USD',
    dueDate: '',
    paymentMethod: '',
    referenceNumber: '',
    notes: '',
  })
  const [npSaving, setNpSaving] = useState(false)

  useEffect(() => {
    if (!showNewPayment || npContract) return
    const q = npQuery.trim()
    if (q.length < 2) {
      setNpResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/inventory/contracts?search=${encodeURIComponent(q)}&pageSize=15`
        )
        const json = await res.json()
        setNpResults(
          (json.contracts ?? []).map(
            (c: { id: string; name: string; contractNumber?: string }) => ({
              id: c.id,
              label: c.contractNumber ? `${c.contractNumber} — ${c.name}` : c.name,
            })
          )
        )
      } catch {
        setNpResults([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [npQuery, showNewPayment, npContract])

  function closeNewPaymentDialog() {
    setShowNewPayment(false)
    setNpContract(null)
    setNpQuery('')
    setNpResults([])
    setNpForm({
      amount: '',
      currency: 'USD',
      dueDate: '',
      paymentMethod: '',
      referenceNumber: '',
      notes: '',
    })
  }

  async function handleCreateNewPayment() {
    if (!npContract) {
      toast({ title: 'Elige un contrato', variant: 'destructive' })
      return
    }
    if (!npForm.amount || Number(npForm.amount) <= 0) {
      toast({ title: 'El monto debe ser mayor a 0', variant: 'destructive' })
      return
    }
    if (!npForm.dueDate) {
      toast({ title: 'La fecha de vencimiento es obligatoria', variant: 'destructive' })
      return
    }
    setNpSaving(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${npContract.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(npForm.amount),
          currency: npForm.currency || 'USD',
          dueDate: npForm.dueDate,
          paymentMethod: npForm.paymentMethod || undefined,
          referenceNumber: npForm.referenceNumber || undefined,
          notes: npForm.notes || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar')
      toast({ title: 'Cuota registrada' })
      closeNewPaymentDialog()
      reloadC()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setNpSaving(false)
    }
  }

  // ── Fetch contratos
  const buildContractUrl = useCallback(() => {
    const p = new URLSearchParams({ pageSize: '500' })
    if (cStatus !== 'ALL') p.set('status', cStatus)
    if (cFamily !== 'all') p.set('familyId', cFamily)
    if (cSearch.trim()) p.set('search', cSearch.trim())
    if (cFromDate) p.set('fromDate', cFromDate)
    if (cToDate) p.set('toDate', cToDate)
    return `/api/inventory/payments?${p}`
  }, [cStatus, cFamily, cSearch, cFromDate, cToDate])

  const {
    data: contractPayments,
    loading: loadingC,
    reload: reloadC,
  } = useFetch<ContractPayment>(buildContractUrl(), {
    transform: d => d.payments ?? [],
    // Ambas pestañas se cargan siempre (no solo la activa) — si no, el
    // contador de la pestaña inactiva se queda en 0 hasta hacer clic en
    // ella, dando la falsa impresión de que no hay nada ahí.
    enabled: canManageContracts,
  })

  // ── Fetch activos
  const buildAssetUrl = useCallback(() => {
    const p = new URLSearchParams({ pageSize: '500' })
    if (aStatus !== 'ALL') p.set('status', aStatus)
    if (aFamily !== 'all') p.set('familyId', aFamily)
    if (aSearch.trim()) p.set('search', aSearch.trim())
    if (aFromDate) p.set('fromDate', aFromDate)
    if (aToDate) p.set('toDate', aToDate)
    return `/api/inventory/equipment-payments?${p}`
  }, [aStatus, aFamily, aSearch, aFromDate, aToDate])

  const {
    data: assetInvoices,
    loading: loadingA,
    reload: reloadA,
  } = useFetch<AssetInvoice>(buildAssetUrl(), {
    transform: d => d.invoices ?? [],
    enabled: canManageContracts,
  })

  // ── Filtro cliente: tipo de activo (Activos) ───────────────────────────────
  // Client-side sobre lo ya cargado (igual que las 500 filas se paginan del
  // lado del cliente) — evita otro roundtrip solo para separar Equipos de
  // Licencias, que la pestaña ya trae mezcladas.
  const [aAssetKind, setAAssetKind] = useState<'ALL' | 'EQUIPMENT' | 'LICENSE'>('ALL')
  const filteredAssetInvoices =
    aAssetKind === 'ALL' ? assetInvoices : assetInvoices.filter(i => i.assetKind === aAssetKind)

  // ── Ordenamiento contratos
  const {
    sortedData: sortedContracts,
    requestSort: reqSortC,
    getSortIcon: iconC,
  } = useTableSort<ContractPayment>(contractPayments, { key: 'dueDate', direction: 'asc' })

  // ── Ordenamiento activos
  const {
    sortedData: sortedAssets,
    requestSort: reqSortA,
    getSortIcon: iconA,
  } = useTableSort<AssetInvoice>(filteredAssetInvoices, { key: 'dueDate', direction: 'asc' })

  // ── Paginación contratos
  const {
    paginatedData: pageC,
    currentPage: pgC,
    totalPages: tpgC,
    startIndex: startC,
    endIndex: endC,
    totalItems: totalC,
    nextPage: nextC,
    prevPage: prevC,
    hasPrevPage: hasPrevC,
    hasNextPage: hasNextC,
  } = usePagination(sortedContracts, { pageSize: 50 })

  // ── Paginación activos
  const {
    paginatedData: pageA,
    currentPage: pgA,
    totalPages: tpgA,
    startIndex: startA,
    endIndex: endA,
    totalItems: totalA,
    nextPage: nextA,
    prevPage: prevA,
    hasPrevPage: hasPrevA,
    hasNextPage: hasNextA,
  } = usePagination(sortedAssets, { pageSize: 50 })

  // ── Exportación contratos
  const {
    exportCSV: expCCSV,
    exportExcel: expCXLSX,
    exportPDF: expCPDF,
    exporting: expCLoading,
  } = useExport({
    filename: 'pagos-contratos',
    title: 'Pagos de Contratos',
    getData: () => sortedContracts,
    columns: [
      { key: 'dueDate', label: 'Vencimiento', format: v => fmtDate(v) },
      { key: 'contract', label: 'Contrato', format: v => v?.name ?? '' },
      { key: 'contract', label: 'N° Contrato', format: v => v?.contractNumber ?? '' },
      { key: 'contract', label: 'Proveedor', format: v => v?.supplier?.name ?? '' },
      { key: 'contract', label: 'Área', format: v => v?.family?.name ?? '' },
      { key: 'contract', label: 'Ciclo', format: v => v?.billingCycle ?? '' },
      { key: 'amount', label: 'Monto', format: (v, row) => fmtCurrency(Number(v), row.currency) },
      {
        key: 'paidAmount',
        label: 'Abonado',
        format: (v, row) => fmtCurrency(Number(v ?? 0), row.currency),
      },
      {
        key: 'amount',
        label: 'Saldo',
        format: (v, row) => fmtCurrency(Number(v) - (row.paidAmount ?? 0), row.currency),
      },
      { key: 'currency', label: 'Moneda' },
      { key: 'status', label: 'Estado', format: v => CONTRACT_STATUS_CONFIG[v]?.label ?? v },
      { key: 'paidDate', label: 'Fecha pago', format: v => fmtDate(v) },
      {
        key: 'paymentMethod',
        label: 'Método pago',
        format: v => (v ? (PAYMENT_METHOD_TYPE_LABELS[v as PaymentMethodType] ?? v) : ''),
      },
      { key: 'referenceNumber', label: 'Referencia', format: v => v ?? '' },
    ],
  })

  // ── Exportación activos
  const {
    exportCSV: expACSV,
    exportExcel: expAXLSX,
    exportPDF: expAPDF,
    exporting: expALoading,
  } = useExport({
    filename: 'facturas-activos',
    title: 'Facturas de Adquisición de Activos',
    getData: () => sortedAssets,
    columns: [
      {
        key: 'assetKind',
        label: 'Tipo de activo',
        format: v => (v === 'LICENSE' ? 'Licencia' : 'Equipo'),
      },
      { key: 'equipment', label: 'Código / Nombre', format: (_v, row) => assetDisplay(row).code },
      { key: 'equipment', label: 'Detalle', format: (_v, row) => assetDisplay(row).subtitle },
      { key: 'equipment', label: 'Tipo', format: (_v, row) => assetDisplay(row).typeName ?? '' },
      {
        key: 'equipment',
        label: 'Área',
        format: (_v, row) => assetDisplay(row).family?.name ?? '',
      },
      { key: 'invoiceNumber', label: 'N° Factura', format: v => v ?? '' },
      { key: 'purchaseOrderNumber', label: 'N° OC', format: v => v ?? '' },
      {
        key: 'installmentCount',
        label: 'Cuota',
        format: (v, row) => (v ? `${row.installmentNumber}/${v}` : ''),
      },
      { key: 'amount', label: 'Monto', format: (v, row) => fmtCurrency(Number(v), row.currency) },
      {
        key: 'paidAmount',
        label: 'Abonado',
        format: (v, row) => fmtCurrency(Number(v ?? 0), row.currency),
      },
      {
        key: 'amount',
        label: 'Saldo',
        format: (v, row) => fmtCurrency(Number(v) - (row.paidAmount ?? 0), row.currency),
      },
      { key: 'currency', label: 'Moneda' },
      { key: 'dueDate', label: 'Vencimiento', format: v => fmtDate(v) },
      { key: 'status', label: 'Estado', format: v => ASSET_STATUS_CONFIG[v]?.label ?? v },
      { key: 'paidDate', label: 'Fecha pago', format: v => fmtDate(v) },
      {
        key: 'paymentMethod',
        label: 'Método pago',
        format: v => (v ? (PAYMENT_METHOD_TYPE_LABELS[v as PaymentMethodType] ?? v) : ''),
      },
      {
        key: 'supplier',
        label: 'Proveedor',
        format: (v, row) => v?.name ?? row.supplierName ?? '',
      },
    ],
  })

  // ── Stats contratos
  const cStats = {
    total: contractPayments.length,
    overdue: contractPayments.filter(p => p.status === 'OVERDUE').length,
    due: contractPayments.filter(p => p.status === 'DUE').length,
    pending: contractPayments.filter(p => p.status === 'SCHEDULED').length,
    paid: contractPayments.filter(p => p.status === 'PAID').length,
    // Un total por moneda — sumar montos de monedas distintas en un solo
    // número no tiene sentido y antes mostraba el resultado con la etiqueta
    // de la primera moneda cargada, que podía ser cualquiera. Se suma el
    // SALDO (amount - paidAmount), no el monto completo — si no, una cuota
    // PARTIALLY_PAID se contaría dos veces (una acá con su monto completo,
    // otra en lo ya abonado).
    pendingLabel: fmtMultiCurrency(
      sumByCurrency(
        contractPayments
          .filter(p => ['SCHEDULED', 'DUE', 'OVERDUE', 'PARTIALLY_PAID'].includes(p.status))
          .map(p => ({ currency: p.currency, amount: p.amount - p.paidAmount }))
      )
    ),
  }

  // ── Stats activos
  const aStats = {
    total: filteredAssetInvoices.length,
    overdue: filteredAssetInvoices.filter(i => i.status === 'OVERDUE').length,
    pending: filteredAssetInvoices.filter(i => i.status === 'PENDING').length,
    paid: filteredAssetInvoices.filter(i => i.status === 'PAID').length,
    pendingLabel: fmtMultiCurrency(
      sumByCurrency(
        filteredAssetInvoices
          .filter(i => ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'].includes(i.status))
          .map(i => ({ currency: i.currency, amount: i.amount - i.paidAmount }))
      )
    ),
  }

  // ── Acción: registrar pago (completo o parcial) de contrato
  const markContractPaid = async () => {
    if (!markingContract) return
    setSavingC(true)
    try {
      const res = await fetch(
        `/api/inventory/contracts/payments/${markingContract.id}/installments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: cPayAmount ? Number(cPayAmount) : undefined,
            paidDate: cPaidDate,
            paymentMethod: cPaidMethod || 'BANK_TRANSFER',
            referenceNumber: cPaidRef || undefined,
          }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar')
      toast({ title: 'Pago registrado correctamente' })
      setMarkingContract(null)
      reloadC()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setSavingC(false)
    }
  }

  // ── Acción: registrar pago (completo o parcial) de factura de activo
  const markAssetPaid = async () => {
    if (!markingAsset) return
    setSavingA(true)
    try {
      const base =
        markingAsset.assetKind === 'LICENSE'
          ? '/api/inventory/licenses/invoices'
          : '/api/inventory/equipment/invoices'
      const res = await fetch(`${base}/${markingAsset.id}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: aPayAmount ? Number(aPayAmount) : undefined,
          paidDate: aPaidDate,
          paymentMethod: aPaidMethod || undefined,
          referenceNumber: aPaidRef || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar')
      toast({ title: 'Pago registrado correctamente' })
      setMarkingAsset(null)
      reloadA()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setSavingA(false)
    }
  }

  // ── Acción: deshacer un abono (contrato o activo) ─────────────────────────
  // Los abonos son inmutables: corregir = deshacer + volver a registrar. Se
  // cierra el diálogo de "Registrar pago" al deshacer, igual que al pagar —
  // el usuario lo vuelve a abrir con el saldo ya recalculado.

  const handleUndoContractInstallment = async () => {
    if (!undoingContractInstallment) return
    setSavingC(true)
    try {
      const res = await fetch(
        `/api/inventory/contracts/payments/installments/${undoingContractInstallment.id}`,
        { method: 'DELETE' }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo deshacer el abono')
      toast({ title: 'Abono deshecho' })
      setUndoingContractInstallment(null)
      setMarkingContract(null)
      reloadC()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setSavingC(false)
    }
  }

  const handleUndoAssetInstallment = async () => {
    if (!undoingAssetInstallment || !markingAsset) return
    setSavingA(true)
    try {
      const base =
        markingAsset.assetKind === 'LICENSE'
          ? '/api/inventory/licenses/invoices'
          : '/api/inventory/equipment/invoices'
      const res = await fetch(`${base}/installments/${undoingAssetInstallment.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo deshacer el abono')
      toast({ title: 'Abono deshecho' })
      setUndoingAssetInstallment(null)
      setMarkingAsset(null)
      reloadA()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setSavingA(false)
    }
  }

  // ── Acción: eliminar cuota de contrato / factura de activo ────────────────
  // El backend ya rechaza si tiene abonos — el botón se deshabilita antes de
  // intentarlo (ver guard en la fila de la tabla) para no depender de un
  // error tras confirmar.

  const deleteContractPayment = async () => {
    if (!deletingContract) return
    setSavingC(true)
    try {
      const res = await fetch(`/api/inventory/contracts/payments/${deletingContract.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo eliminar')
      toast({ title: 'Cuota eliminada' })
      setDeletingContract(null)
      reloadC()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setSavingC(false)
    }
  }

  const deleteAssetInvoice = async () => {
    if (!deletingAsset) return
    setSavingA(true)
    try {
      const base =
        deletingAsset.assetKind === 'LICENSE'
          ? '/api/inventory/licenses/invoices'
          : '/api/inventory/equipment/invoices'
      const res = await fetch(`${base}/${deletingAsset.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo eliminar')
      toast({ title: 'Factura eliminada' })
      setDeletingAsset(null)
      reloadA()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setSavingA(false)
    }
  }

  // ── Guard de permisos
  if (!canManageContracts) {
    return (
      <ModuleLayout title='Pagos' subtitle='Acceso restringido.'>
        <p className='text-sm text-muted-foreground'>No tienes permiso para esta sección.</p>
      </ModuleLayout>
    )
  }

  const isContracts = section === 'contracts'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ModuleLayout
      title='Pagos'
      subtitle='Cuotas de contratos de renta y facturas de adquisición de activos.'
      loading={
        (isContracts ? loadingC : loadingA) &&
        (isContracts ? contractPayments.length === 0 : assetInvoices.length === 0)
      }
    >
      <div className='space-y-5'>
        {/* ── Selector de sección ─────────────────────────────────────── */}
        <div className='flex gap-0 border-b'>
          <button
            type='button'
            onClick={() => setSection('assets')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              !isContracts
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className='h-4 w-4' />
            Activos
            {aStats.total > 0 && (
              <Badge variant='secondary' className='text-xs ml-1'>
                {aStats.total}
              </Badge>
            )}
            {aStats.overdue > 0 && (
              <Badge variant='destructive' className='text-xs ml-0.5'>
                {aStats.overdue}
              </Badge>
            )}
          </button>
          <button
            type='button'
            onClick={() => setSection('contracts')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              isContracts
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wallet className='h-4 w-4' />
            Contratos
            {cStats.total > 0 && (
              <Badge variant='secondary' className='text-xs ml-1'>
                {cStats.total}
              </Badge>
            )}
            {cStats.overdue > 0 && (
              <Badge variant='destructive' className='text-xs ml-0.5'>
                {cStats.overdue}
              </Badge>
            )}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECCIÓN ACTIVOS
        ══════════════════════════════════════════════════════════════ */}
        {!isContracts && (
          <div className='space-y-4'>
            {/* Stats */}
            <StatsRow
              items={[
                { label: 'Total', value: aStats.total, cls: 'text-foreground' },
                { label: 'Vencidas', value: aStats.overdue, cls: 'text-red-600 dark:text-red-400' },
                {
                  label: 'Pendientes',
                  value: aStats.pending,
                  cls: 'text-amber-600 dark:text-amber-400',
                },
                { label: 'Pagadas', value: aStats.paid, cls: 'text-green-600 dark:text-green-400' },
                {
                  label: 'Pendiente ($)',
                  value: aStats.pendingLabel,
                  cls: 'text-orange-600 dark:text-orange-400 text-base',
                },
              ]}
            />

            {/* Toolbar */}
            <ListTableToolbar
              title={
                <p className='text-sm text-muted-foreground'>
                  {aStats.total} factura{aStats.total !== 1 ? 's' : ''}
                  {aAssetKind !== 'ALL'
                    ? ` · ${aAssetKind === 'EQUIPMENT' ? 'Equipos' : 'Licencias'}`
                    : ''}
                  {aStatus !== 'ALL'
                    ? ` · ${ASSET_STATUS_OPTIONS.find(o => o.value === aStatus)?.label}`
                    : ''}
                  {aFamily !== 'all'
                    ? ` · ${families.find(f => f.id === aFamily)?.name ?? ''}`
                    : ''}
                </p>
              }
              loading={loadingA}
              onRefresh={reloadA}
              showViewToggle={false}
              export={{
                onExportCSV: expACSV,
                onExportExcel: expAXLSX,
                onExportPDF: expAPDF,
                loading: expALoading,
                disabled: filteredAssetInvoices.length === 0,
              }}
              endActions={
                <Button type='button' size='sm' onClick={() => setShowNewInvoice(true)}>
                  <Plus className='h-3.5 w-3.5 mr-1.5' />
                  Nueva factura
                </Button>
              }
            />

            {/* Filtros */}
            <div className='flex flex-wrap gap-2'>
              <Input
                placeholder='Buscar código de equipo, marca o nombre de licencia…'
                value={aSearch}
                onChange={e => setASearch(e.target.value)}
                className='flex-1 min-w-[200px] max-w-xs'
              />
              <Select value={aStatus} onValueChange={setAStatus}>
                <SelectTrigger className='w-44'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={aAssetKind}
                onValueChange={v => setAAssetKind(v as 'ALL' | 'EQUIPMENT' | 'LICENSE')}
              >
                <SelectTrigger className='w-40'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='ALL'>Equipos y Licencias</SelectItem>
                  <SelectItem value='EQUIPMENT'>Solo Equipos</SelectItem>
                  <SelectItem value='LICENSE'>Solo Licencias</SelectItem>
                </SelectContent>
              </Select>
              {families.length > 1 && (
                <FamilyCombobox
                  families={families}
                  value={aFamily}
                  onValueChange={v => setAFamily(v || 'all')}
                  allowAll
                  allowClear
                  placeholder='Todas las áreas'
                  className='w-52'
                />
              )}
              <div className='flex items-center gap-1.5'>
                <DateInput
                  value={aFromDate}
                  onChange={e => setAFromDate(e.target.value)}
                  clearable
                  placeholder='Desde'
                  className='w-36'
                />
                <span className='text-muted-foreground text-xs'>–</span>
                <DateInput
                  value={aToDate}
                  onChange={e => setAToDate(e.target.value)}
                  clearable
                  placeholder='Hasta'
                  className='w-36'
                />
              </div>
            </div>

            {/* Tabla */}
            <div className='rounded-md border overflow-hidden'>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        sortKey='equipment.code'
                        currentSort={iconA('equipment.code')}
                        onSort={reqSortA}
                      >
                        Activo
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='equipment.type'
                        currentSort={iconA('equipment.type')}
                        onSort={reqSortA}
                        className='hidden lg:table-cell'
                      >
                        Tipo / Área
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='invoiceNumber'
                        currentSort={iconA('invoiceNumber')}
                        onSort={reqSortA}
                        className='hidden md:table-cell'
                      >
                        Factura / OC
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='supplierName'
                        currentSort={iconA('supplierName')}
                        onSort={reqSortA}
                        className='hidden md:table-cell'
                      >
                        Proveedor
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='amount'
                        currentSort={iconA('amount')}
                        onSort={reqSortA}
                        align='right'
                      >
                        Monto
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='dueDate'
                        currentSort={iconA('dueDate')}
                        onSort={reqSortA}
                      >
                        Vencimiento
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='status'
                        currentSort={iconA('status')}
                        onSort={reqSortA}
                      >
                        Estado
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='paidDate'
                        currentSort={iconA('paidDate')}
                        onSort={reqSortA}
                        className='hidden md:table-cell'
                      >
                        Fecha pago
                      </SortableTableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingA && assetInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className='text-center py-10 text-muted-foreground text-sm'
                        >
                          Cargando…
                        </TableCell>
                      </TableRow>
                    ) : pageA.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className='text-center py-10 text-muted-foreground text-sm'
                        >
                          <Receipt className='h-8 w-8 mx-auto mb-2 opacity-30' />
                          No hay facturas con los filtros seleccionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageA.map(inv => {
                        const supplierLabel = inv.supplier?.name ?? inv.supplierName ?? '—'
                        const asset = assetDisplay(inv)
                        return (
                          <TableRow key={inv.id} className='hover:bg-muted/30 transition-colors'>
                            <TableCell>
                              <div className='flex items-center gap-1.5'>
                                <Link
                                  href={asset.href}
                                  className='font-medium text-sm hover:underline font-mono'
                                >
                                  {asset.code}
                                </Link>
                                {inv.assetKind === 'LICENSE' && (
                                  <Badge variant='outline' className='text-[10px] px-1 py-0'>
                                    Licencia
                                  </Badge>
                                )}
                              </div>
                              {asset.subtitle && (
                                <span className='block text-xs text-muted-foreground'>
                                  {asset.subtitle}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className='hidden lg:table-cell'>
                              <span className='text-sm'>{asset.typeName ?? '—'}</span>
                              {asset.family && (
                                <span className='flex items-center gap-1 text-xs text-muted-foreground mt-0.5'>
                                  {asset.family.color && (
                                    <span
                                      className='h-2 w-2 rounded-full flex-shrink-0'
                                      style={{ backgroundColor: asset.family.color }}
                                    />
                                  )}
                                  {asset.family.name}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className='hidden md:table-cell'>
                              {inv.invoiceNumber ? (
                                <span className='font-mono text-xs font-medium'>
                                  {inv.invoiceNumber}
                                </span>
                              ) : (
                                <span className='text-muted-foreground text-xs'>—</span>
                              )}
                              {!!inv.installmentCount && (
                                <span className='block text-xs text-muted-foreground'>
                                  Cuota {inv.installmentNumber}/{inv.installmentCount}
                                </span>
                              )}
                              {inv.purchaseOrderNumber && (
                                <span className='block text-xs text-muted-foreground'>
                                  OC: {inv.purchaseOrderNumber}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className='hidden md:table-cell text-sm'>
                              {supplierLabel}
                            </TableCell>
                            <TableCell className='text-right font-medium whitespace-nowrap'>
                              {fmtCurrency(Number(inv.amount), inv.currency)}
                              {inv.paidAmount > 0 && inv.status !== 'PAID' && (
                                <span className='block text-xs font-normal text-muted-foreground'>
                                  Abonado: {fmtCurrency(inv.paidAmount, inv.currency)}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className='whitespace-nowrap font-mono text-xs'>
                              {inv.status === 'PAID' ? (
                                <span className='text-muted-foreground'>Pagado</span>
                              ) : (
                                fmtDate(inv.dueDate)
                              )}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={inv.status} cfg={ASSET_STATUS_CONFIG} />
                            </TableCell>
                            <TableCell className='hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap'>
                              {inv.status === 'PAID' ? fmtDate(inv.paidDate) : '—'}
                            </TableCell>
                            <TableCell className='text-right'>
                              <div className='flex items-center justify-end gap-1'>
                                {(inv.status === 'PENDING' ||
                                  inv.status === 'OVERDUE' ||
                                  inv.status === 'PARTIALLY_PAID') && (
                                  <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    className='h-7 text-xs'
                                    onClick={() => {
                                      setAPaidDate(todayISO())
                                      setAPaidMethod(inv.paymentMethod ?? '')
                                      setAPaidRef('')
                                      setAPayAmount((inv.amount - inv.paidAmount).toFixed(2))
                                      setMarkingAsset(inv)
                                    }}
                                  >
                                    <CheckCircle2 className='h-3.5 w-3.5 mr-1' />
                                    Pagar
                                  </Button>
                                )}
                                {inv.paidAmount > 0 && (
                                  <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    className='h-7 text-xs'
                                    title='Ver abonos registrados y agregar o deshacer uno'
                                    onClick={() => {
                                      setAPaidDate(todayISO())
                                      setAPaidMethod(inv.paymentMethod ?? '')
                                      setAPaidRef('')
                                      setAPayAmount((inv.amount - inv.paidAmount).toFixed(2))
                                      setMarkingAsset(inv)
                                    }}
                                  >
                                    <Receipt className='h-3.5 w-3.5 mr-1' />
                                    Abonos
                                  </Button>
                                )}
                                <button
                                  type='button'
                                  onClick={() => inv.paidAmount <= 0.01 && setDeletingAsset(inv)}
                                  disabled={inv.paidAmount > 0.01}
                                  className={`p-1 rounded transition-colors ${
                                    inv.paidAmount > 0.01
                                      ? 'text-muted-foreground/40 cursor-not-allowed'
                                      : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                                  }`}
                                  title={
                                    inv.paidAmount > 0.01
                                      ? 'Tiene abonos registrados — deshazlos primero para poder eliminarla'
                                      : 'Eliminar'
                                  }
                                >
                                  <Trash2 className='h-3.5 w-3.5' />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <PaginationBar
              currentPage={pgA}
              totalPages={tpgA}
              startIndex={startA}
              endIndex={endA}
              totalItems={totalA}
              prevPage={prevA}
              nextPage={nextA}
              hasPrevPage={hasPrevA}
              hasNextPage={hasNextA}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECCIÓN CONTRATOS
        ══════════════════════════════════════════════════════════════ */}
        {isContracts && (
          <div className='space-y-4'>
            {/* Stats */}
            <StatsRow
              items={[
                { label: 'Total', value: cStats.total, cls: 'text-foreground' },
                { label: 'Vencidos', value: cStats.overdue, cls: 'text-red-600 dark:text-red-400' },
                { label: 'Hoy', value: cStats.due, cls: 'text-amber-600 dark:text-amber-400' },
                {
                  label: 'Programados',
                  value: cStats.pending,
                  cls: 'text-blue-600 dark:text-blue-400',
                },
                {
                  label: 'Pendiente ($)',
                  value: cStats.pendingLabel,
                  cls: 'text-orange-600 dark:text-orange-400 text-base',
                },
              ]}
            />

            {/* Toolbar */}
            <ListTableToolbar
              title={
                <p className='text-sm text-muted-foreground'>
                  {cStats.total} cuota{cStats.total !== 1 ? 's' : ''}
                  {cStatus !== 'ALL'
                    ? ` · ${CONTRACT_STATUS_OPTIONS.find(o => o.value === cStatus)?.label}`
                    : ''}
                  {cFamily !== 'all'
                    ? ` · ${families.find(f => f.id === cFamily)?.name ?? ''}`
                    : ''}
                </p>
              }
              loading={loadingC}
              onRefresh={reloadC}
              showViewToggle={false}
              export={{
                onExportCSV: expCCSV,
                onExportExcel: expCXLSX,
                onExportPDF: expCPDF,
                loading: expCLoading,
                disabled: contractPayments.length === 0,
              }}
              endActions={
                <Button type='button' size='sm' onClick={() => setShowNewPayment(true)}>
                  <Plus className='h-3.5 w-3.5 mr-1.5' />
                  Nuevo pago
                </Button>
              }
            />

            {/* Filtros */}
            <div className='flex flex-wrap gap-2'>
              <Input
                placeholder='Buscar contrato, N° contrato o proveedor…'
                value={cSearch}
                onChange={e => setCSearch(e.target.value)}
                className='flex-1 min-w-[200px] max-w-xs'
              />
              <Select value={cStatus} onValueChange={setCStatus}>
                <SelectTrigger className='w-44'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {families.length > 1 && (
                <FamilyCombobox
                  families={families}
                  value={cFamily}
                  onValueChange={v => setCFamily(v || 'all')}
                  allowAll
                  allowClear
                  placeholder='Todas las áreas'
                  className='w-52'
                />
              )}
              <div className='flex items-center gap-1.5'>
                <DateInput
                  value={cFromDate}
                  onChange={e => setCFromDate(e.target.value)}
                  clearable
                  placeholder='Desde'
                  className='w-36'
                />
                <span className='text-muted-foreground text-xs'>–</span>
                <DateInput
                  value={cToDate}
                  onChange={e => setCToDate(e.target.value)}
                  clearable
                  placeholder='Hasta'
                  className='w-36'
                />
              </div>
            </div>

            {/* Tabla */}
            <div className='rounded-md border overflow-hidden'>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        sortKey='dueDate'
                        currentSort={iconC('dueDate')}
                        onSort={reqSortC}
                      >
                        Vencimiento
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='contract.name'
                        currentSort={iconC('contract.name')}
                        onSort={reqSortC}
                      >
                        Contrato
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='contract.supplier'
                        currentSort={iconC('contract.supplier')}
                        onSort={reqSortC}
                        className='hidden md:table-cell'
                      >
                        Proveedor
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='contract.family'
                        currentSort={iconC('contract.family')}
                        onSort={reqSortC}
                        className='hidden lg:table-cell'
                      >
                        Área
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='amount'
                        currentSort={iconC('amount')}
                        onSort={reqSortC}
                        align='right'
                      >
                        Monto
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='status'
                        currentSort={iconC('status')}
                        onSort={reqSortC}
                      >
                        Estado
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='paidDate'
                        currentSort={iconC('paidDate')}
                        onSort={reqSortC}
                        className='hidden md:table-cell'
                      >
                        Fecha pago
                      </SortableTableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingC && contractPayments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className='text-center py-10 text-muted-foreground text-sm'
                        >
                          Cargando…
                        </TableCell>
                      </TableRow>
                    ) : pageC.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className='text-center py-10 text-muted-foreground text-sm'
                        >
                          <Wallet className='h-8 w-8 mx-auto mb-2 opacity-30' />
                          No hay cuotas con los filtros seleccionados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageC.map(p => (
                        <TableRow key={p.id} className='hover:bg-muted/30 transition-colors'>
                          <TableCell className='whitespace-nowrap font-mono text-xs'>
                            {fmtDate(p.dueDate)}
                          </TableCell>
                          <TableCell>
                            <Link
                              href='/inventory/contracts'
                              className='font-medium text-sm hover:underline'
                            >
                              {p.contract.name}
                            </Link>
                            {p.contract.contractNumber && (
                              <span className='block text-xs text-muted-foreground'>
                                {p.contract.contractNumber}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className='hidden md:table-cell text-sm'>
                            {p.contract.supplier?.name ?? '—'}
                          </TableCell>
                          <TableCell className='hidden lg:table-cell'>
                            {p.contract.family && (
                              <span className='inline-flex items-center gap-1 text-xs'>
                                {p.contract.family.color && (
                                  <span
                                    className='h-2 w-2 rounded-full flex-shrink-0'
                                    style={{ backgroundColor: p.contract.family.color }}
                                  />
                                )}
                                {p.contract.family.name}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className='text-right font-medium whitespace-nowrap'>
                            {fmtCurrency(Number(p.amount), p.currency)}
                            {p.paidAmount > 0 && p.status !== 'PAID' && (
                              <span className='block text-xs font-normal text-muted-foreground'>
                                Abonado: {fmtCurrency(p.paidAmount, p.currency)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={p.status} cfg={CONTRACT_STATUS_CONFIG} />
                          </TableCell>
                          <TableCell className='hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap'>
                            {p.status === 'PAID' ? fmtDate(p.paidDate) : '—'}
                          </TableCell>
                          <TableCell className='text-right'>
                            <div className='flex items-center justify-end gap-1'>
                              {(p.status === 'SCHEDULED' ||
                                p.status === 'DUE' ||
                                p.status === 'OVERDUE' ||
                                p.status === 'PARTIALLY_PAID') && (
                                <Button
                                  type='button'
                                  size='sm'
                                  variant='outline'
                                  className='h-7 text-xs'
                                  onClick={() => {
                                    setCPaidDate(todayISO())
                                    setCPaidMethod('')
                                    setCPaidRef('')
                                    setCPayAmount((p.amount - p.paidAmount).toFixed(2))
                                    setMarkingContract(p)
                                  }}
                                >
                                  <CheckCircle2 className='h-3.5 w-3.5 mr-1' />
                                  Pagar
                                </Button>
                              )}
                              {p.paidAmount > 0 && (
                                <Button
                                  type='button'
                                  size='sm'
                                  variant='outline'
                                  className='h-7 text-xs'
                                  title='Ver abonos registrados y agregar o deshacer uno'
                                  onClick={() => {
                                    setCPaidDate(todayISO())
                                    setCPaidMethod('')
                                    setCPaidRef('')
                                    setCPayAmount((p.amount - p.paidAmount).toFixed(2))
                                    setMarkingContract(p)
                                  }}
                                >
                                  <Receipt className='h-3.5 w-3.5 mr-1' />
                                  Abonos
                                </Button>
                              )}
                              <button
                                type='button'
                                onClick={() => p.paidAmount <= 0.01 && setDeletingContract(p)}
                                disabled={p.paidAmount > 0.01}
                                className={`p-1 rounded transition-colors ${
                                  p.paidAmount > 0.01
                                    ? 'text-muted-foreground/40 cursor-not-allowed'
                                    : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                                }`}
                                title={
                                  p.paidAmount > 0.01
                                    ? 'Tiene abonos registrados — deshazlos primero para poder eliminarla'
                                    : 'Eliminar'
                                }
                              >
                                <Trash2 className='h-3.5 w-3.5' />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <PaginationBar
              currentPage={pgC}
              totalPages={tpgC}
              startIndex={startC}
              endIndex={endC}
              totalItems={totalC}
              prevPage={prevC}
              nextPage={nextC}
              hasPrevPage={hasPrevC}
              hasNextPage={hasNextC}
            />
          </div>
        )}
      </div>

      {/* ── Dialog: marcar pago de contrato ──────────────────────────────────── */}
      <Dialog open={!!markingContract} onOpenChange={open => !open && setMarkingContract(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Wallet className='h-4 w-4' />
              {markingContract?.status === 'PAID'
                ? 'Abonos registrados'
                : 'Registrar pago de cuota'}
            </DialogTitle>
          </DialogHeader>
          {markingContract && (
            <div className='space-y-4 py-1'>
              <div className='rounded-md bg-muted/50 px-3 py-2 text-sm space-y-0.5'>
                <p className='font-medium'>{markingContract.contract.name}</p>
                <p className='text-muted-foreground text-xs'>
                  {fmtDate(markingContract.dueDate)} · Monto total:{' '}
                  {fmtCurrency(Number(markingContract.amount), markingContract.currency)}
                </p>
                {markingContract.paidAmount > 0 && (
                  <p className='text-muted-foreground text-xs'>
                    Abonado: {fmtCurrency(markingContract.paidAmount, markingContract.currency)}
                  </p>
                )}
                <p className='font-semibold'>
                  Saldo pendiente:{' '}
                  {fmtCurrency(
                    markingContract.amount - markingContract.paidAmount,
                    markingContract.currency
                  )}
                </p>
              </div>

              {markingContract.installments.length > 0 && (
                <div className='space-y-1'>
                  <Label className='text-xs text-muted-foreground'>
                    Abonos anteriores ({markingContract.installments.length})
                  </Label>
                  <ul className='rounded-md border divide-y text-xs max-h-24 overflow-y-auto'>
                    {markingContract.installments.map(ins => (
                      <li key={ins.id} className='flex items-center justify-between px-2 py-1'>
                        <span className='text-muted-foreground'>{fmtDate(ins.paidDate)}</span>
                        <span className='font-medium'>
                          {fmtCurrency(ins.amount, markingContract.currency)}
                        </span>
                        <button
                          type='button'
                          onClick={() => setUndoingContractInstallment(ins)}
                          className='p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors'
                          title='Deshacer este abono'
                        >
                          <Undo2 className='h-3 w-3' />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {markingContract.status !== 'PAID' && (
                <>
                  <div className='space-y-1.5'>
                    <Label>Monto a abonar</Label>
                    <Input
                      type='number'
                      min='0.01'
                      step='0.01'
                      max={markingContract.amount - markingContract.paidAmount}
                      value={cPayAmount}
                      onChange={e => setCPayAmount(e.target.value)}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Deja el monto completo para saldar, o redúcelo para abonar parcialmente.
                    </p>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Fecha de pago</Label>
                    <DateInput value={cPaidDate} onChange={e => setCPaidDate(e.target.value)} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Método de pago</Label>
                    <Select
                      value={cPaidMethod || '__none__'}
                      onValueChange={v => setCPaidMethod(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar método' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__none__'>Sin especificar</SelectItem>
                        {(
                          Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [
                            PaymentMethodType,
                            string,
                          ][]
                        ).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>
                      N° Referencia / Transacción{' '}
                      <span className='text-muted-foreground'>(opcional)</span>
                    </Label>
                    <Input
                      placeholder='REF-12345'
                      value={cPaidRef}
                      onChange={e => setCPaidRef(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Para detalles adicionales (tarjeta, banco) edita la cuota desde el contrato.
                  </p>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {markingContract?.status === 'PAID' ? (
              <Button type='button' variant='outline' onClick={() => setMarkingContract(null)}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button type='button' variant='outline' onClick={() => setMarkingContract(null)}>
                  Cancelar
                </Button>
                <Button type='button' onClick={markContractPaid} disabled={savingC}>
                  {savingC
                    ? 'Guardando…'
                    : markingContract &&
                        Number(cPayAmount) >=
                          markingContract.amount - markingContract.paidAmount - 0.01
                      ? 'Confirmar pago'
                      : 'Registrar abono'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: marcar pago de factura de activo ─────────────────────────── */}
      <Dialog open={!!markingAsset} onOpenChange={open => !open && setMarkingAsset(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Package className='h-4 w-4' />
              {markingAsset?.status === 'PAID' ? 'Abonos registrados' : 'Registrar pago de factura'}
            </DialogTitle>
          </DialogHeader>
          {markingAsset && (
            <div className='space-y-4 py-1'>
              <div className='rounded-md bg-muted/50 px-3 py-2 text-sm space-y-0.5'>
                <p className='font-medium font-mono'>{assetDisplay(markingAsset).code}</p>
                <p className='text-muted-foreground text-xs'>
                  {assetDisplay(markingAsset).subtitle}
                  {markingAsset.invoiceNumber ? ` · ${markingAsset.invoiceNumber}` : ''}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Monto total: {fmtCurrency(Number(markingAsset.amount), markingAsset.currency)}
                </p>
                {markingAsset.paidAmount > 0 && (
                  <p className='text-muted-foreground text-xs'>
                    Abonado: {fmtCurrency(markingAsset.paidAmount, markingAsset.currency)}
                  </p>
                )}
                <p className='font-semibold'>
                  Saldo pendiente:{' '}
                  {fmtCurrency(
                    markingAsset.amount - markingAsset.paidAmount,
                    markingAsset.currency
                  )}
                </p>
              </div>

              {markingAsset.installments.length > 0 && (
                <div className='space-y-1'>
                  <Label className='text-xs text-muted-foreground'>
                    Abonos anteriores ({markingAsset.installments.length})
                  </Label>
                  <ul className='rounded-md border divide-y text-xs max-h-24 overflow-y-auto'>
                    {markingAsset.installments.map(ins => (
                      <li key={ins.id} className='flex items-center justify-between px-2 py-1'>
                        <span className='text-muted-foreground'>{fmtDate(ins.paidDate)}</span>
                        <span className='font-medium'>
                          {fmtCurrency(ins.amount, markingAsset.currency)}
                        </span>
                        <button
                          type='button'
                          onClick={() => setUndoingAssetInstallment(ins)}
                          className='p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors'
                          title='Deshacer este abono'
                        >
                          <Undo2 className='h-3 w-3' />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {markingAsset.status !== 'PAID' && (
                <>
                  <div className='space-y-1.5'>
                    <Label>Monto a abonar</Label>
                    <Input
                      type='number'
                      min='0.01'
                      step='0.01'
                      max={markingAsset.amount - markingAsset.paidAmount}
                      value={aPayAmount}
                      onChange={e => setAPayAmount(e.target.value)}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Deja el monto completo para saldar, o redúcelo para abonar parcialmente.
                    </p>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Fecha de pago</Label>
                    <DateInput value={aPaidDate} onChange={e => setAPaidDate(e.target.value)} />
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Método de pago</Label>
                    <Select
                      value={aPaidMethod || '__none__'}
                      onValueChange={v => setAPaidMethod(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar método' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='__none__'>Sin especificar</SelectItem>
                        {(
                          Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [
                            PaymentMethodType,
                            string,
                          ][]
                        ).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>
                      N° Referencia <span className='text-muted-foreground'>(opcional)</span>
                    </Label>
                    <Input
                      placeholder='REF-12345'
                      value={aPaidRef}
                      onChange={e => setAPaidRef(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {markingAsset?.status === 'PAID' ? (
              <Button type='button' variant='outline' onClick={() => setMarkingAsset(null)}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button type='button' variant='outline' onClick={() => setMarkingAsset(null)}>
                  Cancelar
                </Button>
                <Button type='button' onClick={markAssetPaid} disabled={savingA}>
                  {savingA
                    ? 'Guardando…'
                    : markingAsset &&
                        Number(aPayAmount) >= markingAsset.amount - markingAsset.paidAmount - 0.01
                      ? 'Confirmar pago'
                      : 'Registrar abono'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: nueva factura de activo (sin salir de Pagos) ──────────── */}
      <Dialog open={showNewInvoice} onOpenChange={open => !open && closeNewInvoiceDialog()}>
        <DialogContent className='w-[min(95vw,32rem)] max-w-lg max-h-[92vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Nueva factura de activo</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-1'>
            <div className='space-y-1'>
              <Label>
                Equipo o licencia <span className='text-destructive'>*</span>
              </Label>
              <Input
                placeholder='Buscar por código, marca o nombre…'
                value={niQuery}
                onChange={e => {
                  setNiQuery(e.target.value)
                  setNiAsset(null)
                }}
              />
              {niSearching && <p className='text-xs text-muted-foreground'>Buscando…</p>}
              {!niAsset && niResults.length > 0 && (
                <ul className='rounded-md border divide-y max-h-40 overflow-y-auto text-sm'>
                  {niResults.map(item => (
                    <li key={`${item.kind}-${item.id}`}>
                      <button
                        type='button'
                        onClick={() => selectNewInvoiceAsset(item)}
                        className='w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center justify-between gap-2'
                      >
                        <span>{item.label}</span>
                        <Badge variant='secondary' className='text-xs shrink-0'>
                          {item.kind === 'license' ? 'Licencia' : 'Equipo'}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {niAsset && (
                <p className='text-xs text-muted-foreground'>
                  Activo seleccionado — {niAsset.kind === 'license' ? 'Licencia' : 'Equipo'}
                  {niForm.supplierName && ` · Proveedor: ${niForm.supplierName}`}
                </p>
              )}
            </div>

            <div className='grid grid-cols-3 gap-3'>
              <div className='col-span-2 space-y-1'>
                <Label>
                  Monto <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='number'
                  min='0.01'
                  step='0.01'
                  placeholder='0.00'
                  value={niForm.amount}
                  onChange={e => setNiForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label>Moneda</Label>
                <CurrencySelect
                  value={niForm.currency}
                  onChange={v => setNiForm(f => ({ ...f, currency: v }))}
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label>N° Factura</Label>
                <Input
                  placeholder='FAC-001'
                  value={niForm.invoiceNumber}
                  onChange={e => setNiForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  maxLength={100}
                />
              </div>
              <div className='space-y-1'>
                <Label>N° Orden de Compra</Label>
                <Input
                  placeholder='OC-001'
                  value={niForm.purchaseOrderNumber}
                  onChange={e => setNiForm(f => ({ ...f, purchaseOrderNumber: e.target.value }))}
                  maxLength={100}
                />
              </div>
            </div>

            <div className='space-y-1'>
              <Label>Fecha de vencimiento</Label>
              <DateInput
                value={niForm.dueDate}
                onChange={e => setNiForm(f => ({ ...f, dueDate: e.target.value }))}
                clearable
              />
            </div>

            <div className='space-y-1'>
              <Label>Notas</Label>
              <Textarea
                rows={2}
                placeholder='Observaciones opcionales…'
                value={niForm.notes}
                onChange={e => setNiForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <p className='text-xs text-muted-foreground'>
              Pago único. Para un plan de cuotas irregulares, registrá la factura desde la ficha del
              equipo o la licencia.
            </p>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={closeNewInvoiceDialog}>
              Cancelar
            </Button>
            <Button type='button' onClick={handleCreateNewInvoice} disabled={niSaving}>
              {niSaving ? 'Guardando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: nuevo pago de contrato (sin salir de Pagos) ───────────── */}
      <Dialog open={showNewPayment} onOpenChange={open => !open && closeNewPaymentDialog()}>
        <DialogContent className='w-[min(95vw,32rem)] max-w-lg max-h-[92vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Nuevo pago de contrato</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-1'>
            <div className='space-y-1'>
              <Label>
                Contrato <span className='text-destructive'>*</span>
              </Label>
              <Input
                placeholder='Buscar por nombre o N° de contrato…'
                value={npQuery}
                onChange={e => {
                  setNpQuery(e.target.value)
                  setNpContract(null)
                }}
              />
              {!npContract && npResults.length > 0 && (
                <ul className='rounded-md border divide-y max-h-40 overflow-y-auto text-sm'>
                  {npResults.map(item => (
                    <li key={item.id}>
                      <button
                        type='button'
                        onClick={() => {
                          setNpContract(item)
                          setNpQuery(item.label)
                          setNpResults([])
                        }}
                        className='w-full text-left px-3 py-1.5 hover:bg-muted transition-colors'
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className='grid grid-cols-3 gap-3'>
              <div className='col-span-2 space-y-1'>
                <Label>
                  Monto <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='number'
                  min='0.01'
                  step='0.01'
                  placeholder='0.00'
                  value={npForm.amount}
                  onChange={e => setNpForm(f => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className='space-y-1'>
                <Label>Moneda</Label>
                <CurrencySelect
                  value={npForm.currency}
                  onChange={v => setNpForm(f => ({ ...f, currency: v }))}
                />
              </div>
            </div>

            <div className='space-y-1'>
              <Label>
                Fecha de vencimiento <span className='text-destructive'>*</span>
              </Label>
              <DateInput
                value={npForm.dueDate}
                onChange={e => setNpForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>

            <div className='space-y-1'>
              <Label>Método de pago</Label>
              <Select
                value={npForm.paymentMethod || '__none__'}
                onValueChange={v =>
                  setNpForm(f => ({ ...f, paymentMethod: v === '__none__' ? '' : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder='Seleccionar método' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin especificar</SelectItem>
                  {(
                    Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [PaymentMethodType, string][]
                  ).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label>N° Referencia</Label>
              <Input
                placeholder='REF-12345'
                value={npForm.referenceNumber}
                onChange={e => setNpForm(f => ({ ...f, referenceNumber: e.target.value }))}
                maxLength={200}
              />
            </div>

            <div className='space-y-1'>
              <Label>Notas</Label>
              <Textarea
                rows={2}
                placeholder='Observaciones opcionales…'
                value={npForm.notes}
                onChange={e => setNpForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <p className='text-xs text-muted-foreground'>
              Cuota suelta (cargo extra, corrección). Para generar el ciclo completo de cuotas de un
              contrato, usa &ldquo;Generar pagos&rdquo; en la ficha del contrato.
            </p>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={closeNewPaymentDialog}>
              Cancelar
            </Button>
            <Button type='button' onClick={handleCreateNewPayment} disabled={npSaving}>
              {npSaving ? 'Guardando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: confirmar deshacer abono de contrato ────────────── */}
      <AlertDialog
        open={!!undoingContractInstallment}
        onOpenChange={open => !open && setUndoingContractInstallment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer este abono?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoingContractInstallment &&
                `Se eliminará el abono de ${fmtCurrency(undoingContractInstallment.amount, markingContract?.currency)} del ${fmtDate(undoingContractInstallment.paidDate)}. El saldo y el estado de la cuota se recalculan al instante.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingC}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUndoContractInstallment}
              disabled={savingC}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {savingC ? 'Deshaciendo…' : 'Deshacer abono'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: confirmar deshacer abono de activo ──────────────── */}
      <AlertDialog
        open={!!undoingAssetInstallment}
        onOpenChange={open => !open && setUndoingAssetInstallment(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer este abono?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoingAssetInstallment &&
                `Se eliminará el abono de ${fmtCurrency(undoingAssetInstallment.amount, markingAsset?.currency)} del ${fmtDate(undoingAssetInstallment.paidDate)}. El saldo y el estado de la factura se recalculan al instante.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingA}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUndoAssetInstallment}
              disabled={savingA}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {savingA ? 'Deshaciendo…' : 'Deshacer abono'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: confirmar eliminar cuota de contrato ────────────── */}
      <AlertDialog
        open={!!deletingContract}
        onOpenChange={open => !open && setDeletingContract(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cuota?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingContract &&
                `Se eliminará la cuota de ${deletingContract.contract.name} por ${fmtCurrency(deletingContract.amount, deletingContract.currency)}. Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingC}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteContractPayment}
              disabled={savingC}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {savingC ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── AlertDialog: confirmar eliminar factura de activo ────────────── */}
      <AlertDialog open={!!deletingAsset} onOpenChange={open => !open && setDeletingAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingAsset &&
                (deletingAsset.invoiceNumber
                  ? `Se eliminará la factura ${deletingAsset.invoiceNumber} por ${fmtCurrency(deletingAsset.amount, deletingAsset.currency)}.`
                  : `Se eliminará el registro de ${fmtCurrency(deletingAsset.amount, deletingAsset.currency)}.`)}{' '}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingA}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteAssetInvoice}
              disabled={savingA}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {savingA ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

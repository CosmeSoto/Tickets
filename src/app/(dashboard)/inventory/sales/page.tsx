'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  DollarSign,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { useExport } from '@/hooks/common/use-export'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import Link from 'next/link'

interface SaleRecord {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  buyerName: string
  buyerCompany: string | null
  buyerIdNumber: string | null
  salePrice: number
  saleDate: string
  invoiceNumber: string | null
  paymentMethod: string | null
  accessories: string[]
  notes: string | null
  rejectionReason: string | null
  approvedAt: string | null
  createdAt: string
  equipment: {
    id: string
    code: string
    brand: string
    model: string
    serialNumber: string
    purchasePrice: number | null
    purchaseDate: string | null
    usefulLifeYears: number | null
    residualValue: number | null
    type: { name: string }
  }
  requestedBy: { id: string; name: string }
  approvedBy: { id: string; name: string } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PENDING: {
    label: 'Pendiente',
    icon: Clock,
    class: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  APPROVED: {
    label: 'Aprobada',
    icon: CheckCircle,
    class: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  REJECTED: {
    label: 'Rechazada',
    icon: XCircle,
    class: 'bg-destructive/10 text-destructive border-destructive/30',
  },
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  DISCOUNT: 'Descuento de rol',
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(v)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function calcBookValue(sale: SaleRecord): number | null {
  const { purchasePrice, purchaseDate, usefulLifeYears, residualValue } = sale.equipment
  if (!purchasePrice || !purchaseDate || !usefulLifeYears) return null
  const years =
    (new Date(sale.saleDate).getTime() - new Date(purchaseDate).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25)
  const depPerYear = (purchasePrice - (residualValue ?? 0)) / usefulLifeYears
  return Math.max(purchasePrice - depPerYear * years, residualValue ?? 0)
}

// ── Fila expandible ───────────────────────────────────────────────────────────

function SaleRow({ sale, onAction }: { sale: SaleRecord; onAction: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [acting, setActing] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)

  const cfg = STATUS_CONFIG[sale.status]
  const StatusIcon = cfg.icon
  const bookValue = calcBookValue(sale)
  const profit = bookValue !== null ? sale.salePrice - bookValue : null

  const handleAction = async (action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      toast({ title: 'Indica el motivo del rechazo', variant: 'destructive' })
      return
    }
    try {
      setActing(true)
      const res = await fetch(`/api/inventory/sales/${sale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: rejectionReason.trim() || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: action === 'approve' ? 'Venta aprobada' : 'Venta rechazada' })
      onAction()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setActing(false)
    }
  }

  return (
    <>
      <TableRow className='cursor-pointer hover:bg-muted/50' onClick={() => setExpanded(e => !e)}>
        <TableCell className='font-mono text-xs'>{sale.equipment.code}</TableCell>
        <TableCell>
          <div>
            <p className='text-sm font-medium'>
              {sale.equipment.brand} {sale.equipment.model}
            </p>
            <p className='text-xs text-muted-foreground'>{sale.equipment.type.name}</p>
          </div>
        </TableCell>
        <TableCell className='hidden md:table-cell'>{sale.buyerName}</TableCell>
        <TableCell className='hidden lg:table-cell'>{sale.buyerCompany ?? '—'}</TableCell>
        <TableCell className='font-semibold'>{formatCurrency(sale.salePrice)}</TableCell>
        <TableCell className='hidden sm:table-cell'>{formatDate(sale.saleDate)}</TableCell>
        <TableCell className='hidden md:table-cell'>
          {sale.paymentMethod ? (PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod) : '—'}
        </TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.class}`}
          >
            <StatusIcon className='h-3 w-3' />
            {cfg.label}
          </span>
        </TableCell>
        <TableCell className='hidden lg:table-cell text-xs text-muted-foreground'>
          {sale.requestedBy.name}
        </TableCell>
        <TableCell className='text-right'>
          {expanded ? (
            <ChevronUp className='h-4 w-4 text-muted-foreground inline' />
          ) : (
            <ChevronDown className='h-4 w-4 text-muted-foreground inline' />
          )}
        </TableCell>
      </TableRow>

      {/* Panel expandido */}
      {expanded && (
        <TableRow className='bg-muted/20 hover:bg-muted/20'>
          <TableCell colSpan={10} className='p-0'>
            <div className='px-4 py-4 space-y-4'>
              {/* Datos financieros */}
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm'>
                {sale.equipment.purchasePrice && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Precio de compra</p>
                    <p className='font-medium'>{formatCurrency(sale.equipment.purchasePrice)}</p>
                  </div>
                )}
                {bookValue !== null && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Valor libro estimado</p>
                    <p className='font-medium'>{formatCurrency(bookValue)}</p>
                  </div>
                )}
                {profit !== null && (
                  <div>
                    <p className='text-xs text-muted-foreground'>Resultado</p>
                    <p
                      className={`font-semibold ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
                    >
                      {profit >= 0 ? '+' : ''}
                      {formatCurrency(profit)}
                    </p>
                  </div>
                )}
                {sale.invoiceNumber && (
                  <div>
                    <p className='text-xs text-muted-foreground'>N° Factura</p>
                    <p className='font-mono text-xs'>{sale.invoiceNumber}</p>
                  </div>
                )}
                {sale.equipment.serialNumber && (
                  <div>
                    <p className='text-xs text-muted-foreground'>N° de Serie</p>
                    <p className='font-mono text-xs'>{sale.equipment.serialNumber}</p>
                  </div>
                )}
                {sale.buyerIdNumber && (
                  <div>
                    <p className='text-xs text-muted-foreground'>RUC / Cédula</p>
                    <p className='font-mono text-xs'>{sale.buyerIdNumber}</p>
                  </div>
                )}
              </div>

              {/* Accesorios */}
              {sale.accessories.length > 0 && (
                <div>
                  <p className='text-xs text-muted-foreground mb-1.5'>Accesorios incluidos</p>
                  <div className='flex flex-wrap gap-1.5'>
                    {sale.accessories.map(acc => (
                      <span
                        key={acc}
                        className='inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border'
                      >
                        {acc}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas */}
              {sale.notes && (
                <div>
                  <p className='text-xs text-muted-foreground mb-0.5'>Notas</p>
                  <p className='text-sm text-foreground'>{sale.notes}</p>
                </div>
              )}

              {/* Motivo de rechazo */}
              {sale.status === 'REJECTED' && sale.rejectionReason && (
                <div className='bg-destructive/5 rounded-lg px-3 py-2 border border-destructive/20'>
                  <p className='text-xs font-medium text-destructive mb-0.5'>Motivo del rechazo</p>
                  <p className='text-sm text-foreground'>{sale.rejectionReason}</p>
                </div>
              )}

              {/* Meta */}
              <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                <span>
                  Solicitado por{' '}
                  <strong className='text-foreground'>{sale.requestedBy.name}</strong> el{' '}
                  {formatDate(sale.createdAt)}
                </span>
                {sale.approvedBy && (
                  <span>
                    · {sale.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'} por{' '}
                    <strong className='text-foreground'>{sale.approvedBy.name}</strong>
                  </span>
                )}
              </div>

              {/* Acciones — solo PENDING */}
              {sale.status === 'PENDING' && (
                <div className='space-y-2 pt-1'>
                  {!showRejectForm ? (
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        size='sm'
                        onClick={e => {
                          e.stopPropagation()
                          handleAction('approve')
                        }}
                        disabled={acting}
                      >
                        {acting ? (
                          <Loader2 className='h-4 w-4 animate-spin mr-2' />
                        ) : (
                          <CheckCircle className='h-4 w-4 mr-2' />
                        )}
                        Aprobar venta
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={e => {
                          e.stopPropagation()
                          setShowRejectForm(true)
                        }}
                        disabled={acting}
                      >
                        <XCircle className='h-4 w-4 mr-2' />
                        Rechazar
                      </Button>
                      <Link
                        href={`/inventory/equipment/${sale.equipment.id}`}
                        onClick={e => e.stopPropagation()}
                      >
                        <Button size='sm' variant='ghost'>
                          Ver equipo
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className='space-y-2' onClick={e => e.stopPropagation()}>
                      <Textarea
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                        placeholder='Motivo del rechazo...'
                        rows={2}
                      />
                      <div className='flex gap-2'>
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() => handleAction('reject')}
                          disabled={acting}
                        >
                          {acting && <Loader2 className='h-4 w-4 animate-spin mr-2' />}
                          Confirmar rechazo
                        </Button>
                        <Button size='sm' variant='ghost' onClick={() => setShowRejectForm(false)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SalesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const role = session?.user?.role
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const canAccess = role === 'ADMIN' || isSuperAdmin || canManageInventory

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !canAccess) router.push('/inventory')
  }, [status, canAccess, router])

  const loadSales = useCallback(async () => {
    try {
      setLoading(true)
      const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/inventory/sales${params}`)
      if (res.ok) setSales((await res.json()).sales)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  // Búsqueda client-side
  const filtered = sales.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.equipment.code.toLowerCase().includes(q) ||
      s.equipment.brand.toLowerCase().includes(q) ||
      s.equipment.model.toLowerCase().includes(q) ||
      s.buyerName.toLowerCase().includes(q) ||
      (s.buyerCompany ?? '').toLowerCase().includes(q) ||
      (s.invoiceNumber ?? '').toLowerCase().includes(q)
    )
  })

  // Ordenamiento con el hook estándar
  const {
    sortedData: sorted,
    requestSort,
    getSortIcon,
  } = useTableSort(filtered, { key: 'createdAt', direction: 'desc' })

  // Exportación
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'ventas-activos',
    title: 'Ventas de Activos',
    subtitle: `${sorted.length} registros`,
    getData: () => sorted,
    columns: [
      { key: 'equipment', label: 'Código', format: (v: any) => v.code },
      { key: 'equipment', label: 'Equipo', format: (v: any) => `${v.brand} ${v.model}` },
      { key: 'equipment', label: 'Tipo', format: (v: any) => v.type.name },
      { key: 'equipment', label: 'N° de Serie', format: (v: any) => v.serialNumber },
      { key: 'buyerName', label: 'Comprador' },
      { key: 'buyerCompany', label: 'Empresa', format: (v: any) => v ?? '' },
      { key: 'buyerIdNumber', label: 'RUC / Cédula', format: (v: any) => v ?? '' },
      { key: 'salePrice', label: 'Precio de venta', format: (v: number) => formatCurrency(v) },
      { key: 'saleDate', label: 'Fecha de venta', format: (v: string) => formatDate(v) },
      {
        key: 'paymentMethod',
        label: 'Forma de pago',
        format: (v: any) => (v ? (PAYMENT_LABELS[v] ?? v) : ''),
      },
      { key: 'invoiceNumber', label: 'N° Factura', format: (v: any) => v ?? '' },
      {
        key: 'status',
        label: 'Estado',
        format: (v: string) => STATUS_CONFIG[v as keyof typeof STATUS_CONFIG]?.label ?? v,
      },
      { key: 'requestedBy', label: 'Solicitado por', format: (v: any) => v.name },
      { key: 'approvedBy', label: 'Aprobado por', format: (v: any) => v?.name ?? '' },
      { key: 'createdAt', label: 'Fecha solicitud', format: (v: string) => formatDate(v) },
    ],
  })

  if (!canAccess) return null

  const pending = sales.filter(s => s.status === 'PENDING').length
  const approved = sales.filter(s => s.status === 'APPROVED').length
  const totalRevenue = sales
    .filter(s => s.status === 'APPROVED')
    .reduce((sum, s) => sum + s.salePrice, 0)

  return (
    <ModuleLayout title='Ventas de Activos' subtitle='Gestión y aprobación de ventas de equipos'>
      <div className='space-y-5'>
        {/* Botón regresar */}
        <button
          type='button'
          onClick={() => router.push('/inventory')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Regresar a Inventario
        </button>

        {/* Resumen */}
        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
          <Card className='shadow-sm'>
            <CardContent className='p-4 flex items-center gap-3'>
              <Clock className='h-8 w-8 text-amber-500 shrink-0' />
              <div>
                <p className='text-2xl font-bold'>{pending}</p>
                <p className='text-xs text-muted-foreground'>Pendientes</p>
              </div>
            </CardContent>
          </Card>
          <Card className='shadow-sm'>
            <CardContent className='p-4 flex items-center gap-3'>
              <CheckCircle className='h-8 w-8 text-emerald-500 shrink-0' />
              <div>
                <p className='text-2xl font-bold'>{approved}</p>
                <p className='text-xs text-muted-foreground'>Aprobadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className='shadow-sm col-span-2 sm:col-span-1'>
            <CardContent className='p-4 flex items-center gap-3'>
              <DollarSign className='h-8 w-8 text-primary shrink-0' />
              <div>
                <p className='text-2xl font-bold'>
                  {new Intl.NumberFormat('es-EC', {
                    style: 'currency',
                    currency: 'USD',
                    maximumFractionDigits: 0,
                  }).format(totalRevenue)}
                </p>
                <p className='text-xs text-muted-foreground'>Ingresos por ventas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Banner pendientes */}
        {pending > 0 && (
          <div className='rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400'>
            <Clock className='h-4 w-4 shrink-0' />
            {pending} solicitud{pending > 1 ? 'es' : ''} pendiente{pending > 1 ? 's' : ''} de
            aprobación
          </div>
        )}

        <ListTableToolbar
          title={
            <p className='text-xs text-muted-foreground'>
              {loading ? 'Cargando…' : `${sorted.length} registro${sorted.length !== 1 ? 's' : ''}`}
            </p>
          }
          loading={loading}
          onRefresh={loadSales}
          showViewToggle={false}
          export={{
            onExportCSV: exportCSV,
            onExportExcel: exportExcel,
            onExportPDF: exportPDF,
            loading: exporting,
            disabled: sorted.length === 0,
          }}
        />

        {/* Filtros + búsqueda */}
        <div className='flex flex-col sm:flex-row gap-2 flex-wrap'>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-44'>
              <SelectValue placeholder='Estado' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>Todos los estados</SelectItem>
              <SelectItem value='PENDING'>Pendientes</SelectItem>
              <SelectItem value='APPROVED'>Aprobadas</SelectItem>
              <SelectItem value='REJECTED'>Rechazadas</SelectItem>
            </SelectContent>
          </Select>

          <div className='relative flex-1 min-w-[180px]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Buscar por equipo, comprador, factura...'
              className='flex h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground'
            />
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : sorted.length === 0 ? (
          <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center'>
            <Package className='h-10 w-10 text-muted-foreground/30 mb-3' />
            <p className='text-muted-foreground text-sm'>No hay solicitudes de venta</p>
          </div>
        ) : (
          <div className='rounded-md border overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey='equipment'
                    currentSort={getSortIcon('equipment')}
                    onSort={requestSort}
                  >
                    Código
                  </SortableTableHead>
                  <TableHead>Equipo</TableHead>
                  <SortableTableHead
                    sortKey='buyerName'
                    currentSort={getSortIcon('buyerName')}
                    onSort={requestSort}
                    className='hidden md:table-cell'
                  >
                    Comprador
                  </SortableTableHead>
                  <TableHead className='hidden lg:table-cell'>Empresa</TableHead>
                  <SortableTableHead
                    sortKey='salePrice'
                    currentSort={getSortIcon('salePrice')}
                    onSort={requestSort}
                  >
                    Precio
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='saleDate'
                    currentSort={getSortIcon('saleDate')}
                    onSort={requestSort}
                    className='hidden sm:table-cell'
                  >
                    Fecha venta
                  </SortableTableHead>
                  <TableHead className='hidden md:table-cell'>Pago</TableHead>
                  <SortableTableHead
                    sortKey='status'
                    currentSort={getSortIcon('status')}
                    onSort={requestSort}
                  >
                    Estado
                  </SortableTableHead>
                  <TableHead className='hidden lg:table-cell'>Solicitado por</TableHead>
                  <TableHead className='w-8' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(sale => (
                  <SaleRow key={sale.id} sale={sale} onAction={loadSales} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </ModuleLayout>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Search,
  Tag,
  Package,
  Loader2,
  Pencil,
  Check,
  X,
  ShoppingCart,
  DollarSign,
  HelpCircle,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForSaleEquipment {
  id: string
  code: string
  brand: string
  model: string
  status: string
  condition: string
  saleListingPrice: number | null
  updatedAt: string
  createdAt: string
  type: {
    id: string
    name: string
    family?: {
      id: string
      name: string
    } | null
  }
}

function mapForSaleEquipment(raw: any): ForSaleEquipment {
  const brandName = raw.model?.brand
    ? typeof raw.model.brand === 'object'
      ? (raw.model.brand.name ?? '')
      : String(raw.model.brand)
    : (raw.brand ?? '')
  const modelName = raw.model?.model ?? raw.modelDeprecated ?? ''
  return {
    id: raw.id,
    code: raw.code,
    brand: brandName,
    model: modelName,
    status: raw.status,
    condition: raw.condition,
    saleListingPrice: raw.saleListingPrice ?? null,
    updatedAt: raw.updatedAt,
    createdAt: raw.createdAt,
    type: raw.type,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

const PAYMENT_METHOD_OPTIONS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'DISCOUNT', label: 'Descuento de rol' },
]

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

// ── Inline Price Editor ───────────────────────────────────────────────────────

function InlinePriceEditor({
  equipmentId,
  currentPrice,
  onSaved,
}: {
  equipmentId: string
  currentPrice: number | null
  onSaved: (newPrice: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentPrice != null ? String(currentPrice) : '')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    const parsed = value.trim() === '' ? null : parseFloat(value)
    if (parsed !== null && (isNaN(parsed) || parsed <= 0)) {
      toast({
        title: 'Precio inválido',
        description: 'Ingresa un número positivo',
        variant: 'destructive',
      })
      return
    }
    try {
      setSaving(true)
      const res = await fetch(`/api/inventory/equipment/${equipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleListingPrice: parsed }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      toast({ title: 'Precio actualizado' })
      onSaved(parsed)
      setEditing(false)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo actualizar el precio',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setValue(currentPrice != null ? String(currentPrice) : '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className='flex items-center gap-1.5 group'>
        <span className={currentPrice == null ? 'text-muted-foreground' : 'font-medium'}>
          {currentPrice != null ? formatCurrency(currentPrice) : '—'}
        </span>
        <button
          type='button'
          onClick={() => setEditing(true)}
          className='opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted'
          title='Editar precio'
        >
          <Pencil className='h-3.5 w-3.5 text-muted-foreground' />
        </button>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-1' onClick={e => e.stopPropagation()}>
      <Input
        type='number'
        step='0.01'
        min='0'
        value={value}
        onChange={e => setValue(e.target.value)}
        className='h-7 w-28 text-sm'
        placeholder='0.00'
        autoFocus
        onKeyDown={e => {
          if (e.key === 'Enter') handleConfirm()
          if (e.key === 'Escape') handleCancel()
        }}
      />
      <button
        type='button'
        onClick={handleConfirm}
        disabled={saving}
        className='p-1 rounded hover:bg-emerald-500/10 text-emerald-600'
        title='Confirmar'
      >
        {saving ? (
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
        ) : (
          <Check className='h-3.5 w-3.5' />
        )}
      </button>
      <button
        type='button'
        onClick={handleCancel}
        disabled={saving}
        className='p-1 rounded hover:bg-destructive/10 text-destructive'
        title='Cancelar'
      >
        <X className='h-3.5 w-3.5' />
      </button>
    </div>
  )
}

// ── Sale Form Modal ───────────────────────────────────────────────────────────

interface SaleFormModalProps {
  equipment: ForSaleEquipment | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

function SaleFormModal({ equipment, open, onClose, onSuccess }: SaleFormModalProps) {
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [buyerName, setBuyerName] = useState('')
  const [buyerCompany, setBuyerCompany] = useState('')
  const [buyerIdNumber, setBuyerIdNumber] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0])
  const [paymentMethod, setPaymentMethod] = useState('')
  const [accessoriesInput, setAccessoriesInput] = useState('')
  const [notes, setNotes] = useState('')

  // Pre-fill sale price from equipment
  useEffect(() => {
    if (equipment) {
      setSalePrice(equipment.saleListingPrice != null ? String(equipment.saleListingPrice) : '')
    }
  }, [equipment])

  const resetForm = () => {
    setBuyerName('')
    setBuyerCompany('')
    setBuyerIdNumber('')
    setSalePrice('')
    setSaleDate(new Date().toISOString().split('T')[0])
    setPaymentMethod('')
    setAccessoriesInput('')
    setNotes('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!equipment) return

    const parsedPrice = parseFloat(salePrice)
    if (!buyerName.trim()) {
      toast({ title: 'El nombre del comprador es obligatorio', variant: 'destructive' })
      return
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      toast({ title: 'El precio de venta debe ser un número positivo', variant: 'destructive' })
      return
    }
    if (!saleDate) {
      toast({ title: 'La fecha de venta es obligatoria', variant: 'destructive' })
      return
    }

    const accessories = accessoriesInput
      .split(',')
      .map(a => a.trim())
      .filter(Boolean)

    try {
      setSubmitting(true)
      const res = await fetch('/api/inventory/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: equipment.id,
          buyerName: buyerName.trim(),
          buyerCompany: buyerCompany.trim() || undefined,
          buyerIdNumber: buyerIdNumber.trim() || undefined,
          salePrice: parsedPrice,
          saleDate,
          paymentMethod: paymentMethod || undefined,
          accessories,
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al registrar la venta')
      }

      toast({
        title: 'Venta registrada',
        description: 'La solicitud de venta fue creada con estado Pendiente',
      })
      resetForm()
      onSuccess()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo registrar la venta',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!equipment) return null

  return (
    <Dialog
      open={open}
      onOpenChange={open => {
        if (!open) handleClose()
      }}
    >
      <DialogContent className='max-w-lg max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ShoppingCart className='h-5 w-5 text-primary' />
            Registrar venta
          </DialogTitle>
        </DialogHeader>
        <div className='overflow-y-auto max-h-[calc(90vh-80px)]'>
          {/* Equipment info (read-only) */}
          <div className='rounded-lg border bg-muted/30 px-4 py-3 space-y-1 text-sm'>
            <p className='font-medium text-foreground'>
              {equipment.brand} {equipment.model}
            </p>
            <p className='text-muted-foreground'>
              <span className='font-mono'>{equipment.code}</span>
              {' · '}
              {equipment.type.name}
              {equipment.type.family ? ` · ${equipment.type.family.name}` : ''}
            </p>
            {equipment.saleListingPrice != null && (
              <p className='text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1'>
                <Tag className='h-3 w-3' />
                Precio de lista: {formatCurrency(equipment.saleListingPrice)}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className='space-y-4'>
            {/* Buyer info */}
            <div className='space-y-3'>
              <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                Datos del comprador
              </p>
              <div className='space-y-1'>
                <Label htmlFor='buyerName'>
                  Nombre del comprador <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='buyerName'
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  placeholder='Nombre completo'
                  required
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <Label htmlFor='buyerCompany'>Empresa</Label>
                  <Input
                    id='buyerCompany'
                    value={buyerCompany}
                    onChange={e => setBuyerCompany(e.target.value)}
                    placeholder='Empresa (opcional)'
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='buyerIdNumber'>RUC / Cédula</Label>
                  <Input
                    id='buyerIdNumber'
                    value={buyerIdNumber}
                    onChange={e => setBuyerIdNumber(e.target.value)}
                    placeholder='Identificación (opcional)'
                  />
                </div>
              </div>
            </div>

            {/* Sale details */}
            <div className='space-y-3'>
              <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                Detalles de la venta
              </p>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <Label htmlFor='salePrice'>
                    Precio de venta (USD) <span className='text-destructive'>*</span>
                  </Label>
                  <Input
                    id='salePrice'
                    type='number'
                    step='0.01'
                    min='0.01'
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    placeholder='0.00'
                    required
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='saleDate'>
                    Fecha de venta <span className='text-destructive'>*</span>
                  </Label>
                  <DateInput
                    id='saleDate'
                    value={saleDate}
                    onChange={e => setSaleDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className='space-y-1'>
                <Label htmlFor='paymentMethod'>Forma de pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger id='paymentMethod'>
                    <SelectValue placeholder='Seleccionar (opcional)' />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1'>
                <Label htmlFor='accessories'>
                  Accesorios incluidos{' '}
                  <span className='text-xs font-normal text-muted-foreground'>
                    (separados por coma)
                  </span>
                </Label>
                <Input
                  id='accessories'
                  value={accessoriesInput}
                  onChange={e => setAccessoriesInput(e.target.value)}
                  placeholder='Ej: Cargador, Funda, Mouse'
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='notes'>Notas</Label>
                <Textarea
                  id='notes'
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder='Observaciones adicionales (opcional)'
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={handleClose} disabled={submitting}>
                Cancelar
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                Registrar venta
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ForSalePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [equipment, setEquipment] = useState<ForSaleEquipment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Sale modal
  const [selectedEquipment, setSelectedEquipment] = useState<ForSaleEquipment | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const role = session?.user?.role
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const canAccess = role === 'ADMIN' || isSuperAdmin || canManageInventory

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && !canAccess) router.push('/inventory')
  }, [status, canAccess, router])

  const loadEquipment = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory/sales/for-sale?pageSize=200')
      if (res.ok) {
        const data = await res.json()
        setEquipment((data.equipment ?? []).map(mapForSaleEquipment))
      } else {
        const err = await res.json().catch(() => ({}))
        toast({
          title: 'Error al cargar equipos',
          description: err.error ?? 'No se pudieron cargar los equipos en venta',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error al cargar equipos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (canAccess) loadEquipment()
  }, [canAccess, loadEquipment])

  // Client-side search
  const filtered = equipment.filter(eq => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      eq.code.toLowerCase().includes(q) ||
      eq.brand.toLowerCase().includes(q) ||
      eq.model.toLowerCase().includes(q) ||
      eq.type.name.toLowerCase().includes(q)
    )
  })

  const {
    sortedData: sorted,
    requestSort,
    getSortIcon,
  } = useTableSort(filtered, { key: 'updatedAt', direction: 'desc' })

  // Export
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'activos-para-venta',
    title: 'Activos para la Venta',
    subtitle: `${sorted.length} registros`,
    getData: () => sorted,
    columns: [
      { key: 'code', label: 'Código' },
      { key: 'brand', label: 'Marca' },
      { key: 'model', label: 'Modelo' },
      { key: 'type', label: 'Tipo', format: (v: any) => v?.name ?? '' },
      { key: 'type', label: 'Familia', format: (v: any) => v?.family?.name ?? '' },
      { key: 'condition', label: 'Condición', format: (v: string) => CONDITION_LABELS[v] ?? v },
      {
        key: 'saleListingPrice',
        label: 'Precio venta',
        format: (v: number | null) => (v != null ? formatCurrency(v) : '—'),
      },
      { key: 'updatedAt', label: 'Fecha marcado', format: (v: string) => formatDate(v) },
    ],
  })

  // Inline price update handler
  const handlePriceUpdate = (id: string, newPrice: number | null) => {
    setEquipment(prev =>
      prev.map(eq => (eq.id === id ? { ...eq, saleListingPrice: newPrice } : eq))
    )
  }

  const handleSaleSuccess = () => {
    setModalOpen(false)
    setSelectedEquipment(null)
    loadEquipment()
  }

  if (!canAccess) return null

  // Summary stats
  const withPrice = equipment.filter(eq => eq.saleListingPrice != null).length
  const withoutPrice = equipment.length - withPrice

  return (
    <ModuleLayout title='Activos para la Venta' subtitle='Equipos marcados como FOR_SALE'>
      <div className='space-y-5'>
        {/* Back button */}
        <button
          type='button'
          onClick={() => router.push('/inventory/sales')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Regresar a Ventas
        </button>

        {/* Summary cards */}
        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
          <Card className='shadow-sm'>
            <CardContent className='p-4 flex items-center gap-3'>
              <Tag className='h-8 w-8 text-amber-500 shrink-0' />
              <div>
                <p className='text-2xl font-bold'>{equipment.length}</p>
                <p className='text-xs text-muted-foreground'>Total en venta</p>
              </div>
            </CardContent>
          </Card>
          <Card className='shadow-sm'>
            <CardContent className='p-4 flex items-center gap-3'>
              <DollarSign className='h-8 w-8 text-emerald-500 shrink-0' />
              <div>
                <p className='text-2xl font-bold'>{withPrice}</p>
                <p className='text-xs text-muted-foreground'>Con precio definido</p>
              </div>
            </CardContent>
          </Card>
          <Card className='shadow-sm col-span-2 sm:col-span-1'>
            <CardContent className='p-4 flex items-center gap-3'>
              <HelpCircle className='h-8 w-8 text-muted-foreground shrink-0' />
              <div>
                <p className='text-2xl font-bold'>{withoutPrice}</p>
                <p className='text-xs text-muted-foreground'>Sin precio</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <ListTableToolbar
          title={
            <p className='text-xs text-muted-foreground'>
              {loading ? 'Cargando…' : `${sorted.length} equipo${sorted.length !== 1 ? 's' : ''}`}
            </p>
          }
          loading={loading}
          onRefresh={loadEquipment}
          showViewToggle={false}
          export={{
            onExportCSV: exportCSV,
            onExportExcel: exportExcel,
            onExportPDF: exportPDF,
            loading: exporting,
            disabled: sorted.length === 0,
          }}
        />

        <div className='flex flex-col sm:flex-row gap-2 flex-wrap'>
          <div className='relative flex-1 min-w-[180px]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Buscar por código, marca, modelo, tipo...'
              className='flex h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground'
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : sorted.length === 0 ? (
          <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center'>
            <Package className='h-10 w-10 text-muted-foreground/30 mb-3' />
            <p className='text-muted-foreground text-sm'>No hay equipos marcados para la venta</p>
          </div>
        ) : (
          <div className='rounded-md border overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey='code'
                    currentSort={getSortIcon('code')}
                    onSort={requestSort}
                  >
                    Código
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='brand'
                    currentSort={getSortIcon('brand')}
                    onSort={requestSort}
                  >
                    Equipo
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='type.name'
                    currentSort={getSortIcon('type.name')}
                    onSort={requestSort}
                    className='hidden md:table-cell'
                  >
                    Tipo
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='type.family.name'
                    currentSort={getSortIcon('type.family.name')}
                    onSort={requestSort}
                    className='hidden lg:table-cell'
                  >
                    Familia
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='condition'
                    currentSort={getSortIcon('condition')}
                    onSort={requestSort}
                    className='hidden sm:table-cell'
                  >
                    Condición
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='saleListingPrice'
                    currentSort={getSortIcon('saleListingPrice')}
                    onSort={requestSort}
                  >
                    Precio venta
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='updatedAt'
                    currentSort={getSortIcon('updatedAt')}
                    onSort={requestSort}
                    className='hidden sm:table-cell'
                  >
                    Fecha marcado
                  </SortableTableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(eq => (
                  <TableRow key={eq.id} className='hover:bg-muted/50'>
                    <TableCell className='font-mono text-xs'>{eq.code}</TableCell>
                    <TableCell>
                      <div>
                        <p className='text-sm font-medium'>
                          {eq.brand} {eq.model}
                        </p>
                        <p className='text-xs text-muted-foreground md:hidden'>{eq.type.name}</p>
                      </div>
                    </TableCell>
                    <TableCell className='hidden md:table-cell text-sm'>{eq.type.name}</TableCell>
                    <TableCell className='hidden lg:table-cell text-sm text-muted-foreground'>
                      {eq.type.family?.name ?? '—'}
                    </TableCell>
                    <TableCell className='hidden sm:table-cell'>
                      <span className='text-sm'>
                        {CONDITION_LABELS[eq.condition] ?? eq.condition}
                      </span>
                    </TableCell>
                    <TableCell>
                      <InlinePriceEditor
                        equipmentId={eq.id}
                        currentPrice={eq.saleListingPrice}
                        onSaved={newPrice => handlePriceUpdate(eq.id, newPrice)}
                      />
                    </TableCell>
                    <TableCell className='hidden sm:table-cell text-sm text-muted-foreground'>
                      {formatDate(eq.updatedAt)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          setSelectedEquipment(eq)
                          setModalOpen(true)
                        }}
                      >
                        <ShoppingCart className='h-3.5 w-3.5 mr-1.5' />
                        Registrar venta
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Sale Form Modal */}
      <SaleFormModal
        equipment={selectedEquipment}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedEquipment(null)
        }}
        onSuccess={handleSaleSuccess}
      />
    </ModuleLayout>
  )
}

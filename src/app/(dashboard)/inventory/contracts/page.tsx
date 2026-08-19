'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus,
  Search,
  RefreshCw,
  FileSignature,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  Eye,
  Info,
  X,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { useExport } from '@/hooks/common/use-export'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { useFetch } from '@/hooks/common/use-fetch'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { ContractForm } from '@/components/contracts/contract-form'
import { RenewContractDialog } from '@/components/inventory/contracts/renew-contract-dialog'
import { isCalendarOrSelectInteraction } from '@/lib/ui/calendar-dismiss'
import { ContractHistoryTimeline } from '@/components/inventory/contracts/contract-history-timeline'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { useInventoryPermissions } from '@/hooks/use-inventory-permissions'
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_CATEGORY_LABELS,
  BILLING_CYCLE_LABELS,
  type Contract,
  type ContractStatus,
  type ContractCategory,
} from '@/types/contracts'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtCurrency(n?: number | null, currency = 'USD') {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(n)
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; icon: any; cls: string }> = {
  DRAFT: {
    label: 'Borrador',
    icon: Clock,
    cls: 'bg-muted text-muted-foreground border border-border',
  },
  ACTIVE: {
    label: 'Vigente',
    icon: CheckCircle,
    cls: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/40',
  },
  EXPIRING: {
    label: 'Por vencer',
    icon: AlertTriangle,
    cls: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
  },
  EXPIRED: {
    label: 'Vencido',
    icon: XCircle,
    cls: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40',
  },
  TERMINATED: {
    label: 'Terminado',
    icon: XCircle,
    cls: 'bg-muted text-muted-foreground border border-border',
  },
  RENEWED: {
    label: 'Renovado',
    icon: CheckCircle,
    cls: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
  },
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const searchParams = useSearchParams()
  const supplierIdFromUrl = searchParams.get('supplierId')
  const { canManageContracts, canViewOwnContracts, isClient, isSuperAdmin } =
    useInventoryPermissions()
  const isClientOnly = isClient && !canManageContracts

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState<string | null>(supplierIdFromUrl)
  const [formOpen, setFormOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [historyContract, setHistoryContract] = useState<Contract | null>(null)
  const [renewContract, setRenewContract] = useState<Contract | null>(null)

  const { families } = useFamilyOptions()

  useEffect(() => {
    setSupplierFilter(supplierIdFromUrl)
  }, [supplierIdFromUrl])

  // Carga de contratos con useFetch
  const buildUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (statusFilter !== 'ALL') p.set('status', statusFilter)
    if (categoryFilter !== 'ALL') p.set('category', categoryFilter)
    if (familyFilter !== 'all') p.set('familyId', familyFilter)
    if (supplierFilter) p.set('supplierId', supplierFilter)
    p.set('pageSize', '200')
    return `/api/inventory/contracts?${p}`
  }, [statusFilter, categoryFilter, familyFilter, supplierFilter])

  const {
    data: contractsRaw,
    loading,
    reload,
  } = useFetch<Contract>(buildUrl(), { transform: d => d.contracts ?? [] })

  const { data: atRiskItems } = useFetch<{
    id: string
    name: string
    risks: string[]
    riskLevel: string
  }>('/api/inventory/contracts/at-risk', {
    transform: d => d.items ?? [],
    enabled: canManageContracts,
  })

  // Filtro de búsqueda en cliente
  const contracts = contractsRaw.filter(c => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.contractNumber ?? '').toLowerCase().includes(q) ||
      (c.supplier?.name ?? '').toLowerCase().includes(q)
    )
  })

  const {
    sortedData: sortedContracts,
    requestSort,
    getSortIcon,
  } = useTableSort(contracts, { key: 'name', direction: 'asc' })

  // Stats
  const stats = {
    total: contractsRaw.length,
    active: contractsRaw.filter(c => c.status === 'ACTIVE').length,
    expiring: contractsRaw.filter(c => c.status === 'EXPIRING').length,
    expired: contractsRaw.filter(c => c.status === 'EXPIRED').length,
    monthlyCostTotal: contractsRaw.reduce((s, c) => s + (c.monthlyCost ?? 0), 0),
  }

  // Exportación
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'contratos',
    title: 'Gestión de Contratos',
    getData: () => contracts,
    columns: [
      { key: 'contractNumber', label: 'N° Contrato', format: v => v ?? '' },
      { key: 'name', label: 'Nombre' },
      {
        key: 'category',
        label: 'Categoría',
        format: v => CONTRACT_CATEGORY_LABELS[v as ContractCategory] ?? v,
      },
      { key: 'supplier', label: 'Proveedor', format: v => v?.name ?? '' },
      { key: 'family', label: 'Área', format: v => v?.name ?? '' },
      { key: 'startDate', label: 'Inicio', format: v => fmtDate(v) },
      { key: 'endDate', label: 'Vencimiento', format: v => fmtDate(v) },
      {
        key: 'billingCycle',
        label: 'Ciclo',
        format: (v: any) => BILLING_CYCLE_LABELS[v as keyof typeof BILLING_CYCLE_LABELS] ?? v,
      },
      { key: 'monthlyCost', label: 'Costo mensual', format: v => (v != null ? String(v) : '') },
      {
        key: 'status',
        label: 'Estado',
        format: v => CONTRACT_STATUS_LABELS[v as ContractStatus] ?? v,
      },
    ],
  })

  const canManage = canManageContracts

  if (!canViewOwnContracts) {
    return (
      <ModuleLayout title='Contratos' subtitle='Sin acceso a este módulo'>
        <p className='text-sm text-muted-foreground'>
          Tu rol no tiene permisos para ver contratos o suscripciones.
        </p>
      </ModuleLayout>
    )
  }

  // Helper para renderizar iconos de ordenamiento
  const renderSortIcon = (key: string) => {
    const sortState = getSortIcon(key)
    if (sortState === 'asc') return <ArrowUp className='inline h-3.5 w-3.5 ml-1' />
    if (sortState === 'desc') return <ArrowDown className='inline h-3.5 w-3.5 ml-1' />
    return <ArrowUpDown className='inline h-3.5 w-3.5 ml-1 opacity-40' />
  }

  const handleDelete = async () => {
    if (!deletingContract) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${deletingContract.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: 'Contrato eliminado' })
      setDeletingContract(null)
      reload()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ModuleLayout
      title={isClientOnly ? 'Mis suscripciones' : 'Contratos'}
      subtitle={
        isClientOnly
          ? 'Servicios y suscripciones asignados a tu cuenta. Puedes firmar actas de entrega y retiro.'
          : 'Gestión centralizada de contratos, arrendamientos y suscripciones'
      }
      loading={loading && contractsRaw.length === 0}
      headerActions={
        canManage ? (
          <Button
            size='sm'
            onClick={() => {
              setEditingContract(null)
              setFormOpen(true)
            }}
          >
            <Plus className='h-4 w-4 mr-2' /> Nuevo contrato
          </Button>
        ) : undefined
      }
    >
      <div className='space-y-5'>
        {canManage && (
          <div className='rounded-lg border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-2'>
            <div className='flex items-center gap-2 font-medium text-foreground'>
              <Info className='h-3.5 w-3.5' />
              Permisos por rol
            </div>
            <div className='grid sm:grid-cols-2 lg:grid-cols-4 gap-2'>
              <p>
                <strong>Super Admin / Admin:</strong> CRUD en sus familias, asignar clientes, actas,
                alertas.
              </p>
              <p>
                <strong>Gestor:</strong> Técnico o admin con «Gestión completa» (nunca un cliente).
                Opera en su familia nativa y las asignadas de inventario.
              </p>
              <p>
                <strong>Cliente:</strong> Solo lectura de suscripciones asignadas; firma actas vía
                enlace.
              </p>
              <p>
                <strong>Técnico:</strong> Sin acceso al listado de contratos (solo actas de
                equipos).
              </p>
            </div>
          </div>
        )}

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className='grid grid-cols-2 sm:grid-cols-5 gap-3'>
          {[
            { label: 'Total', value: stats.total, cls: 'text-foreground' },
            { label: 'Vigentes', value: stats.active, cls: 'text-green-600' },
            { label: 'Por vencer', value: stats.expiring, cls: 'text-amber-600' },
            { label: 'Vencidos', value: stats.expired, cls: 'text-red-600' },
            {
              label: 'Costo/mes',
              value: fmtCurrency(stats.monthlyCostTotal),
              cls: 'text-blue-600',
            },
          ].map(c => (
            <div key={c.label} className='rounded-lg border bg-card p-4'>
              <p className={`text-xl font-bold ${c.cls}`}>{c.value}</p>
              <p className='text-xs text-muted-foreground mt-0.5'>{c.label}</p>
            </div>
          ))}
        </div>

        {canManage && atRiskItems.length > 0 && (
          <div className='rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3'>
            <div className='flex items-start gap-2'>
              <AlertTriangle className='h-4 w-4 text-amber-600 shrink-0 mt-0.5' />
              <div className='flex-1 min-w-0'>
                <p className='text-sm font-medium text-amber-900 dark:text-amber-200'>
                  {atRiskItems.length} suscripción{atRiskItems.length !== 1 ? 'es' : ''} en riesgo
                </p>
                <p className='text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5'>
                  Sin custodio, datos de pago incompletos o sin cliente asignado. Complete
                  facturación y asignación para evitar cobros huérfanos.
                </p>
                <ul className='mt-2 space-y-1 text-xs'>
                  {atRiskItems.slice(0, 5).map(item => (
                    <li key={item.id} className='flex flex-wrap gap-x-2'>
                      <button
                        type='button'
                        className='font-medium text-amber-900 dark:text-amber-100 hover:underline'
                        onClick={() => {
                          const c = contractsRaw.find(x => x.id === item.id)
                          if (c) {
                            setEditingContract(c)
                            setFormOpen(true)
                          }
                        }}
                      >
                        {item.name}
                      </button>
                      <span className='text-amber-700/80 dark:text-amber-400'>
                        {item.risks.join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <ListTableToolbar
          title={
            <span className='text-sm font-medium'>
              {contracts.length} contrato{contracts.length !== 1 ? 's' : ''}
            </span>
          }
          loading={loading}
          onRefresh={reload}
          showViewToggle={false}
          export={{
            onExportCSV: exportCSV,
            onExportExcel: exportExcel,
            onExportPDF: exportPDF,
            loading: exporting,
            disabled: contracts.length === 0,
          }}
        />

        {/* ── Filtros ───────────────────────────────────────────────────── */}
        <div className='flex flex-col sm:flex-row gap-2 flex-wrap'>
          <div className='relative flex-1 min-w-[200px]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Buscar por nombre, N° contrato o proveedor...'
              className='pl-9'
            />
          </div>

          <FamilyCombobox
            families={families}
            value={familyFilter}
            onValueChange={v => setFamilyFilter(v || 'all')}
            allowAll
            allowClear
            popoverWidth='220px'
          />

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className='w-auto min-w-[180px]'>
              <SelectValue placeholder='Categoría' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>Todas las categorías</SelectItem>
              {Object.entries(CONTRACT_CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-auto min-w-[160px]'>
              <SelectValue placeholder='Estado' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL'>Todos los estados</SelectItem>
              {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {supplierFilter && (
          <div className='flex items-center gap-2 text-sm'>
            <span className='rounded-md border px-2 py-1 bg-muted/40 inline-flex items-center gap-2'>
              Filtrado por proveedor
              <button
                type='button'
                className='inline-flex items-center text-muted-foreground hover:text-foreground'
                title='Quitar filtro de proveedor'
                onClick={() => setSupplierFilter(null)}
              >
                <X className='h-3.5 w-3.5' />
              </button>
            </span>
          </div>
        )}

        {/* ── Tabla ─────────────────────────────────────────────────────── */}
        {contracts.length === 0 && !loading ? (
          <div className='flex flex-col items-center justify-center py-16 text-muted-foreground'>
            <FileSignature className='h-12 w-12 mb-4 opacity-30' />
            <p className='text-sm'>
              {search || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || supplierFilter
                ? 'No se encontraron contratos con los filtros aplicados'
                : 'No hay contratos registrados'}
            </p>
            {canManage && !search && (
              <Button
                variant='outline'
                size='sm'
                className='mt-4'
                onClick={() => {
                  setEditingContract(null)
                  setFormOpen(true)
                }}
              >
                <Plus className='h-4 w-4 mr-2' /> Crear primer contrato
              </Button>
            )}
          </div>
        ) : (
          <div className='rounded-lg border overflow-hidden'>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='bg-muted/50 border-b'>
                  <tr>
                    <th
                      className='text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                      onClick={() => requestSort('name')}
                    >
                      Contrato {renderSortIcon('name')}
                    </th>
                    <th
                      className='text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                      onClick={() => requestSort('category')}
                    >
                      Categoría {renderSortIcon('category')}
                    </th>
                    <th className='text-left px-4 py-3 font-medium text-muted-foreground'>
                      Proveedor
                    </th>
                    <th
                      className='text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                      onClick={() => requestSort('family.name')}
                    >
                      Área {renderSortIcon('family.name')}
                    </th>
                    <th
                      className='text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                      onClick={() => requestSort('endDate')}
                    >
                      Vencimiento {renderSortIcon('endDate')}
                    </th>
                    <th
                      className='text-right px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                      onClick={() => requestSort('monthlyCost')}
                    >
                      Costo/mes {renderSortIcon('monthlyCost')}
                    </th>
                    <th
                      className='text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors select-none'
                      onClick={() => requestSort('status')}
                    >
                      Estado {renderSortIcon('status')}
                    </th>
                    {(canManage || isClientOnly) && <th className='px-4 py-3' />}
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {sortedContracts.map(c => {
                    const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.DRAFT
                    const StatusIcon = sc.icon
                    return (
                      <tr key={c.id} className='hover:bg-muted/30 transition-colors'>
                        <td className='px-4 py-3'>
                          <p className='font-medium leading-none'>{c.name}</p>
                          {c.contractNumber && (
                            <p className='text-xs text-muted-foreground mt-0.5 font-mono'>
                              {c.contractNumber}
                            </p>
                          )}
                        </td>
                        <td className='px-4 py-3 text-muted-foreground'>
                          {CONTRACT_CATEGORY_LABELS[c.category] ?? c.category}
                        </td>
                        <td className='px-4 py-3 text-muted-foreground'>
                          {c.supplier?.name ?? '—'}
                        </td>
                        <td className='px-4 py-3'>
                          {c.family ? (
                            <span className='inline-flex items-center gap-1.5 text-xs'>
                              {c.family.color && (
                                <span
                                  className='w-2 h-2 rounded-full flex-shrink-0'
                                  style={{ backgroundColor: c.family.color }}
                                />
                              )}
                              {c.family.name}
                            </span>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
                        </td>
                        <td className='px-4 py-3'>
                          <p className='text-sm'>{fmtDate(c.endDate)}</p>
                          {c.daysUntilExpiry != null && c.status === 'EXPIRING' && (
                            <p className='text-xs text-amber-600 mt-0.5'>
                              {c.daysUntilExpiry} días
                            </p>
                          )}
                        </td>
                        <td className='px-4 py-3 text-right font-mono text-sm'>
                          {fmtCurrency(c.monthlyCost, c.currency)}
                        </td>
                        <td className='px-4 py-3'>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.cls}`}
                          >
                            <StatusIcon className='h-3 w-3' />
                            {sc.label}
                          </span>
                        </td>
                        {(canManage || isClientOnly) && (
                          <td className='px-4 py-3'>
                            <div className='flex items-center gap-1 justify-end'>
                              {isClientOnly ? (
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  className='h-7 w-7 p-0'
                                  title='Ver suscripción'
                                  onClick={() => {
                                    setEditingContract(c)
                                    setFormOpen(true)
                                  }}
                                >
                                  <Eye className='h-3.5 w-3.5' />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-7 w-7 p-0'
                                    title='Historial de renovaciones'
                                    onClick={() => setHistoryContract(c)}
                                  >
                                    <History className='h-3.5 w-3.5' />
                                  </Button>
                                  {(c.status === 'ACTIVE' || c.status === 'EXPIRING') && (
                                    <Button
                                      variant='ghost'
                                      size='sm'
                                      className='h-7 w-7 p-0'
                                      title='Renovar contrato'
                                      onClick={() => setRenewContract(c)}
                                    >
                                      <RefreshCw className='h-3.5 w-3.5' />
                                    </Button>
                                  )}
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-7 w-7 p-0'
                                    onClick={() => {
                                      setEditingContract(c)
                                      setFormOpen(true)
                                    }}
                                  >
                                    <Pencil className='h-3.5 w-3.5' />
                                  </Button>
                                  {isSuperAdmin && (
                                    <Button
                                      variant='ghost'
                                      size='sm'
                                      className='h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10'
                                      title='Eliminar contrato (Solo Super Admin)'
                                      onClick={() => setDeletingContract(c)}
                                    >
                                      <Trash2 className='h-3.5 w-3.5' />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal formulario ──────────────────────────────────────────────── */}
      <Dialog
        modal={false}
        open={formOpen}
        onOpenChange={open => {
          if (!open) {
            setFormOpen(false)
            setEditingContract(null)
          }
        }}
      >
        <DialogContent
          className='w-[min(98vw,90rem)] max-w-[90rem] h-[min(94vh,56rem)] max-h-[94vh] p-0 gap-0 overflow-hidden flex flex-col'
          onPointerDownOutside={e => {
            if (isCalendarOrSelectInteraction(e)) return
            e.preventDefault()
          }}
          onInteractOutside={e => {
            if (isCalendarOrSelectInteraction(e)) return
            e.preventDefault()
          }}
        >
          <DialogHeader className='px-6 pt-6 pb-3 border-b shrink-0'>
            <DialogTitle>
              {isClientOnly
                ? `Ver suscripción — ${editingContract?.name ?? ''}`
                : editingContract
                  ? 'Editar contrato'
                  : 'Nuevo contrato'}
            </DialogTitle>
          </DialogHeader>
          <div className='overflow-y-auto flex-1 min-h-0 px-6 py-4'>
            <ContractForm
              contract={editingContract}
              readOnly={isClientOnly}
              onSuccess={() => {
                setFormOpen(false)
                setEditingContract(null)
                reload()
              }}
              onCancel={() => {
                setFormOpen(false)
                setEditingContract(null)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar eliminación ─────────────────────────────────────────── */}
      <AlertDialog
        open={!!deletingContract}
        onOpenChange={open => {
          if (!open) setDeletingContract(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar contrato?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deletingContract?.name}</strong> y todas sus líneas y adjuntos.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Historial de renovaciones ─────────────────────────────────────── */}
      <Dialog
        open={!!historyContract}
        onOpenChange={open => {
          if (!open) setHistoryContract(null)
        }}
      >
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Historial — {historyContract?.name}</DialogTitle>
          </DialogHeader>
          {historyContract && <ContractHistoryTimeline contractId={historyContract.id} />}
        </DialogContent>
      </Dialog>

      {/* ── Renovar contrato ──────────────────────────────────────────────── */}
      {renewContract && (
        <RenewContractDialog
          contract={{
            id: renewContract.id,
            name: renewContract.name,
            startDate: renewContract.startDate ? new Date(renewContract.startDate) : null,
            endDate: renewContract.endDate ? new Date(renewContract.endDate) : null,
            totalValue: renewContract.totalValue ?? null,
            monthlyCost: renewContract.monthlyCost ?? null,
            billingCycle: renewContract.billingCycle,
            autoRenew: renewContract.autoRenew,
            renewalNoticeDays: renewContract.renewalNoticeDays,
            notes: renewContract.notes ?? null,
          }}
          open={!!renewContract}
          onOpenChange={open => {
            if (!open) setRenewContract(null)
          }}
          onRenewed={() => {
            setRenewContract(null)
            reload()
          }}
        />
      )}
    </ModuleLayout>
  )
}

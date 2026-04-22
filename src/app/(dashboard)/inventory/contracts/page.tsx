'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, RefreshCw, FileSignature,
  CheckCircle, AlertTriangle, XCircle, Clock, Pencil, Trash2,
} from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { useInventoryFamilies } from '@/contexts/families-context'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { useFetch } from '@/hooks/common/use-fetch'
import { useToast } from '@/hooks/use-toast'
import { ContractForm } from '@/components/contracts/contract-form'
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
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtCurrency(n?: number | null, currency = 'USD') {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency, minimumFractionDigits: 0 }).format(n)
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; icon: any; cls: string }> = {
  DRAFT:      { label: 'Borrador',    icon: Clock,          cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  ACTIVE:     { label: 'Vigente',     icon: CheckCircle,    cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  EXPIRING:   { label: 'Por vencer',  icon: AlertTriangle,  cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  EXPIRED:    { label: 'Vencido',     icon: XCircle,        cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  TERMINATED: { label: 'Terminado',   icon: XCircle,        cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  RENEWED:    { label: 'Renovado',    icon: CheckCircle,    cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [familyFilter, setFamilyFilter]   = useState('all')
  const [formOpen, setFormOpen]           = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null)
  const [deleting, setDeleting]           = useState(false)

  const { families } = useFamilyOptions()

  // Carga de contratos con useFetch
  const buildUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (statusFilter   !== 'ALL')  p.set('status',   statusFilter)
    if (categoryFilter !== 'ALL')  p.set('category', categoryFilter)
    if (familyFilter   !== 'all')  p.set('familyId', familyFilter)
    p.set('pageSize', '200')
    return `/api/contracts?${p}`
  }, [statusFilter, categoryFilter, familyFilter])

  const { data: contractsRaw, loading, reload } = useFetch<Contract>(
    buildUrl(),
    { transform: d => d.contracts ?? [] }
  )

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

  // Stats
  const stats = {
    total:    contractsRaw.length,
    active:   contractsRaw.filter(c => c.status === 'ACTIVE').length,
    expiring: contractsRaw.filter(c => c.status === 'EXPIRING').length,
    expired:  contractsRaw.filter(c => c.status === 'EXPIRED').length,
    monthlyCostTotal: contractsRaw.reduce((s, c) => s + (c.monthlyCost ?? 0), 0),
  }

  // Exportación
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'contratos',
    title:    'Gestión de Contratos',
    getData:  () => contracts,
    columns: [
      { key: 'contractNumber', label: 'N° Contrato',    format: v => v ?? '' },
      { key: 'name',           label: 'Nombre' },
      { key: 'category',       label: 'Categoría',      format: v => CONTRACT_CATEGORY_LABELS[v as ContractCategory] ?? v },
      { key: 'supplier',       label: 'Proveedor',      format: v => v?.name ?? '' },
      { key: 'family',         label: 'Área',           format: v => v?.name ?? '' },
      { key: 'startDate',      label: 'Inicio',         format: v => fmtDate(v) },
      { key: 'endDate',        label: 'Vencimiento',    format: v => fmtDate(v) },
      { key: 'billingCycle',   label: 'Ciclo',          format: (v: any) => BILLING_CYCLE_LABELS[v as keyof typeof BILLING_CYCLE_LABELS] ?? v },
      { key: 'monthlyCost',    label: 'Costo mensual',  format: v => v != null ? String(v) : '' },
      { key: 'status',         label: 'Estado',         format: v => CONTRACT_STATUS_LABELS[v as ContractStatus] ?? v },
    ],
  })

  const isAdmin = (session?.user as any)?.role === 'ADMIN'
  const canManage = isAdmin || (session?.user as any)?.canManageInventory

  const handleDelete = async () => {
    if (!deletingContract) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/contracts/${deletingContract.id}`, { method: 'DELETE' })
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
      title="Contratos"
      subtitle="Gestión centralizada de contratos, arrendamientos y suscripciones"
      loading={loading && contractsRaw.length === 0}
      headerActions={
        canManage ? (
          <Button size="sm" onClick={() => { setEditingContract(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" /> Nuevo contrato
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-5">

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Total',        value: stats.total,    cls: 'text-foreground' },
            { label: 'Vigentes',     value: stats.active,   cls: 'text-green-600' },
            { label: 'Por vencer',   value: stats.expiring, cls: 'text-amber-600' },
            { label: 'Vencidos',     value: stats.expired,  cls: 'text-red-600' },
            { label: 'Costo/mes',    value: fmtCurrency(stats.monthlyCostTotal), cls: 'text-blue-600' },
          ].map(c => (
            <div key={c.label} className="rounded-lg border bg-card p-4">
              <p className={`text-xl font-bold ${c.cls}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filtros ───────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, N° contrato o proveedor..."
              className="pl-9" />
          </div>

          <FamilyCombobox
            families={families}
            value={familyFilter}
            onValueChange={v => setFamilyFilter(v || 'all')}
            allowAll
            allowClear
            popoverWidth="220px"
          />

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-auto min-w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las categorías</SelectItem>
              {Object.entries(CONTRACT_CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-auto min-w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los estados</SelectItem>
              {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={reload} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
            disabled={contracts.length === 0}
          />
        </div>

        {/* ── Tabla ─────────────────────────────────────────────────────── */}
        {contracts.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <FileSignature className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">
              {search || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
                ? 'No se encontraron contratos con los filtros aplicados'
                : 'No hay contratos registrados'}
            </p>
            {canManage && !search && (
              <Button variant="outline" size="sm" className="mt-4"
                onClick={() => { setEditingContract(null); setFormOpen(true) }}>
                <Plus className="h-4 w-4 mr-2" /> Crear primer contrato
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contrato</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Categoría</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Proveedor</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Área</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vencimiento</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Costo/mes</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                    {canManage && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contracts.map(c => {
                    const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.DRAFT
                    const StatusIcon = sc.icon
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium leading-none">{c.name}</p>
                          {c.contractNumber && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{c.contractNumber}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {CONTRACT_CATEGORY_LABELS[c.category] ?? c.category}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.supplier?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          {c.family ? (
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              {c.family.color && (
                                <span className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: c.family.color }} />
                              )}
                              {c.family.name}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm">{fmtDate(c.endDate)}</p>
                          {c.daysUntilExpiry != null && c.status === 'EXPIRING' && (
                            <p className="text-xs text-amber-600 mt-0.5">
                              {c.daysUntilExpiry} días
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">
                          {fmtCurrency(c.monthlyCost, c.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${sc.cls}`}>
                            <StatusIcon className="h-3 w-3" />
                            {sc.label}
                          </span>
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                onClick={() => { setEditingContract(c); setFormOpen(true) }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              {isAdmin && (
                                <Button variant="ghost" size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeletingContract(c)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
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
      <Dialog open={formOpen} onOpenChange={open => { if (!open) { setFormOpen(false); setEditingContract(null) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContract ? 'Editar contrato' : 'Nuevo contrato'}
            </DialogTitle>
          </DialogHeader>
          <ContractForm
            contract={editingContract}
            onSuccess={() => { setFormOpen(false); setEditingContract(null); reload() }}
            onCancel={() => { setFormOpen(false); setEditingContract(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* ── Confirmar eliminación ─────────────────────────────────────────── */}
      <AlertDialog open={!!deletingContract} onOpenChange={open => { if (!open) setDeletingContract(null) }}>
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
            <AlertDialogAction onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

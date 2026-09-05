'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, PowerOff, Power, RefreshCw, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { useSession } from 'next-auth/react'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { SupplierForm } from '@/components/inventory/suppliers/SupplierForm'
import { SupplierTypesSection } from '@/components/settings/inventory/supplier-types-section'
import { SupplierEvaluationsTab } from '@/components/inventory/suppliers/SupplierEvaluationsTab'
import { SupplierImportDialog } from '@/components/inventory/suppliers/SupplierImportDialog'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { useExport } from '@/hooks/common/use-export'
import { PAYMENT_METHOD_TYPE_LABELS } from '@/types/contracts'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilyOptions } from '@/hooks/use-family-options'

export default function SuppliersPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const isAdmin = session?.user?.role === 'ADMIN' || isSuperAdmin

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1, limit: 20 })
  const [activeFilter, setActiveFilter] = useState('true')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [deactivatingSupplier, setDeactivatingSupplier] = useState<any>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [deletingSupplier, setDeletingSupplier] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [creditFilter, setCreditFilter] = useState<'all' | 'high' | 'ok'>('all')
  const [importOpen, setImportOpen] = useState(false)

  // Familias de inventario desde el contexto global (cache Redis, sin peticion extra) - memoizadas
  const { families } = useFamilyOptions()

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (activeFilter !== 'all') params.set('active', activeFilter)
    if (familyFilter !== 'all') params.set('familyId', familyFilter)
    if (creditFilter !== 'all') params.set('creditRef', creditFilter)
    try {
      const res = await fetch(`/api/inventory/suppliers?${params}`)
      if (!res.ok) throw new Error('Error al cargar')
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : (data.suppliers ?? []))
      if (data.pagination) setPagination(data.pagination)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los proveedores',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter, familyFilter, creditFilter, page])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, activeFilter, familyFilter, creditFilter])

  useEffect(() => {
    fetchSuppliers()
  }, [fetchSuppliers])

  // Exportación
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'proveedores',
    title: 'Proveedores',
    getData: () => suppliers,
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'legalName', label: 'Razón social', format: v => v ?? '' },
      { key: 'supplierType', label: 'Tipo', format: v => v?.name ?? '' },
      { key: 'family', label: 'Área', format: v => v?.name ?? '' },
      { key: 'taxId', label: 'RUC / NIT', format: v => v ?? '' },
      { key: 'email', label: 'Email', format: v => v ?? '' },
      { key: 'phone', label: 'Teléfono', format: v => v ?? '' },
      { key: 'contactName', label: 'Contacto', format: v => v ?? '' },
      {
        key: 'paymentTermsDays',
        label: 'Plazo pago (días)',
        format: v => (v == null ? '' : String(v)),
      },
      {
        key: 'creditLimit',
        label: 'Límite crédito',
        format: (v, row) =>
          v == null ? '' : `${Number(v).toLocaleString()} ${row?.creditCurrency || 'USD'}`,
      },
      {
        key: 'preferredPaymentMethod',
        label: 'Método pago preferido',
        format: v =>
          v
            ? PAYMENT_METHOD_TYPE_LABELS[v as keyof typeof PAYMENT_METHOD_TYPE_LABELS] || String(v)
            : '',
      },
      { key: 'bankName', label: 'Banco', format: v => v ?? '' },
      { key: 'city', label: 'Ciudad', format: v => v ?? '' },
      { key: 'country', label: 'País', format: v => v ?? '' },
      { key: 'isActive', label: 'Estado', format: v => (v ? 'Activo' : 'Inactivo') },
    ],
  })

  const handleDeactivate = async () => {
    if (!deactivatingSupplier) return
    setDeactivating(true)
    try {
      const res = await fetch(`/api/inventory/suppliers/${deactivatingSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'No se puede desactivar', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Proveedor desactivado', description: deactivatingSupplier.name })
      setDeactivatingSupplier(null)
      fetchSuppliers()
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo desactivar el proveedor',
        variant: 'destructive',
      })
    } finally {
      setDeactivating(false)
    }
  }

  const handleReactivate = async (supplier: { id: string; name: string }) => {
    setReactivatingId(supplier.id)
    try {
      const res = await fetch(`/api/inventory/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'No se puede reactivar', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Proveedor reactivado', description: supplier.name })
      fetchSuppliers()
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo reactivar el proveedor',
        variant: 'destructive',
      })
    } finally {
      setReactivatingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deletingSupplier) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/suppliers/${deletingSupplier.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'No se puede eliminar', description: data.error, variant: 'destructive' })
        return
      }
      toast({
        title: 'Proveedor eliminado',
        description: `"${deletingSupplier.name}" fue eliminado permanentemente.`,
      })
      setDeletingSupplier(null)
      fetchSuppliers()
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el proveedor',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const total = suppliers.length

  const {
    sortedData: sortedSuppliers,
    requestSort,
    getSortIcon,
  } = useTableSort(suppliers, {
    key: 'name',
    direction: 'asc',
  })

  const closeSupplierForm = useCallback(() => {
    if (
      formDirty &&
      !window.confirm(
        'Hay cambios sin guardar en el proveedor. ¿Cerrar y descartar lo que estabas llenando?'
      )
    ) {
      return
    }
    setFormDirty(false)
    setFormOpen(false)
    setEditingSupplier(null)
  }, [formDirty])

  const handleFormOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setFormOpen(true)
        return
      }
      closeSupplierForm()
    },
    [closeSupplierForm]
  )

  return (
    <ModuleLayout
      title='Proveedores'
      subtitle='Maestro comercial: identidad, crédito, banco y vínculo con contratos'
    >
      <Tabs defaultValue='suppliers' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='suppliers'>
            Proveedores
            <Badge variant='secondary' className='ml-2'>
              {total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value='types'>Tipos de Proveedor</TabsTrigger>
          <TabsTrigger value='evaluations'>Calificación</TabsTrigger>
        </TabsList>

        <TabsContent value='suppliers' className='space-y-6'>
          <ListTableToolbar
            title={
              <p className='text-sm text-muted-foreground'>
                {total} proveedor{total !== 1 ? 'es' : ''}{' '}
                {creditFilter === 'high'
                  ? 'con compromiso alto'
                  : creditFilter === 'ok'
                    ? 'dentro de referencia de crédito'
                    : activeFilter === 'true'
                      ? 'activos'
                      : activeFilter === 'false'
                        ? 'inactivos'
                        : 'en total'}
              </p>
            }
            loading={loading}
            onRefresh={fetchSuppliers}
            showViewToggle={false}
            export={{
              onExportCSV: exportCSV,
              onExportExcel: exportExcel,
              onExportPDF: exportPDF,
              loading: exporting,
              disabled: suppliers.length === 0,
            }}
            endActions={
              <div className='flex gap-2'>
                <Button variant='outline' onClick={() => setImportOpen(true)}>
                  <Upload className='h-4 w-4 sm:mr-2' />
                  <span className='hidden sm:inline'>Importar proveedores</span>
                </Button>
                <Button
                  onClick={() => {
                    setEditingSupplier(null)
                    setFormDirty(false)
                    setFormOpen(true)
                  }}
                >
                  <Plus className='h-4 w-4 sm:mr-2' />
                  <span className='hidden sm:inline'>Nuevo proveedor</span>
                </Button>
              </div>
            }
          />
          <div className='flex flex-wrap gap-3'>
            <Input
              placeholder='Buscar por nombre, razón social o RUC/NIT...'
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className='flex-1 min-w-[200px]'
            />
            {families.length > 1 && (
              <FamilyCombobox
                families={families}
                value={familyFilter}
                onValueChange={setFamilyFilter}
                allowAll
                allowClear
                popoverWidth='240px'
                className='w-full sm:w-52'
              />
            )}
            <Select value={activeFilter} onValueChange={setActiveFilter}>
              <SelectTrigger className='w-full sm:w-36'>
                <SelectValue placeholder='Estado' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos</SelectItem>
                <SelectItem value='true'>Activos</SelectItem>
                <SelectItem value='false'>Inactivos</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={creditFilter}
              onValueChange={v => setCreditFilter(v as 'all' | 'high' | 'ok')}
            >
              <SelectTrigger className='w-full sm:w-48'>
                <SelectValue placeholder='Crédito' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Crédito: todos</SelectItem>
                <SelectItem value='high'>Compromiso alto</SelectItem>
                <SelectItem value='ok'>Dentro de referencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabla */}
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey='name'
                    currentSort={getSortIcon('name')}
                    onSort={requestSort}
                  >
                    Nombre
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='type'
                    currentSort={getSortIcon('type')}
                    onSort={requestSort}
                    className='hidden md:table-cell'
                  >
                    Tipo
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='family.name'
                    currentSort={getSortIcon('family.name')}
                    onSort={requestSort}
                    className='hidden md:table-cell'
                  >
                    Área
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='taxId'
                    currentSort={getSortIcon('taxId')}
                    onSort={requestSort}
                    className='hidden lg:table-cell'
                  >
                    RUC / NIT
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='email'
                    currentSort={getSortIcon('email')}
                    onSort={requestSort}
                    className='hidden xl:table-cell'
                  >
                    Email
                  </SortableTableHead>
                  <TableHead className='hidden lg:table-cell'>Plazo</TableHead>
                  <TableHead className='hidden xl:table-cell'>Crédito</TableHead>
                  <SortableTableHead
                    sortKey='isActive'
                    currentSort={getSortIcon('isActive')}
                    onSort={requestSort}
                  >
                    Estado
                  </SortableTableHead>
                  <TableHead className='hidden lg:table-cell text-center'>Ctr./Mant.</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className='text-center py-8 text-muted-foreground'>
                      <RefreshCw className='h-4 w-4 animate-spin mx-auto mb-2' />
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : suppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className='text-center py-8 text-muted-foreground'>
                      No se encontraron proveedores
                      {activeFilter === 'true' && (
                        <p className='text-xs mt-1'>
                          <button className='underline' onClick={() => setActiveFilter('all')}>
                            Ver todos
                          </button>
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSuppliers.map(s => (
                    <TableRow
                      key={s.id}
                      className='cursor-pointer hover:bg-muted/50'
                      onClick={() => router.push(`/inventory/suppliers/${s.id}`)}
                    >
                      <TableCell className='font-medium'>
                        <div>{s.name}</div>
                        {s.legalName && s.legalName !== s.name && (
                          <div className='text-xs text-muted-foreground truncate max-w-[14rem]'>
                            {s.legalName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground hidden md:table-cell'>
                        {s.supplierType?.name ?? s.type ?? '—'}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground hidden md:table-cell'>
                        {s.family?.name ?? '—'}
                      </TableCell>
                      <TableCell className='text-muted-foreground hidden lg:table-cell'>
                        {s.taxId || '—'}
                      </TableCell>
                      <TableCell className='text-muted-foreground hidden xl:table-cell'>
                        {s.email || '—'}
                      </TableCell>
                      <TableCell className='text-muted-foreground hidden lg:table-cell'>
                        {s.paymentTermsDays == null
                          ? '—'
                          : s.paymentTermsDays === 0
                            ? 'Contado'
                            : `${s.paymentTermsDays}`}
                      </TableCell>
                      <TableCell className='text-muted-foreground hidden xl:table-cell'>
                        <div className='flex flex-col gap-1 items-start'>
                          <span>
                            {s.creditLimit != null
                              ? `${Number(s.creditLimit).toLocaleString()} ${s.creditCurrency || 'USD'}`
                              : '—'}
                          </span>
                          {s.commercialSummary?.referenceStatus === 'high' && (
                            <Badge variant='destructive' className='text-[10px] px-1.5 py-0'>
                              Compromiso alto
                            </Badge>
                          )}
                          {s.commercialSummary?.referenceStatus === 'ok' &&
                            s.commercialSummary?.openContracts > 0 &&
                            s.creditLimit != null && (
                              <Badge variant='outline' className='text-[10px] px-1.5 py-0'>
                                Dentro de ref.
                              </Badge>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.isActive ? 'default' : 'secondary'}>
                          {s.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className='hidden lg:table-cell text-center'>
                        <div className='inline-flex items-center gap-1.5 justify-center'>
                          {(s._count?.contracts ?? 0) > 0 ? (
                            <a
                              href={`/inventory/contracts?supplierId=${s.id}`}
                              onClick={e => e.stopPropagation()}
                              className='inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors'
                              title='Ver contratos de este proveedor'
                            >
                              C{s._count.contracts}
                            </a>
                          ) : null}
                          {(s._count?.maintenances ?? 0) > 0 ? (
                            <a
                              href={`/inventory/maintenance?supplierId=${s.id}`}
                              onClick={e => e.stopPropagation()}
                              className='inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80 transition-colors'
                              title='Ver mantenimientos de este proveedor'
                            >
                              M{s._count.maintenances}
                            </a>
                          ) : null}
                          {(s._count?.contracts ?? 0) === 0 &&
                            (s._count?.maintenances ?? 0) === 0 && (
                              <span className='text-xs text-muted-foreground'>—</span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            title='Editar'
                            onClick={e => {
                              e.stopPropagation()
                              setEditingSupplier(s)
                              setFormDirty(false)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                          {isAdmin && s.isActive && (
                            <Button
                              variant='ghost'
                              size='icon'
                              title='Desactivar'
                              onClick={e => {
                                e.stopPropagation()
                                setDeactivatingSupplier(s)
                              }}
                            >
                              <PowerOff className='h-4 w-4 text-destructive' />
                            </Button>
                          )}
                          {isAdmin && !s.isActive && (
                            <Button
                              variant='ghost'
                              size='icon'
                              title='Reactivar'
                              disabled={reactivatingId === s.id}
                              onClick={e => {
                                e.stopPropagation()
                                handleReactivate(s)
                              }}
                            >
                              <Power className='h-4 w-4 text-primary' />
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              variant='ghost'
                              size='icon'
                              title='Eliminar permanentemente (Solo Super Admin)'
                              onClick={e => {
                                e.stopPropagation()
                                setDeletingSupplier(s)
                              }}
                            >
                              <Trash2 className='h-4 w-4 text-destructive' />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.pages > 1 && (
            <div className='flex items-center justify-between pt-4'>
              <p className='text-sm text-muted-foreground'>
                {pagination.total} proveedor{pagination.total !== 1 ? 'es' : ''} en total
              </p>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <span className='text-sm text-muted-foreground'>
                  Página {page} de {pagination.pages}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={page >= pagination.pages || loading}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value='types'>
          <SupplierTypesSection families={families} />
        </TabsContent>

        <TabsContent value='evaluations'>
          <SupplierEvaluationsTab />
        </TabsContent>
      </Tabs>

      {/* Dialog formulario */}
      <Dialog open={formOpen} onOpenChange={handleFormOpenChange}>
        <DialogContent
          className='w-[min(98vw,56rem)] max-w-4xl max-h-[92vh] overflow-y-auto'
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={editingSupplier}
            onDirtyChange={setFormDirty}
            onSuccess={() => {
              setFormDirty(false)
              setFormOpen(false)
              setEditingSupplier(null)
              fetchSuppliers()
            }}
            onCancel={closeSupplierForm}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className='w-[min(98vw,52rem)] max-w-3xl max-h-[92vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Importar proveedores desde Excel</DialogTitle>
          </DialogHeader>
          <SupplierImportDialog
            onCancel={() => setImportOpen(false)}
            onDone={() => {
              setImportOpen(false)
              fetchSuppliers()
            }}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialog desactivar */}
      <AlertDialog
        open={!!deactivatingSupplier}
        onOpenChange={o => !o && setDeactivatingSupplier(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Desactivar &quot;{deactivatingSupplier?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El proveedor quedará inactivo y no aparecerá en nuevos formularios. Solo se puede
              desactivar si no tiene equipos, suministros o licencias asociados actualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivating}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deactivating ? 'Verificando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog eliminar (Solo SuperAdmin) */}
      <AlertDialog open={!!deletingSupplier} onOpenChange={o => !o && setDeletingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar &quot;{deletingSupplier?.name}&quot; permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. El proveedor y todos sus datos serán eliminados del
              sistema. Solo es posible si no tiene activos asociados. La auditoría quedará
              registrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

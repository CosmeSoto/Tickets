'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, PowerOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { SupplierForm } from '@/components/inventory/suppliers/SupplierForm'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { FamilyCombobox, type FamilyOption } from '@/components/ui/family-combobox'
import { useInventoryFamilies } from '@/contexts/families-context'
import { useFamilyOptions } from '@/hooks/use-family-options'

export default function SuppliersPage() {
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('true')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [deactivatingSupplier, setDeactivatingSupplier] = useState<any>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Familias de inventario desde el contexto global (cache Redis, sin peticion extra) - memoizadas
  const { families } = useFamilyOptions()

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (activeFilter !== 'all') params.set('active', activeFilter)
    if (familyFilter !== 'all') params.set('familyId', familyFilter)
    try {
      const res = await fetch(`/api/inventory/suppliers?${params}`)
      if (!res.ok) throw new Error('Error al cargar')
      const data = await res.json()
      setSuppliers(Array.isArray(data) ? data : (data.suppliers ?? []))
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los proveedores', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter, familyFilter, toast])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  // Exportación
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'proveedores',
    title: 'Proveedores',
    getData: () => suppliers,
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'supplierType', label: 'Tipo', format: v => v?.name ?? '' },
      { key: 'family', label: 'Área', format: v => v?.name ?? '' },
      { key: 'taxId', label: 'RUC / NIT', format: v => v ?? '' },
      { key: 'email', label: 'Email', format: v => v ?? '' },
      { key: 'phone', label: 'Teléfono', format: v => v ?? '' },
      { key: 'contactName', label: 'Contacto', format: v => v ?? '' },
      { key: 'isActive', label: 'Estado', format: v => v ? 'Activo' : 'Inactivo' },
    ],
  })

  const handleDeactivate = async () => {
    if (!deactivatingSupplier) return
    setDeactivating(true)
    try {
      const res = await fetch(`/api/inventory/suppliers/${deactivatingSupplier.id}`, { method: 'PATCH' })
      const data = await res.json()
      if (!res.ok) {
        // 409 = tiene activos asociados
        toast({ title: 'No se puede desactivar', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Proveedor desactivado', description: deactivatingSupplier.name })
      setDeactivatingSupplier(null)
      fetchSuppliers()
    } catch {
      toast({ title: 'Error', description: 'No se pudo desactivar el proveedor', variant: 'destructive' })
    } finally {
      setDeactivating(false)
    }
  }

  const total = suppliers.length

  return (
    <ModuleLayout
      title="Proveedores"
      subtitle={`${total} proveedor${total !== 1 ? 'es' : ''} ${activeFilter === 'true' ? 'activos' : activeFilter === 'false' ? 'inactivos' : 'en total'}`}
      headerActions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchSuppliers} disabled={loading}>
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button onClick={() => { setEditingSupplier(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nuevo proveedor</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nombre o RUC/NIT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          {families.length > 1 && (
            <FamilyCombobox
              families={families}
              value={familyFilter}
              onValueChange={setFamilyFilter}
              allowAll
              allowClear
              popoverWidth="240px"
              className="w-full sm:w-52"
            />
          )}
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Activos</SelectItem>
              <SelectItem value="false">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
            disabled={suppliers.length === 0}
          />
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Área</TableHead>
                <TableHead className="hidden lg:table-cell">RUC / NIT</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="hidden xl:table-cell">Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron proveedores
                    {activeFilter === 'true' && (
                      <p className="text-xs mt-1">
                        <button className="underline" onClick={() => setActiveFilter('all')}>Ver todos</button>
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              ) : suppliers.map(s => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => { setEditingSupplier(s); setFormOpen(true) }}
                >
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {s.supplierType?.name ?? s.type ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {s.family?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">{s.taxId || '—'}</TableCell>
                  <TableCell className="text-muted-foreground hidden lg:table-cell">{s.email || '—'}</TableCell>
                  <TableCell className="text-muted-foreground hidden xl:table-cell">{s.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.isActive ? 'default' : 'secondary'}>
                      {s.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" title="Editar"
                        onClick={(e) => { e.stopPropagation(); setEditingSupplier(s); setFormOpen(true) }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {s.isActive && (
                        <Button
                          variant="ghost" size="icon" title="Desactivar"
                          onClick={(e) => { e.stopPropagation(); setDeactivatingSupplier(s) }}
                        >
                          <PowerOff className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={editingSupplier}
            onSuccess={() => { setFormOpen(false); fetchSuppliers() }}
            onCancel={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* AlertDialog desactivar */}
      <AlertDialog open={!!deactivatingSupplier} onOpenChange={o => !o && setDeactivatingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar "{deactivatingSupplier?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              El proveedor quedará inactivo y no aparecerá en nuevos formularios.
              Solo se puede desactivar si no tiene equipos, consumibles o licencias asociados actualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivating ? 'Verificando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

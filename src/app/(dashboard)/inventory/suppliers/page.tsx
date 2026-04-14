'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, PowerOff, Building2, RefreshCw } from 'lucide-react'
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
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { SupplierForm } from '@/components/inventory/suppliers/SupplierForm'

export default function SuppliersPage() {
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('true')  // por defecto solo activos
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [deactivatingSupplier, setDeactivatingSupplier] = useState<any>(null)
  const [deactivating, setDeactivating] = useState(false)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (activeFilter !== 'all') params.set('active', activeFilter)
    try {
      const res = await fetch(`/api/inventory/suppliers?${params}`)
      if (!res.ok) throw new Error('Error al cargar')
      const data = await res.json()
      // La API devuelve el array directamente (no envuelto en { suppliers: [] })
      setSuppliers(Array.isArray(data) ? data : (data.suppliers ?? []))
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los proveedores', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, activeFilter, toast])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

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
    <RoleDashboardLayout
      title="Proveedores"
      subtitle={`${total} proveedor${total !== 1 ? 'es' : ''} ${activeFilter === 'true' ? 'activos' : activeFilter === 'false' ? 'inactivos' : 'en total'}`}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Proveedores</h1>
              <p className="text-sm text-muted-foreground">
                {total} proveedor{total !== 1 ? 'es' : ''} {activeFilter === 'true' ? 'activos' : activeFilter === 'false' ? 'inactivos' : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSuppliers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button onClick={() => { setEditingSupplier(null); setFormOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo proveedor
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Buscar por nombre o RUC/NIT..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="true">Activos</SelectItem>
              <SelectItem value="false">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabla */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>RUC / NIT</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {s.supplierType?.name ?? s.type ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.family?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.taxId || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{s.email || '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{s.phone || '—'}</TableCell>
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
    </RoleDashboardLayout>
  )
}

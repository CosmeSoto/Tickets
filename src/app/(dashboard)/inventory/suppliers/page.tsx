'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, PowerOff, Building2 } from 'lucide-react'
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

const TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Equipos',
  CONSUMABLE: 'Consumibles',
  LICENSE: 'Licencias',
  MIXED: 'Mixto',
}

const TYPE_COLORS: Record<string, string> = {
  EQUIPMENT: 'bg-blue-100 text-blue-800',
  CONSUMABLE: 'bg-green-100 text-green-800',
  LICENSE: 'bg-purple-100 text-purple-800',
  MIXED: 'bg-orange-100 text-orange-800',
}

export default function SuppliersPage() {
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<any>(null)
  const [deactivatingSupplier, setDeactivatingSupplier] = useState<any>(null)

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (activeFilter !== 'all') params.set('active', activeFilter)
    params.set('limit', '50')
    try {
      const res = await fetch(`/api/inventory/suppliers?${params}`)
      const data = await res.json()
      setSuppliers(data.suppliers || [])
      setTotal(data.total || 0)
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los proveedores', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, activeFilter, toast])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const handleDeactivate = async () => {
    if (!deactivatingSupplier) return
    try {
      const res = await fetch(`/api/inventory/suppliers/${deactivatingSupplier.id}`, { method: 'PATCH' })
      if (!res.ok) throw new Error('Error al desactivar')
      toast({ title: 'Proveedor desactivado', description: deactivatingSupplier.name })
      setDeactivatingSupplier(null)
      fetchSuppliers()
    } catch {
      toast({ title: 'Error', description: 'No se pudo desactivar el proveedor', variant: 'destructive' })
    }
  }

  return (
    <RoleDashboardLayout title="Proveedores" subtitle={`${total} proveedor${total !== 1 ? 'es' : ''} registrado${total !== 1 ? 's' : ''}`}>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Proveedores</h1>
            <p className="text-sm text-muted-foreground">{total} proveedor{total !== 1 ? 'es' : ''} registrado{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={() => { setEditingSupplier(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo proveedor
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre o RUC/NIT..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
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
              <TableHead>RUC / NIT</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : suppliers.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron proveedores</TableCell></TableRow>
            ) : suppliers.map(s => (
              <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setEditingSupplier(s); setFormOpen(true) }}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[s.type] || ''}`}>
                    {TYPE_LABELS[s.type] || s.type}
                  </span>
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
                    <Button variant="ghost" size="icon" title="Editar" onClick={(e) => { e.stopPropagation(); setEditingSupplier(s); setFormOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {s.isActive && (
                      <Button variant="ghost" size="icon" title="Desactivar" onClick={(e) => { e.stopPropagation(); setDeactivatingSupplier(s) }}>
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

      {/* Dialog formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
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
            <AlertDialogTitle>¿Desactivar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              El proveedor <strong>{deactivatingSupplier?.name}</strong> quedará inactivo. Sus asociaciones existentes con equipos, consumibles y licencias se conservarán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </RoleDashboardLayout>
  )
}

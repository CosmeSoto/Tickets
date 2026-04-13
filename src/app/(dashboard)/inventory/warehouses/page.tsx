'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DialogDescription,
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Warehouse, Loader2, ToggleLeft, ToggleRight, MapPin, User } from 'lucide-react'

interface Warehouse {
  id: string
  name: string
  location?: string | null
  description?: string | null
  managerId?: string | null
  manager?: { id: string; name: string; email: string } | null
  isActive: boolean
}

export default function WarehousesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingWarehouse, setTogglingWarehouse] = useState<Warehouse | null>(null)
  const [toggling, setToggling] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    managerId: '',
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (session.user.role !== 'ADMIN') { router.push('/unauthorized'); return }
    fetchWarehouses()
  }, [session, status, router])

  const fetchWarehouses = async () => {
    try {
      const res = await fetch(`/api/inventory/warehouses?includeInactive=true&_t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setWarehouses(Array.isArray(data) ? data : (data.warehouses ?? []))
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las bodegas', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingWarehouse(warehouse)
      setFormData({
        name: warehouse.name,
        location: warehouse.location ?? '',
        description: warehouse.description ?? '',
        managerId: warehouse.managerId ?? '',
      })
    } else {
      setEditingWarehouse(null)
      setFormData({ name: '', location: '', description: '', managerId: '' })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const url = editingWarehouse
        ? `/api/inventory/warehouses/${editingWarehouse.id}`
        : '/api/inventory/warehouses'
      const method = editingWarehouse ? 'PUT' : 'POST'
      const payload = {
        ...formData,
        managerId: formData.managerId.trim() || null,
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast({ title: editingWarehouse ? 'Bodega actualizada' : 'Bodega creada', description: `"${formData.name}" guardada exitosamente` })
        setDialogOpen(false)
        await fetchWarehouses()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al guardar', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmToggle = async () => {
    if (!togglingWarehouse) return
    setToggling(true)
    try {
      const res = await fetch(`/api/inventory/warehouses/${togglingWarehouse.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !togglingWarehouse.isActive }),
      })
      if (res.ok) {
        toast({ title: togglingWarehouse.isActive ? 'Bodega desactivada' : 'Bodega activada', description: `"${togglingWarehouse.name}" actualizada` })
        await fetchWarehouses()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al cambiar estado', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setToggling(false)
      setTogglingWarehouse(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title='Bodegas' subtitle='Gestión de bodegas'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Bodegas'
      subtitle='Gestiona las bodegas de almacenamiento del inventario'
      headerActions={
        <Button onClick={() => handleOpenDialog()}>
          <Plus className='h-4 w-4 mr-2' />
          Nueva Bodega
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Warehouse className='h-5 w-5 mr-2 text-primary' />
            Bodegas
          </CardTitle>
          <CardDescription>
            Espacios de almacenamiento donde se guardan los activos del inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Gestor Responsable</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-center text-muted-foreground'>
                    No hay bodegas registradas
                  </TableCell>
                </TableRow>
              ) : (
                warehouses.map((warehouse) => (
                  <TableRow key={warehouse.id} className='cursor-pointer hover:bg-muted/50' onClick={() => handleOpenDialog(warehouse)}>
                    <TableCell className='font-medium'>{warehouse.name}</TableCell>
                    <TableCell>
                      {warehouse.location ? (
                        <span className='flex items-center gap-1 text-sm text-muted-foreground'>
                          <MapPin className='h-3 w-3' />
                          {warehouse.location}
                        </span>
                      ) : (
                        <span className='text-muted-foreground'>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {warehouse.manager ? (
                        <span className='flex items-center gap-1 text-sm'>
                          <User className='h-3 w-3 text-muted-foreground' />
                          {warehouse.manager.name}
                        </span>
                      ) : (
                        <span className='text-muted-foreground text-sm'>Sin asignar</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={warehouse.isActive ? 'default' : 'secondary'}>
                        {warehouse.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button variant='ghost' size='sm' onClick={(e) => { e.stopPropagation(); handleOpenDialog(warehouse) }}>
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button variant='ghost' size='sm' onClick={(e) => { e.stopPropagation(); setTogglingWarehouse(warehouse) }}>
                          {warehouse.isActive
                            ? <ToggleRight className='h-4 w-4 text-green-600' />
                            : <ToggleLeft className='h-4 w-4 text-muted-foreground' />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? 'Editar Bodega' : 'Nueva Bodega'}</DialogTitle>
            <DialogDescription>
              {editingWarehouse ? 'Modifica los datos de la bodega' : 'Completa los datos para crear una nueva bodega'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Nombre <span className='text-destructive'>*</span></Label>
              <Input
                id='name'
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder='Bodega Principal'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='location'>Ubicación</Label>
              <Input
                id='location'
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder='Piso 1, Sector B'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='description'>Descripción</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder='Descripción opcional de la bodega'
                rows={3}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='managerId'>ID del Gestor Responsable</Label>
              <Input
                id='managerId'
                value={formData.managerId}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                placeholder='UUID del gestor (opcional)'
              />
              <p className='text-xs text-muted-foreground'>Dejar vacío si no hay gestor asignado</p>
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                {editingWarehouse ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!togglingWarehouse} onOpenChange={(open) => !open && setTogglingWarehouse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {togglingWarehouse?.isActive ? '¿Desactivar bodega?' : '¿Activar bodega?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {togglingWarehouse?.isActive
                ? <>Estás a punto de desactivar la bodega <span className='font-semibold text-foreground'>"{togglingWarehouse?.name}"</span>. No estará disponible para asignar activos hasta que se reactive.</>
                : <>Estás a punto de activar la bodega <span className='font-semibold text-foreground'>"{togglingWarehouse?.name}"</span>. Volverá a estar disponible en el sistema.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} disabled={toggling}>
              {toggling && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              {togglingWarehouse?.isActive ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}

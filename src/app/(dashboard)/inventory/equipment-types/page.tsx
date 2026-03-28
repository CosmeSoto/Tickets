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
import { Plus, Pencil, Trash2, Loader2, Box } from 'lucide-react'
import { IconPicker } from '@/components/inventory/icon-picker'
import { FamilyBadge } from '@/components/inventory/family-badge'

interface EquipmentType {
  id: string
  code: string
  name: string
  description?: string
  icon?: string
  isActive: boolean
  order: number
  familyId?: string | null
  family?: { id: string; name: string; icon?: string | null; color?: string | null } | null
}

interface Family { id: string; name: string; icon?: string | null; color?: string | null }

export default function EquipmentTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [types, setTypes] = useState<EquipmentType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<EquipmentType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingType, setDeletingType] = useState<EquipmentType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [families, setFamilies] = useState<Family[]>([])

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    icon: '',
    order: 999,
    familyId: '',
  })

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    // Permitir acceso a ADMIN y TECHNICIAN
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') {
      router.push('/unauthorized')
      return
    }

    fetchTypes()
    fetch('/api/inventory/families').then(r => r.json()).then(d => setFamilies(d.families ?? []))
  }, [session, status, router])

  const fetchTypes = async () => {
    try {
      const response = await fetch(`/api/admin/equipment-types?includeInactive=true&_t=${Date.now()}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setTypes(data)
      }
    } catch (error) {
      console.error('Error cargando tipos:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los tipos de equipo',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (type?: EquipmentType) => {
    if (type) {
      setEditingType(type)
      setFormData({
        code: type.code,
        name: type.name,
        description: type.description || '',
        icon: type.icon || '',
        order: type.order,
        familyId: type.familyId || '',
      })
    } else {
      setEditingType(null)
      setFormData({ code: '', name: '', description: '', icon: '', order: 999, familyId: '' })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const url = editingType
        ? `/api/admin/equipment-types/${editingType.id}`
        : '/api/admin/equipment-types'
      
      const method = editingType ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast({
          title: editingType ? 'Tipo actualizado' : 'Tipo creado',
          description: `El tipo ${formData.name} ha sido ${editingType ? 'actualizado' : 'creado'} exitosamente`
        })
        setDialogOpen(false)
        await fetchTypes()
      } else {
        const error = await response.json()
        toast({
          title: 'Error',
          description: error.error || 'Error al guardar el tipo',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error guardando tipo:', error)
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (type: EquipmentType) => {
    // Solo ADMIN puede eliminar
    if (session?.user?.role !== 'ADMIN') {
      toast({
        title: 'No autorizado',
        description: 'Solo administradores pueden eliminar tipos de equipo',
        variant: 'destructive'
      })
      return
    }

    setDeletingType(type)
  }

  const confirmDelete = async () => {
    if (!deletingType) return
    setDeleting(true)

    try {
      const response = await fetch(`/api/admin/equipment-types/${deletingType.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()
      if (response.ok) {
        toast({
          title: result.type ? 'Tipo desactivado' : 'Tipo eliminado',
          description: result.message
        })
        await fetchTypes()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Error al eliminar el tipo',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error eliminando tipo:', error)
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive'
      })
    } finally {
      setDeleting(false)
      setDeletingType(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title='Tipos de Equipo' subtitle='Gestión de tipos de equipo'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Tipos de Equipo'
      subtitle='Gestiona los tipos de equipo disponibles en el sistema'
      headerActions={
        <Button onClick={() => handleOpenDialog()}>
          <Plus className='h-4 w-4 mr-2' />
          Nuevo Tipo
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Box className='h-5 w-5 mr-2 text-primary' />
            Tipos de Equipo
          </CardTitle>
          <CardDescription>
            Administra los tipos de equipo que pueden ser asignados en el inventario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Familia</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Ícono</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='text-center text-muted-foreground'>
                    No hay tipos de equipo registrados
                  </TableCell>
                </TableRow>
              ) : (
                types.map((type) => (
                  <TableRow
                    key={type.id}
                    className='cursor-pointer hover:bg-muted/50'
                    onClick={() => handleOpenDialog(type)}
                  >
                    <TableCell className='font-mono text-sm'>{type.code}</TableCell>
                    <TableCell className='font-medium'>{type.name}</TableCell>
                    <TableCell>
                      {type.family ? <FamilyBadge family={type.family} size='sm' /> : <span className='text-xs text-muted-foreground'>Sin familia</span>}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground'>
                      {type.description || '-'}
                    </TableCell>
                    <TableCell className='text-sm'>{type.icon || '-'}</TableCell>
                    <TableCell>{type.order}</TableCell>
                    <TableCell>
                      <Badge variant={type.isActive ? 'default' : 'secondary'}>
                        {type.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button variant='ghost' size='sm' onClick={(e) => { e.stopPropagation(); handleOpenDialog(type) }}>
                          <Pencil className='h-4 w-4' />
                        </Button>
                        {session?.user?.role === 'ADMIN' && (
                          <Button variant='ghost' size='sm' onClick={(e) => { e.stopPropagation(); handleDelete(type) }}>
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Editar Tipo de Equipo' : 'Nuevo Tipo de Equipo'}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? 'Modifica los datos del tipo de equipo'
                : 'Completa los datos para crear un nuevo tipo de equipo'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='code'>
                Código <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='code'
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder='LAPTOP'
                disabled={!!editingType}
                required
              />
              <p className='text-xs text-muted-foreground'>
                Identificador único en mayúsculas (no se puede cambiar después)
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='name'>
                Nombre <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='name'
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder='Laptop'
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>Descripción</Label>
              <Textarea
                id='description'
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder='Descripción opcional del tipo de equipo'
                rows={3}
              />
            </div>

            <IconPicker
              value={formData.icon}
              onChange={(icon) => setFormData({ ...formData, icon })}
            />

            <div className='space-y-2'>
              <Label htmlFor='order'>Orden</Label>
              <Input
                id='order'
                type='number'
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                placeholder='999'
              />
              <p className='text-xs text-muted-foreground'>
                Orden de aparición en el dropdown (menor número = primero)
              </p>
            </div>

            <div className='space-y-2'>
              <Label>Familia</Label>
              <select
                value={formData.familyId}
                onChange={e => setFormData({ ...formData, familyId: e.target.value })}
                className='flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              >
                <option value=''>Sin familia asignada</option>
                {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <p className='text-xs text-muted-foreground'>Asigna este tipo a una familia para que aparezca filtrado en el formulario de activos</p>
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                {editingType ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingType} onOpenChange={(open) => !open && setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el tipo{' '}
              <span className="font-semibold text-foreground">"{deletingType?.name}"</span>.
              <br /><br />
              Si hay equipos usando este tipo, será desactivado en lugar de eliminado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}

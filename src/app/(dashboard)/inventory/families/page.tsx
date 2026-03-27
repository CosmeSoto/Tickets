'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Plus, Pencil, Layers, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import { FamilyBadge } from '@/components/inventory/family-badge'

interface Family {
  id: string
  code: string
  name: string
  icon?: string | null
  color?: string | null
  order: number
  isActive: boolean
}

export default function FamiliesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingFamily, setTogglingFamily] = useState<Family | null>(null)
  const [toggling, setToggling] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    color: '#6B7280',
    order: 999,
  })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (session.user.role !== 'ADMIN') { router.push('/unauthorized'); return }
    fetchFamilies()
  }, [session, status, router])

  const fetchFamilies = async () => {
    try {
      const res = await fetch(`/api/inventory/families?includeInactive=true&_t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setFamilies(Array.isArray(data) ? data : (data.families ?? []))
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las familias', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenDialog = (family?: Family) => {
    if (family) {
      setEditingFamily(family)
      setFormData({ name: family.name, icon: family.icon ?? '', color: family.color ?? '#6B7280', order: family.order })
    } else {
      setEditingFamily(null)
      setFormData({ name: '', icon: '', color: '#6B7280', order: 999 })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const url = editingFamily
        ? `/api/inventory/families/${editingFamily.id}`
        : '/api/inventory/families'
      const method = editingFamily ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: editingFamily ? 'Familia actualizada' : 'Familia creada', description: `"${formData.name}" guardada exitosamente` })
        setDialogOpen(false)
        await fetchFamilies()
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
    if (!togglingFamily) return
    setToggling(true)
    try {
      const res = await fetch(`/api/inventory/families/${togglingFamily.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !togglingFamily.isActive }),
      })
      if (res.ok) {
        toast({ title: togglingFamily.isActive ? 'Familia desactivada' : 'Familia activada', description: `"${togglingFamily.name}" actualizada` })
        await fetchFamilies()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al cambiar estado', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setToggling(false)
      setTogglingFamily(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title='Familias de Inventario' subtitle='Gestión de familias'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Familias de Inventario'
      subtitle='Gestiona las familias de activos disponibles en el sistema'
      headerActions={
        <Button onClick={() => handleOpenDialog()}>
          <Plus className='h-4 w-4 mr-2' />
          Nueva Familia
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Layers className='h-5 w-5 mr-2 text-primary' />
            Familias de Inventario
          </CardTitle>
          <CardDescription>
            Categorías de activos para organizar el inventario del centro comercial
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Familia</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Ícono</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {families.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className='text-center text-muted-foreground'>
                    No hay familias registradas
                  </TableCell>
                </TableRow>
              ) : (
                families.map((family) => (
                  <TableRow key={family.id}>
                    <TableCell>
                      <FamilyBadge family={family} size='sm' />
                    </TableCell>
                    <TableCell className='font-mono text-sm'>{family.code}</TableCell>
                    <TableCell className='text-sm text-muted-foreground'>{family.icon || '-'}</TableCell>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <div
                          className='w-5 h-5 rounded-full border'
                          style={{ backgroundColor: family.color ?? '#6B7280' }}
                        />
                        <span className='text-xs font-mono text-muted-foreground'>{family.color ?? '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{family.order}</TableCell>
                    <TableCell>
                      <Badge variant={family.isActive ? 'default' : 'secondary'}>
                        {family.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex justify-end gap-2'>
                        <Button variant='ghost' size='sm' onClick={() => handleOpenDialog(family)}>
                          <Pencil className='h-4 w-4' />
                        </Button>
                        <Button variant='ghost' size='sm' onClick={() => setTogglingFamily(family)}>
                          {family.isActive
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFamily ? 'Editar Familia' : 'Nueva Familia'}</DialogTitle>
            <DialogDescription>
              {editingFamily ? 'Modifica los datos de la familia' : 'Completa los datos para crear una nueva familia'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Nombre <span className='text-destructive'>*</span></Label>
              <Input
                id='name'
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder='Activos Fijos e Infraestructura'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='icon'>Ícono (lucide-react)</Label>
              <Input
                id='icon'
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder='building-2'
              />
              <p className='text-xs text-muted-foreground'>Nombre del ícono de lucide-react (ej: building-2, wrench, shield)</p>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='color'>Color</Label>
              <div className='flex items-center gap-2'>
                <input
                  id='color'
                  type='color'
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className='h-9 w-14 cursor-pointer rounded border border-input bg-background p-1'
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder='#6B7280'
                  className='font-mono'
                />
              </div>
            </div>
            <div className='space-y-2'>
              <Label htmlFor='order'>Orden</Label>
              <Input
                id='order'
                type='number'
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 999 })}
                placeholder='999'
              />
              <p className='text-xs text-muted-foreground'>Menor número = aparece primero</p>
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                {editingFamily ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!togglingFamily} onOpenChange={(open) => !open && setTogglingFamily(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {togglingFamily?.isActive ? '¿Desactivar familia?' : '¿Activar familia?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {togglingFamily?.isActive
                ? <>Estás a punto de desactivar la familia <span className='font-semibold text-foreground'>"{togglingFamily?.name}"</span>. No aparecerá en selectores ni filtros hasta que se reactive.</>
                : <>Estás a punto de activar la familia <span className='font-semibold text-foreground'>"{togglingFamily?.name}"</span>. Volverá a estar disponible en el sistema.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggle} disabled={toggling}>
              {toggling && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              {togglingFamily?.isActive ? 'Desactivar' : 'Activar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}

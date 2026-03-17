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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Loader2, ShoppingCart } from 'lucide-react'
import { IconPicker } from '@/components/inventory/icon-picker'

interface ConsumableType {
  id: string; code: string; name: string; description?: string; icon?: string; isActive: boolean; order: number
}

export default function ConsumableTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [types, setTypes] = useState<ConsumableType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<ConsumableType | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingType, setDeletingType] = useState<ConsumableType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({ code: '', name: '', description: '', icon: '', order: 999 })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') { router.push('/unauthorized'); return }
    fetchTypes()
  }, [session, status, router])

  const fetchTypes = async () => {
    try {
      const res = await fetch(`/api/inventory/consumable-types?includeInactive=true&_t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) setTypes(await res.json())
    } catch { toast({ title: 'Error', description: 'No se pudieron cargar los tipos', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  const handleOpenDialog = (type?: ConsumableType) => {
    if (type) {
      setEditingType(type)
      setFormData({ code: type.code, name: type.name, description: type.description || '', icon: type.icon || '', order: type.order })
    } else {
      setEditingType(null)
      setFormData({ code: '', name: '', description: '', icon: '', order: 999 })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const url = editingType ? `/api/inventory/consumable-types/${editingType.id}` : '/api/inventory/consumable-types'
      const res = await fetch(url, { method: editingType ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) {
        toast({ title: editingType ? 'Tipo actualizado' : 'Tipo creado', description: `El tipo ${formData.name} ha sido ${editingType ? 'actualizado' : 'creado'} exitosamente` })
        setDialogOpen(false); await fetchTypes()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al guardar', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }) }
    finally { setSubmitting(false) }
  }

  const confirmDelete = async () => {
    if (!deletingType) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/consumable-types/${deletingType.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok) { toast({ title: result.type ? 'Tipo desactivado' : 'Tipo eliminado', description: result.message }); await fetchTypes() }
      else { toast({ title: 'Error', description: result.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }) }
    finally { setDeleting(false); setDeletingType(null) }
  }

  if (status === 'loading' || loading) {
    return <RoleDashboardLayout title="Tipos de Consumible" subtitle="Gestión"><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></RoleDashboardLayout>
  }

  return (
    <RoleDashboardLayout title="Tipos de Consumible" subtitle="Gestiona los tipos de consumible disponibles" headerActions={<Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Nuevo Tipo</Button>}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><ShoppingCart className="h-5 w-5 mr-2 text-primary" />Tipos de Consumible</CardTitle>
          <CardDescription>Administra los tipos de consumible del inventario</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Descripción</TableHead><TableHead>Ícono</TableHead><TableHead>Orden</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {types.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay tipos registrados</TableCell></TableRow>
              ) : types.map(type => (
                <TableRow key={type.id}>
                  <TableCell className="font-mono text-sm">{type.code}</TableCell>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{type.description || '-'}</TableCell>
                  <TableCell className="text-sm">{type.icon || '-'}</TableCell>
                  <TableCell>{type.order}</TableCell>
                  <TableCell><Badge variant={type.isActive ? 'default' : 'secondary'}>{type.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(type)}><Pencil className="h-4 w-4" /></Button>
                      {session?.user?.role === 'ADMIN' && <Button variant="ghost" size="sm" onClick={() => setDeletingType(type)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingType ? 'Editar Tipo' : 'Nuevo Tipo de Consumible'}</DialogTitle><DialogDescription>{editingType ? 'Modifica los datos del tipo' : 'Completa los datos para crear un nuevo tipo'}</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Código *</Label><Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="TONER" disabled={!!editingType} required /><p className="text-xs text-muted-foreground">Identificador único en mayúsculas</p></div>
            <div className="space-y-2"><Label>Nombre *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Tóner" required /></div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
            <IconPicker value={formData.icon} onChange={icon => setFormData({ ...formData, icon })} />
            <div className="space-y-2"><Label>Orden</Label><Input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingType ? 'Actualizar' : 'Crear'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingType} onOpenChange={open => !open && setDeletingType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar tipo de consumible?</AlertDialogTitle><AlertDialogDescription>Estás a punto de eliminar el tipo <span className="font-semibold text-foreground">"{deletingType?.name}"</span>.<br /><br />Si hay consumibles usando este tipo, será desactivado. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}

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
import { Plus, Pencil, Trash2, Loader2, Ruler } from 'lucide-react'

interface UnitOfMeasure {
  id: string; code: string; name: string; symbol: string; description?: string; isActive: boolean; order: number
}

export default function UnitsOfMeasurePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [units, setUnits] = useState<UnitOfMeasure[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<UnitOfMeasure | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingUnit, setDeletingUnit] = useState<UnitOfMeasure | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({ code: '', name: '', symbol: '', description: '', order: 999 })

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (session.user.role !== 'ADMIN' && session.user.role !== 'TECHNICIAN') { router.push('/unauthorized'); return }
    fetchUnits()
  }, [session, status, router])

  const fetchUnits = async () => {
    try {
      const res = await fetch(`/api/inventory/units-of-measure?includeInactive=true&_t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) setUnits(await res.json())
    } catch { toast({ title: 'Error', description: 'No se pudieron cargar las unidades', variant: 'destructive' }) }
    finally { setLoading(false) }
  }

  const handleOpenDialog = (unit?: UnitOfMeasure) => {
    if (unit) {
      setEditingUnit(unit)
      setFormData({ code: unit.code, name: unit.name, symbol: unit.symbol, description: unit.description || '', order: unit.order })
    } else {
      setEditingUnit(null)
      setFormData({ code: '', name: '', symbol: '', description: '', order: 999 })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const url = editingUnit ? `/api/inventory/units-of-measure/${editingUnit.id}` : '/api/inventory/units-of-measure'
      const res = await fetch(url, { method: editingUnit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) {
        toast({ title: editingUnit ? 'Unidad actualizada' : 'Unidad creada', description: `La unidad ${formData.name} (${formData.symbol}) ha sido ${editingUnit ? 'actualizada' : 'creada'}` })
        setDialogOpen(false); await fetchUnits()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'Error al guardar', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }) }
    finally { setSubmitting(false) }
  }

  const confirmDelete = async () => {
    if (!deletingUnit) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/units-of-measure/${deletingUnit.id}`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok) { toast({ title: result.unit ? 'Unidad desactivada' : 'Unidad eliminada', description: result.message }); await fetchUnits() }
      else { toast({ title: 'Error', description: result.error, variant: 'destructive' }) }
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }) }
    finally { setDeleting(false); setDeletingUnit(null) }
  }

  if (status === 'loading' || loading) {
    return <RoleDashboardLayout title="Unidades de Medida" subtitle="Gestión"><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></RoleDashboardLayout>
  }

  return (
    <RoleDashboardLayout title="Unidades de Medida" subtitle="Gestiona las unidades de medida para consumibles" headerActions={<Button onClick={() => handleOpenDialog()}><Plus className="h-4 w-4 mr-2" />Nueva Unidad</Button>}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Ruler className="h-5 w-5 mr-2 text-primary" />Unidades de Medida</CardTitle>
          <CardDescription>Administra las unidades de medida disponibles para consumibles</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Símbolo</TableHead><TableHead>Descripción</TableHead><TableHead>Orden</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {units.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No hay unidades registradas</TableCell></TableRow>
              ) : units.map(unit => (
                <TableRow key={unit.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenDialog(unit)}>
                  <TableCell className="font-mono text-sm">{unit.code}</TableCell>
                  <TableCell className="font-medium">{unit.name}</TableCell>
                  <TableCell><Badge variant="outline">{unit.symbol}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{unit.description || '-'}</TableCell>
                  <TableCell>{unit.order}</TableCell>
                  <TableCell><Badge variant={unit.isActive ? 'default' : 'secondary'}>{unit.isActive ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenDialog(unit) }}><Pencil className="h-4 w-4" /></Button>
                      {session?.user?.role === 'ADMIN' && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeletingUnit(unit) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{editingUnit ? 'Editar Unidad' : 'Nueva Unidad de Medida'}</DialogTitle><DialogDescription>{editingUnit ? 'Modifica los datos de la unidad' : 'Completa los datos para crear una nueva unidad'}</DialogDescription></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Código *</Label><Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="UNIT" disabled={!!editingUnit} required /><p className="text-xs text-muted-foreground">Identificador único en mayúsculas</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nombre *</Label><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Unidad" required /></div>
              <div className="space-y-2"><Label>Símbolo *</Label><Input value={formData.symbol} onChange={e => setFormData({ ...formData, symbol: e.target.value })} placeholder="ud" required /><p className="text-xs text-muted-foreground">Ej: ud, kg, m, L</p></div>
            </div>
            <div className="space-y-2"><Label>Descripción</Label><Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></div>
            <div className="space-y-2"><Label>Orden</Label><Input type="number" value={formData.order} onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editingUnit ? 'Actualizar' : 'Crear'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUnit} onOpenChange={open => !open && setDeletingUnit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar unidad de medida?</AlertDialogTitle><AlertDialogDescription>Estás a punto de eliminar la unidad <span className="font-semibold text-foreground">"{deletingUnit?.name}" ({deletingUnit?.symbol})</span>.<br /><br />Si hay consumibles usando esta unidad, será desactivada. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}

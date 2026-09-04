'use client'

import { useCallback, useEffect, useState } from 'react'
import { Star, Plus, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { SupplierEvaluationDialog } from './SupplierEvaluationDialog'
import {
  QUALIFICATION_CRITERIA,
  CLASSIFICATION_LABELS,
  type SupplierClassification,
} from '@/lib/inventory/supplier-qualification-shared'
import type { SupplierEvaluation } from '@/types/inventory/supplier-evaluation'

function classificationBadgeClass(c: SupplierClassification) {
  if (c === 'A')
    return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400'
  if (c === 'B')
    return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400'
  return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-400'
}

interface SupplierEvaluationsCardProps {
  supplierId: string
  /** Solo ADMIN/SuperAdmin puede registrar/editar/eliminar calificaciones. */
  canManage: boolean
}

export function SupplierEvaluationsCard({ supplierId, canManage }: SupplierEvaluationsCardProps) {
  const [evaluations, setEvaluations] = useState<SupplierEvaluation[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierEvaluation | null>(null)
  const [deleting, setDeleting] = useState<SupplierEvaluation | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/suppliers/${supplierId}/evaluations`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvaluations(Array.isArray(data.evaluations) ? data.evaluations : [])
    } catch {
      setEvaluations([])
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const res = await fetch(`/api/inventory/suppliers/evaluations/${deleting.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast({ title: 'No se pudo eliminar', description: data.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Calificación eliminada' })
      setEvaluations(prev => prev.filter(e => e.id !== deleting.id))
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 gap-2'>
        <CardTitle className='text-base flex items-center gap-2'>
          <Star className='h-4 w-4' />
          Calificación de proveedor
        </CardTitle>
        {canManage && (
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className='h-4 w-4 mr-2' />
            Nueva evaluación
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className='text-sm text-muted-foreground'>Cargando…</p>
        ) : evaluations.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Este proveedor aún no tiene evaluaciones registradas.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b text-xs text-muted-foreground'>
                  <th className='text-left py-2 pr-2'>Año</th>
                  <th className='text-left py-2 pr-2'>Detalle</th>
                  {QUALIFICATION_CRITERIA.map(c => (
                    <th key={c.key} className='text-center py-2 px-1' title={c.label}>
                      {c.label.split(' ')[0]}
                    </th>
                  ))}
                  <th className='text-center py-2 px-1'>Total</th>
                  <th className='text-left py-2 px-1'>Clasificación</th>
                  {canManage && <th className='py-2 pl-2' />}
                </tr>
              </thead>
              <tbody>
                {evaluations.map(ev => (
                  <tr key={ev.id} className='border-b last:border-0'>
                    <td className='py-2 pr-2 font-mono'>{ev.year}</td>
                    <td className='py-2 pr-2 text-muted-foreground'>{ev.detail || '—'}</td>
                    <td className='text-center py-2 px-1'>{ev.quality}</td>
                    <td className='text-center py-2 px-1'>{ev.creditTime}</td>
                    <td className='text-center py-2 px-1'>{ev.deliveryTime}</td>
                    <td className='text-center py-2 px-1'>{ev.price}</td>
                    <td className='text-center py-2 px-1'>{ev.references}</td>
                    <td className='text-center py-2 px-1'>{ev.equipmentScore}</td>
                    <td className='text-center py-2 px-1 font-medium'>{ev.total}</td>
                    <td className='py-2 px-1'>
                      <Badge
                        variant='outline'
                        className={classificationBadgeClass(ev.classification)}
                      >
                        {ev.classification}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className='py-2 pl-2'>
                        <div className='flex justify-end gap-1'>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='h-7 w-7'
                            title='Editar'
                            onClick={() => {
                              setEditing(ev)
                              setDialogOpen(true)
                            }}
                          >
                            <Pencil className='h-3.5 w-3.5' />
                          </Button>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='h-7 w-7 text-destructive hover:text-destructive'
                            title='Eliminar'
                            onClick={() => setDeleting(ev)}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='w-[min(98vw,42rem)] max-w-2xl max-h-[92vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar calificación' : 'Nueva calificación de proveedor'}
            </DialogTitle>
          </DialogHeader>
          <SupplierEvaluationDialog
            supplierId={supplierId}
            evaluation={editing}
            onCancel={() => setDialogOpen(false)}
            onSuccess={ev => {
              setDialogOpen(false)
              setEvaluations(prev => {
                const exists = prev.some(e => e.id === ev.id)
                return exists ? prev.map(e => (e.id === ev.id ? ev : e)) : [ev, ...prev]
              })
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta calificación?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  Calificación {deleting.year}
                  {deleting.detail ? ` · ${deleting.detail}` : ''} (
                  {CLASSIFICATION_LABELS[deleting.classification]}). Esta acción no se puede
                  deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

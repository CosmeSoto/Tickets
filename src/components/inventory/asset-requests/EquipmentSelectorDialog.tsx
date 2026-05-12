/**
 * EquipmentSelectorDialog
 *
 * Diálogo para seleccionar equipos específicos al aprobar una solicitud con quantity > 1
 * - Muestra equipos disponibles del tipo solicitado
 * - Permite seleccionar exactamente `quantity` equipos
 * - Valida que la selección sea correcta antes de permitir aprobar
 * - Muestra columnas: código, serial, condición, ubicación
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, CheckCircle2, Package } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface EquipmentSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestCode: string
  assetTypeId: string
  quantity: number
  onConfirm: (equipmentIds: string[]) => Promise<void>
}

interface AvailableEquipment {
  id: string
  code: string
  serialNumber: string
  condition: string
  location?: string
  brand: string
  model: string
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

export function EquipmentSelectorDialog({
  open,
  onOpenChange,
  requestCode,
  assetTypeId,
  quantity,
  onConfirm,
}: EquipmentSelectorDialogProps) {
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [equipment, setEquipment] = useState<AvailableEquipment[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Cargar equipos disponibles
  useEffect(() => {
    if (!open || !assetTypeId) {
      setEquipment([])
      setSelectedIds(new Set())
      setError(null)
      return
    }

    const fetchEquipment = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/inventory/equipment?typeId=${assetTypeId}&status=AVAILABLE&limit=100`
        )

        if (!res.ok) {
          throw new Error('Error al cargar equipos disponibles')
        }

        const data = await res.json()
        const equipmentList = data.data || data.equipment || []

        if (equipmentList.length < quantity) {
          setError(
            `Solo hay ${equipmentList.length} equipos disponibles, pero se necesitan ${quantity}`
          )
        }

        setEquipment(equipmentList)
      } catch (err: any) {
        setError(err.message || 'Error desconocido')
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los equipos disponibles',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    fetchEquipment()
  }, [open, assetTypeId, quantity, toast])

  const handleToggleSelection = (equipmentId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(equipmentId)) {
        newSet.delete(equipmentId)
      } else {
        // Solo permitir seleccionar hasta `quantity` equipos
        if (newSet.size < quantity) {
          newSet.add(equipmentId)
        } else {
          toast({
            title: 'Límite alcanzado',
            description: `Solo puedes seleccionar ${quantity} equipos`,
            variant: 'destructive',
          })
        }
      }
      return newSet
    })
  }

  const handleConfirm = async () => {
    if (selectedIds.size !== quantity) {
      toast({
        title: 'Selección incompleta',
        description: `Debes seleccionar exactamente ${quantity} equipos. Actualmente tienes ${selectedIds.size} seleccionados.`,
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      await onConfirm(Array.from(selectedIds))
      onOpenChange(false)
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error al aprobar la solicitud',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const isSelectionValid = selectedIds.size === quantity

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>Seleccionar Equipos para Asignar</DialogTitle>
          <DialogDescription>
            Solicitud {requestCode} - Selecciona exactamente {quantity} equipos para asignar
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]'>
          {/* Indicador de progreso */}
          <Alert variant={isSelectionValid ? 'default' : 'destructive'}>
            <Package className='h-4 w-4' />
            <AlertDescription>
              {isSelectionValid ? (
                <span className='flex items-center gap-2'>
                  <CheckCircle2 className='h-4 w-4 text-green-600' />
                  <strong>Selección completa:</strong> {selectedIds.size} de {quantity} equipos
                  seleccionados
                </span>
              ) : (
                <span>
                  <strong>Selecciona equipos:</strong> {selectedIds.size} de {quantity} equipos
                  seleccionados
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Error general */}
          {error && (
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading */}
          {loading && (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
            </div>
          )}

          {/* Tabla de equipos */}
          {!loading && equipment.length > 0 && (
            <div className='border rounded-md'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-12'>Seleccionar</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Marca / Modelo</TableHead>
                    <TableHead>Número de Serie</TableHead>
                    <TableHead>Condición</TableHead>
                    <TableHead>Ubicación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map(eq => (
                    <TableRow key={eq.id} className={selectedIds.has(eq.id) ? 'bg-primary/5' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(eq.id)}
                          onCheckedChange={() => handleToggleSelection(eq.id)}
                          disabled={submitting}
                        />
                      </TableCell>
                      <TableCell className='font-medium'>{eq.code}</TableCell>
                      <TableCell>
                        {eq.brand} {eq.model}
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {eq.serialNumber}
                      </TableCell>
                      <TableCell>
                        <Badge variant='outline'>
                          {CONDITION_LABELS[eq.condition] || eq.condition}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-sm text-muted-foreground'>
                        {eq.location || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Sin equipos disponibles */}
          {!loading && equipment.length === 0 && (
            <Alert>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>No hay equipos disponibles del tipo solicitado</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type='button'
            onClick={handleConfirm}
            disabled={!isSelectionValid || submitting || equipment.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Aprobando...
              </>
            ) : (
              <>
                <CheckCircle2 className='h-4 w-4 mr-2' />
                Aprobar y Asignar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

/**
 * BulkDecommissionModal
 * Modal para dar de baja múltiples equipos
 * Permite establecer razón común y detalles individuales
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2, AlertTriangle, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Equipment {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
}

interface BulkDecommissionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: Equipment[]
  onSuccess: () => void
}

const DECOMMISSION_REASONS = [
  { value: 'OBSOLETE', label: 'Obsoleto' },
  { value: 'DAMAGED', label: 'Dañado irreparable' },
  { value: 'LOST', label: 'Perdido' },
  { value: 'STOLEN', label: 'Robado' },
  { value: 'END_OF_LIFE', label: 'Fin de vida útil' },
  { value: 'DONATION', label: 'Donación' },
  { value: 'OTHER', label: 'Otro' },
]

export function BulkDecommissionModal({
  open,
  onOpenChange,
  equipment,
  onSuccess,
}: BulkDecommissionModalProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [decommissionReason, setDecommissionReason] = useState<string>('OBSOLETE')
  const [commonNotes, setCommonNotes] = useState<string>('')
  const [individualNotes, setIndividualNotes] = useState<Record<string, string>>({})
  const [useIndividualNotes, setUseIndividualNotes] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const handleSubmit = async () => {
    if (!confirmed) {
      toast({
        title: 'Confirmación requerida',
        description: 'Debes confirmar que deseas dar de baja estos equipos',
        variant: 'destructive',
      })
      return
    }

    if (!decommissionReason) {
      toast({
        title: 'Razón requerida',
        description: 'Debes seleccionar una razón para la baja',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/inventory/equipment/bulk-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipmentIds: equipment.map(eq => eq.id),
          action: 'DECOMMISSION',
          decommissionReason,
          decommissionNotes: useIndividualNotes ? undefined : commonNotes,
          individualNotes: useIndividualNotes ? individualNotes : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al dar de baja equipos')
      }

      const result = await response.json()

      toast({
        title: 'Equipos dados de baja',
        description: `Se dieron de baja ${result.updatedCount} equipos`,
      })

      onSuccess()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Error:', err)
      toast({
        title: 'Error',
        description: err.message || 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Dar de Baja Equipos</DialogTitle>
          <DialogDescription>
            Esta acción marcará {equipment.length} equipos como RETIRED (dados de baja)
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Advertencia */}
          <Alert variant='destructive'>
            <AlertTriangle className='h-4 w-4' />
            <AlertDescription>
              <strong>Advertencia:</strong> Esta acción es permanente. Los equipos dados de baja no
              podrán ser asignados ni vendidos. Se generará un registro de auditoría.
            </AlertDescription>
          </Alert>

          {/* Razón de Baja */}
          <div className='space-y-2'>
            <Label htmlFor='decommissionReason'>
              Razón de Baja <span className='text-red-500'>*</span>
            </Label>
            <select
              id='decommissionReason'
              value={decommissionReason}
              onChange={e => setDecommissionReason(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {DECOMMISSION_REASONS.map(reason => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notas Comunes */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <input
                type='checkbox'
                id='useCommonNotes'
                checked={!useIndividualNotes}
                onChange={e => setUseIndividualNotes(!e.target.checked)}
                className='h-4 w-4'
              />
              <Label htmlFor='useCommonNotes'>Usar notas comunes para todos</Label>
            </div>

            {!useIndividualNotes && (
              <Textarea
                value={commonNotes}
                onChange={e => setCommonNotes(e.target.value)}
                placeholder='Detalles sobre la baja...'
                rows={3}
              />
            )}
          </div>

          {/* Notas Individuales */}
          {useIndividualNotes && (
            <div className='space-y-2'>
              <Label>Notas Individuales</Label>
              <div className='border rounded-md max-h-96 overflow-y-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Marca / Modelo</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead className='w-64'>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {equipment.map(eq => (
                      <TableRow key={eq.id}>
                        <TableCell className='font-mono text-sm'>{eq.code}</TableCell>
                        <TableCell>
                          {eq.brand} {eq.model}
                        </TableCell>
                        <TableCell className='text-sm text-gray-600'>{eq.serialNumber}</TableCell>
                        <TableCell>
                          <Textarea
                            value={individualNotes[eq.id] || ''}
                            onChange={e =>
                              setIndividualNotes(prev => ({
                                ...prev,
                                [eq.id]: e.target.value,
                              }))
                            }
                            placeholder='Detalles...'
                            rows={2}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Confirmación */}
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <input
                type='checkbox'
                id='confirmDecommission'
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className='h-4 w-4'
              />
              <Label htmlFor='confirmDecommission' className='font-semibold'>
                Confirmo que deseo dar de baja estos {equipment.length} equipos de forma permanente
              </Label>
            </div>
          </div>

          {/* Resumen */}
          <div className='bg-gray-50 p-4 rounded-md'>
            <h4 className='font-semibold mb-2'>Resumen</h4>
            <ul className='text-sm space-y-1'>
              <li>Equipos a dar de baja: {equipment.length}</li>
              <li>
                Razón: {DECOMMISSION_REASONS.find(r => r.value === decommissionReason)?.label}
              </li>
              <li>Estado resultante: RETIRED</li>
              <li>Se generará acta de baja automáticamente</li>
            </ul>
          </div>
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
            variant='destructive'
            onClick={handleSubmit}
            disabled={submitting || !confirmed}
          >
            {submitting ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Procesando...
              </>
            ) : (
              <>
                <XCircle className='h-4 w-4 mr-2' />
                Dar de Baja
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

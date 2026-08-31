'use client'

/**
 * BulkMaintenanceModal
 * Modal para enviar múltiples equipos a mantenimiento
 * Permite establecer tipo de mantenimiento común y notas individuales
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Loader2, Wrench } from 'lucide-react'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

interface Equipment {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
}

interface BulkMaintenanceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: Equipment[]
  onSuccess: () => void
}

const MAINTENANCE_TYPES = [
  { value: 'PREVENTIVE', label: 'Preventivo' },
  { value: 'CORRECTIVE', label: 'Correctivo' },
  { value: 'CLEANING', label: 'Limpieza' },
  { value: 'UPGRADE', label: 'Actualización' },
  { value: 'REPAIR', label: 'Reparación' },
  { value: 'OTHER', label: 'Otro' },
]

export function BulkMaintenanceModal({
  open,
  onOpenChange,
  equipment,
  onSuccess,
}: BulkMaintenanceModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [maintenanceType, setMaintenanceType] = useState<string>('PREVENTIVE')
  const [commonNotes, setCommonNotes] = useState<string>('')
  const [individualNotes, setIndividualNotes] = useState<Record<string, string>>({})
  const [useIndividualNotes, setUseIndividualNotes] = useState(false)

  const handleSubmit = async () => {
    if (!maintenanceType) {
      toast({
        title: 'Tipo de mantenimiento requerido',
        description: 'Debes seleccionar un tipo de mantenimiento',
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
          action: 'MAINTENANCE',
          maintenanceType,
          maintenanceNotes: useIndividualNotes ? undefined : commonNotes,
          individualNotes: useIndividualNotes ? individualNotes : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al enviar equipos a mantenimiento')
      }

      const result = await response.json()

      toast({
        title: 'Equipos enviados a mantenimiento',
        description: `Se enviaron ${result.updatedCount} equipos a mantenimiento`,
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
      <DialogContent className='max-w-4xl max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>Enviar Equipos a Mantenimiento</DialogTitle>
          <DialogDescription>
            Configura el mantenimiento para {equipment.length} equipos seleccionados
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className='space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]'>
            {/* Tipo de Mantenimiento */}
            <div className='space-y-2'>
              <Label htmlFor='maintenanceType'>
                Tipo de Mantenimiento <span className='text-red-500'>*</span>
              </Label>
              <select
                id='maintenanceType'
                value={maintenanceType}
                onChange={e => setMaintenanceType(e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                {MAINTENANCE_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
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
                  placeholder='Notas sobre el mantenimiento...'
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
                              placeholder='Notas...'
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

            {/* Resumen */}
            <div className='bg-gray-50 dark:bg-gray-800/50 p-4 rounded-md'>
              <h4 className='font-semibold mb-2'>Resumen</h4>
              <ul className='text-sm space-y-1'>
                <li>Equipos seleccionados: {equipment.length}</li>
                <li>
                  Tipo de mantenimiento:{' '}
                  {MAINTENANCE_TYPES.find(t => t.value === maintenanceType)?.label}
                </li>
                <li>Estado resultante: MAINTENANCE</li>
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
            <Button type='submit' disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Procesando...
                </>
              ) : (
                <>
                  <Wrench className='h-4 w-4 mr-2' />
                  Enviar a Mantenimiento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

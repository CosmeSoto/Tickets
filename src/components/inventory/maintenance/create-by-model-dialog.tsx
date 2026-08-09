'use client'

import { useState, useEffect } from 'react'
import { Loader2, Package, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { ModelCombobox } from '@/components/ui/model-combobox'
import { TechnicianCombobox } from '@/components/ui/technician-combobox'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { parseScheduledDateTime, toLocalDateTimeInputValue } from '@/lib/forms/form-date'
import { toast } from 'sonner'

interface CreateByModelDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateByModelDialog({ open, onClose, onCreated }: CreateByModelDialogProps) {
  const [loading, setLoading] = useState(false)
  const [modelId, setModelId] = useState('')
  const [type, setType] = useState<'PREVENTIVE' | 'CORRECTIVE'>('PREVENTIVE')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => toLocalDateTimeInputValue(new Date()))
  const [technicianId, setTechnicianId] = useState('')
  const [familyId, setFamilyId] = useState('all')
  const [statusFilter, setStatusFilter] = useState<string[]>(['AVAILABLE', 'ASSIGNED'])
  const [equipmentCount, setEquipmentCount] = useState(0)

  const { families } = useFamilyOptions()

  // Obtener cantidad de equipos que se verán afectados
  useEffect(() => {
    if (!modelId) {
      setEquipmentCount(0)
      return
    }

    const fetchCount = async () => {
      try {
        const params = new URLSearchParams({ modelId })
        if (familyId !== 'all') params.set('familyId', familyId)
        if (statusFilter.length > 0) params.set('status', statusFilter.join(','))

        const res = await fetch(`/api/inventory/equipment/count?${params}`)
        if (res.ok) {
          const data = await res.json()
          setEquipmentCount(data.count || 0)
        }
      } catch (error) {
        console.error('Error fetching equipment count:', error)
      }
    }

    fetchCount()
  }, [modelId, familyId, statusFilter])

  const handleSubmit = async () => {
    if (!modelId || !description || !scheduledAt) {
      toast.error('Por favor completa todos los campos requeridos')
      return
    }

    const when = parseScheduledDateTime(scheduledAt)
    if (Number.isNaN(when.getTime())) {
      toast.error('Revisa la fecha y hora programada')
      return
    }

    if (equipmentCount === 0) {
      toast.error('No hay equipos disponibles para este modelo con los filtros seleccionados')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/inventory/maintenance/by-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          type,
          description,
          scheduledDate: when.toISOString(),
          technicianId: technicianId || undefined,
          familyId: familyId !== 'all' ? familyId : undefined,
          statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Error al crear mantenimientos')
      }

      const result = await res.json()

      toast.success(
        `Se crearon ${result.created} mantenimiento${result.created !== 1 ? 's' : ''}${result.skipped > 0 ? `. ${result.skipped} equipo${result.skipped !== 1 ? 's' : ''} omitido${result.skipped !== 1 ? 's' : ''}` : ''}`
      )

      onCreated()
      onClose()
      resetForm()
    } catch (error) {
      console.error('Error creating maintenance by model:', error)
      toast.error(error instanceof Error ? error.message : 'Error al crear mantenimientos')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setModelId('')
    setType('PREVENTIVE')
    setDescription('')
    setScheduledAt(toLocalDateTimeInputValue(new Date()))
    setTechnicianId('')
    setFamilyId('all')
    setStatusFilter(['AVAILABLE', 'ASSIGNED'])
    setEquipmentCount(0)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) onClose()
      }}
    >
      <DialogContent className='max-w-2xl max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle>Crear Mantenimiento por Modelo</DialogTitle>
          <DialogDescription>
            Crea mantenimiento para todos los equipos de un modelo específico
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className='space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]'>
            {/* Modelo */}
            <div className='space-y-2'>
              <Label>
                Modelo <span className='text-destructive'>*</span>
              </Label>
              <ModelCombobox value={modelId} onValueChange={setModelId} />
            </div>

            {/* Tipo */}
            <div className='space-y-2'>
              <Label>
                Tipo de Mantenimiento <span className='text-destructive'>*</span>
              </Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='PREVENTIVE'>Preventivo</SelectItem>
                  <SelectItem value='CORRECTIVE'>Correctivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descripción */}
            <div className='space-y-2'>
              <Label>
                Descripción <span className='text-destructive'>*</span>
              </Label>
              <Textarea
                placeholder='Describe el mantenimiento a realizar...'
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            {/* Fecha y hora */}
            <div className='space-y-2'>
              <Label>
                Fecha y hora programadas <span className='text-destructive'>*</span>
              </Label>
              <DateTimePicker value={scheduledAt} onChange={setScheduledAt} />
            </div>

            {/* Técnico */}
            <div className='space-y-2'>
              <Label>Técnico Asignado</Label>
              <TechnicianCombobox value={technicianId} onValueChange={setTechnicianId} allowNull />
            </div>

            {/* Filtros */}
            <div className='border-t pt-4 space-y-4'>
              <h4 className='font-medium text-sm'>Filtros de Equipos</h4>

              {/* Familia */}
              <div className='space-y-2'>
                <Label>Área/Familia</Label>
                <FamilyCombobox
                  families={families}
                  value={familyId}
                  onValueChange={v => setFamilyId(v || 'all')}
                  allowNull
                  nullLabel='Todas las áreas'
                />
              </div>

              {/* Estados */}
              <div className='space-y-2'>
                <Label>Estados de Equipos</Label>
                <Select
                  value={statusFilter.join(',')}
                  onValueChange={v => setStatusFilter(v ? v.split(',') : [])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Selecciona estados' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='AVAILABLE,ASSIGNED'>Disponibles y Asignados</SelectItem>
                    <SelectItem value='AVAILABLE'>Solo Disponibles</SelectItem>
                    <SelectItem value='ASSIGNED'>Solo Asignados</SelectItem>
                    <SelectItem value='AVAILABLE,ASSIGNED,DAMAGED'>Incluir Dañados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contador de equipos */}
            {modelId && (
              <Alert>
                <Package className='h-4 w-4' />
                <AlertDescription>
                  Se creará mantenimiento para{' '}
                  <span className='font-semibold'>{equipmentCount}</span> equipo
                  {equipmentCount !== 1 ? 's' : ''}
                </AlertDescription>
              </Alert>
            )}

            {equipmentCount === 0 && modelId && (
              <Alert variant='destructive'>
                <AlertCircle className='h-4 w-4' />
                <AlertDescription>
                  No hay equipos disponibles para este modelo con los filtros seleccionados
                </AlertDescription>
              </Alert>
            )}

            {/* Botones */}
            <div className='flex justify-end gap-2 pt-4'>
              <Button type='button' variant='outline' onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type='submit' disabled={loading || equipmentCount === 0}>
                {loading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
                Crear Mantenimiento{equipmentCount > 0 ? `s (${equipmentCount})` : ''}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

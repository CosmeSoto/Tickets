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
import { SearchableSelect } from '@/components/ui/searchable-select'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { parseScheduledDateTime, toLocalDateTimeInputValue } from '@/lib/forms/form-date'
import { toast } from 'sonner'
import {
  MaintenanceAssigneeFields,
  assigneeToApiPayload,
  emptyAssignee,
  type MaintenanceAssigneeValue,
} from '@/components/inventory/maintenance/maintenance-assignee-fields'

interface CreateByTypeDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

interface TypeOption {
  id: string
  name: string
  code?: string
  familyId?: string | null
}

/**
 * Mantenimiento masivo por tipo de equipo (Laptop, Impresora, etc.).
 * Evita el selector pesado de modelos que colgaba el modal.
 */
export function CreateByTypeDialog({ open, onClose, onCreated }: CreateByTypeDialogProps) {
  const [loading, setLoading] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [types, setTypes] = useState<TypeOption[]>([])
  const [typesError, setTypesError] = useState<string | null>(null)

  const [typeId, setTypeId] = useState('')
  const [maintenanceType, setMaintenanceType] = useState<'PREVENTIVE' | 'CORRECTIVE'>('PREVENTIVE')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => toLocalDateTimeInputValue(new Date()))
  const [assignee, setAssignee] = useState<MaintenanceAssigneeValue>(() => emptyAssignee())
  const [familyId, setFamilyId] = useState('all')
  const [statusFilter, setStatusFilter] = useState<string[]>(['AVAILABLE', 'ASSIGNED'])
  const [equipmentCount, setEquipmentCount] = useState(0)
  const [counting, setCounting] = useState(false)

  const { families } = useFamilyOptions()

  // Cargar tipos al abrir (lista liviana de catálogo)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const ac = new AbortController()

    const load = async () => {
      setLoadingTypes(true)
      setTypesError(null)
      try {
        const params = new URLSearchParams()
        if (familyId !== 'all') params.set('familyId', familyId)
        const res = await fetch(`/api/inventory/equipment-types?${params}`, {
          signal: ac.signal,
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) {
            setTypes([])
            setTypesError('No se pudieron cargar los tipos de equipo')
          }
          return
        }
        const data = await res.json()
        const list: TypeOption[] = (data.types || data || []).map(
          (t: { id: string; name: string; code?: string; familyId?: string | null }) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            familyId: t.familyId,
          })
        )
        if (!cancelled) {
          setTypes(list)
          // Si el tipo seleccionado ya no está en la lista filtrada, limpiar
          if (typeId && !list.some(t => t.id === typeId)) {
            setTypeId('')
          }
        }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        if (!cancelled) {
          setTypes([])
          setTypesError('No se pudieron cargar los tipos de equipo')
        }
      } finally {
        if (!cancelled) setLoadingTypes(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      ac.abort()
    }
    // typeId omitido a propósito: no re-fetch al seleccionar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, familyId])

  // Contar equipos afectados
  useEffect(() => {
    if (!typeId) {
      setEquipmentCount(0)
      return
    }

    let cancelled = false
    const ac = new AbortController()
    const timer = setTimeout(async () => {
      setCounting(true)
      try {
        const params = new URLSearchParams({ typeId })
        if (familyId !== 'all') params.set('familyId', familyId)
        if (statusFilter.length > 0) params.set('status', statusFilter.join(','))

        const res = await fetch(`/api/inventory/equipment/count?${params}`, {
          signal: ac.signal,
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setEquipmentCount(data.count || 0)
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        console.error('Error counting equipment by type:', e)
      } finally {
        if (!cancelled) setCounting(false)
      }
    }, 200)

    return () => {
      cancelled = true
      ac.abort()
      clearTimeout(timer)
    }
  }, [typeId, familyId, statusFilter])

  const resetForm = () => {
    setTypeId('')
    setMaintenanceType('PREVENTIVE')
    setDescription('')
    setScheduledAt(toLocalDateTimeInputValue(new Date()))
    setAssignee(emptyAssignee())
    setFamilyId('all')
    setStatusFilter(['AVAILABLE', 'ASSIGNED'])
    setEquipmentCount(0)
    setTypesError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async () => {
    if (!typeId || !description || !scheduledAt) {
      toast.error('Completa tipo, descripción y fecha/hora')
      return
    }

    const when = parseScheduledDateTime(scheduledAt)
    if (Number.isNaN(when.getTime())) {
      toast.error('Revisa la fecha y hora programada')
      return
    }

    if (assignee.mode === 'external' && !assignee.supplierId) {
      toast.error('Selecciona el proveedor externo')
      return
    }

    if (equipmentCount === 0) {
      toast.error('No hay equipos para este tipo con los filtros seleccionados')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/inventory/maintenance/by-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typeId,
          type: maintenanceType,
          description,
          scheduledDate: when.toISOString(),
          ...assigneeToApiPayload(assignee),
          familyId: familyId !== 'all' ? familyId : undefined,
          statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Error al crear mantenimientos')
      }

      const result = await res.json()
      toast.success(
        `Se crearon ${result.created} mantenimiento${result.created !== 1 ? 's' : ''}${
          result.skipped > 0
            ? `. ${result.skipped} equipo${result.skipped !== 1 ? 's' : ''} omitido${result.skipped !== 1 ? 's' : ''}`
            : ''
        }`
      )

      onCreated()
      handleClose()
    } catch (error) {
      console.error('Error creating maintenance by type:', error)
      toast.error(error instanceof Error ? error.message : 'Error al crear mantenimientos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) handleClose()
      }}
    >
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>Crear Mantenimiento por Tipo</DialogTitle>
          <DialogDescription>
            Programa el mismo mantenimiento para todos los equipos de un tipo (p. ej. Laptops,
            Impresoras). Más estable y útil que filtrar por modelo comercial.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault()
            void handleSubmit()
          }}
          className='space-y-4'
        >
          <div className='space-y-2'>
            <Label>Área/Familia (filtra tipos y equipos)</Label>
            <FamilyCombobox
              families={families}
              value={familyId}
              onValueChange={v => setFamilyId(v || 'all')}
              allowNull
              nullLabel='Todas las áreas'
            />
          </div>

          <div className='space-y-2'>
            <Label>
              Tipo de equipo <span className='text-destructive'>*</span>
            </Label>
            {loadingTypes ? (
              <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                <Loader2 className='h-4 w-4 animate-spin' /> Cargando tipos...
              </div>
            ) : typesError ? (
              <p className='text-sm text-destructive'>{typesError}</p>
            ) : (
              <SearchableSelect
                options={types.map(t => ({
                  id: t.id,
                  name: t.code ? `${t.name} (${t.code})` : t.name,
                }))}
                value={typeId}
                onChange={setTypeId}
                placeholder='Buscar tipo de equipo...'
              />
            )}
          </div>

          <div className='space-y-2'>
            <Label>
              Tipo de mantenimiento <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={maintenanceType}
              onValueChange={(v: 'PREVENTIVE' | 'CORRECTIVE') => setMaintenanceType(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PREVENTIVE'>Preventivo</SelectItem>
                <SelectItem value='CORRECTIVE'>Correctivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          <div className='space-y-2'>
            <Label>
              Fecha y hora programadas <span className='text-destructive'>*</span>
            </Label>
            <DateTimePicker value={scheduledAt} onChange={setScheduledAt} />
          </div>

          <MaintenanceAssigneeFields
            value={assignee}
            onChange={setAssignee}
            familyId={familyId !== 'all' ? familyId : null}
          />

          <div className='space-y-2'>
            <Label>Estados de equipos</Label>
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

          {typeId && (
            <Alert>
              <Package className='h-4 w-4' />
              <AlertDescription>
                {counting ? (
                  <span className='inline-flex items-center gap-2'>
                    <Loader2 className='h-3.5 w-3.5 animate-spin' /> Contando equipos...
                  </span>
                ) : (
                  <>
                    Se creará mantenimiento para{' '}
                    <span className='font-semibold'>{equipmentCount}</span> equipo
                    {equipmentCount !== 1 ? 's' : ''}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {typeId && !counting && equipmentCount === 0 && (
            <Alert variant='destructive'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>
                No hay equipos disponibles para este tipo con los filtros seleccionados
              </AlertDescription>
            </Alert>
          )}

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type='submit'
              disabled={loading || counting || !typeId || !description || equipmentCount === 0}
            >
              {loading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Crear Mantenimiento{equipmentCount > 0 ? `s (${equipmentCount})` : ''}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

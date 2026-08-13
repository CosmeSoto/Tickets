'use client'

import { useState, useEffect } from 'react'
import { Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { parseScheduledDateTime } from '@/lib/forms/form-date'
import {
  MaintenanceAssigneeFields,
  assigneeToApiPayload,
  emptyAssignee,
  type MaintenanceAssigneeValue,
} from '@/components/inventory/maintenance/maintenance-assignee-fields'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  isClient: boolean
  preselectedEquipmentId?: string
  preselectedEquipmentLabel?: string
}

interface EquipmentOption {
  id: string
  code: string
  brand: string
  model: string
}

interface FamilyOption {
  id: string
  name: string
}

function defaultScheduledLocal(): string {
  const d = new Date()
  d.setHours(9, 0, 0, 0)
  if (d.getTime() < Date.now()) {
    d.setDate(d.getDate() + 1)
  }
  const yyyy = d.getFullYear()
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${MM}-${dd}T09:00`
}

export function NewMaintenanceDialog({
  open,
  onClose,
  onCreated,
  isClient,
  preselectedEquipmentId,
  preselectedEquipmentLabel,
}: Props) {
  const [loading, setLoading] = useState(false)

  const { families, loading: loadingFamilies } = useFamilyOptions()
  const familyList: FamilyOption[] = families.map(f => ({ id: f.id, name: f.name }))

  const [selectedFamilyId, setSelectedFamilyId] = useState('_all')

  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [loadingEquipment, setLoadingEquipment] = useState(false)

  const [equipmentId, setEquipmentId] = useState(preselectedEquipmentId || '')
  const [type, setType] = useState('PREVENTIVE')
  const [description, setDescription] = useState('')
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledLocal)
  const [notes, setNotes] = useState('')
  const [assignee, setAssignee] = useState<MaintenanceAssigneeValue>(() => emptyAssignee())

  useEffect(() => {
    if (!open || preselectedEquipmentId) return
    setLoadingEquipment(true)
    setEquipmentId('')

    const params = new URLSearchParams({ limit: '100' })
    if (selectedFamilyId !== '_all') params.set('familyId', selectedFamilyId)

    fetch(`/api/inventory/equipment?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setEquipmentList(
          (data.equipment || data || []).map((e: any) => ({
            id: e.id,
            code: e.code,
            brand: e.brand,
            model: e.model,
          }))
        )
      })
      .catch(() => {})
      .finally(() => setLoadingEquipment(false))
  }, [open, selectedFamilyId, preselectedEquipmentId, isClient])

  const handleClose = () => {
    setSelectedFamilyId('_all')
    setEquipmentId('')
    setType('PREVENTIVE')
    setDescription('')
    setScheduledAt(defaultScheduledLocal())
    setNotes('')
    setAssignee(emptyAssignee())
    onClose()
  }

  const handleSubmit = async () => {
    if (!equipmentId || !description || !scheduledAt) {
      toast({
        title: 'Campos requeridos',
        description: 'Completa todos los campos obligatorios.',
        variant: 'destructive',
      })
      return
    }

    if (!isClient && assignee.mode === 'external' && !assignee.supplierId) {
      toast({
        title: 'Proveedor requerido',
        description: 'Selecciona el proveedor que realizará el mantenimiento.',
        variant: 'destructive',
      })
      return
    }

    const when = parseScheduledDateTime(scheduledAt)
    if (Number.isNaN(when.getTime())) {
      toast({
        title: 'Fecha inválida',
        description: 'Revisa la fecha y hora programada.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/inventory/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId,
          type,
          description,
          scheduledDate: when.toISOString(),
          notes: notes || undefined,
          ...(!isClient ? assigneeToApiPayload(assignee) : {}),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear mantenimiento')
      }
      toast({
        title: isClient ? 'Solicitud enviada' : 'Mantenimiento programado',
        description: isClient
          ? 'Tu solicitud fue enviada al equipo técnico para su aprobación.'
          : assignee.mode === 'external'
            ? 'Programado con proveedor externo. El equipo está en mantenimiento.'
            : 'El mantenimiento fue programado y el equipo está en estado de mantenimiento.',
      })
      handleClose()
      onCreated()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const minDate = new Date()
  minDate.setHours(0, 0, 0, 0)

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) handleClose()
      }}
    >
      <DialogContent className='w-[min(98vw,38rem)] max-w-none max-h-[90vh] overflow-y-auto' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Wrench className='h-5 w-5' />
            {isClient ? 'Solicitar Mantenimiento' : 'Programar Mantenimiento'}
          </DialogTitle>
          <DialogDescription>
            {isClient
              ? 'Envía una solicitud al equipo técnico. Ellos la revisarán y programarán la fecha.'
              : 'Programa un mantenimiento preventivo o correctivo. El equipo pasará a estado de mantenimiento.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={e => {
            e.preventDefault()
            void handleSubmit()
          }}
          className='space-y-4'
        >
          <div className='space-y-4'>
            {preselectedEquipmentId ? (
              <div>
                <Label>Equipo</Label>
                <Input value={preselectedEquipmentLabel || preselectedEquipmentId} disabled />
              </div>
            ) : (
              <div className='space-y-3'>
                {!isClient && (
                  <div>
                    <Label>
                      Familia
                      <span className='ml-1 text-xs font-normal text-muted-foreground'>
                        — filtra los equipos
                      </span>
                    </Label>
                    {loadingFamilies ? (
                      <div className='flex items-center gap-2 text-sm text-muted-foreground py-1.5'>
                        <Loader2 className='h-3.5 w-3.5 animate-spin' /> Cargando familias...
                      </div>
                    ) : (
                      <SearchableSelect
                        options={[{ id: '_all', name: 'Todas las familias' }, ...familyList]}
                        value={selectedFamilyId}
                        onChange={setSelectedFamilyId}
                        placeholder='Buscar familia...'
                      />
                    )}
                  </div>
                )}

                <div>
                  <Label>Equipo *</Label>
                  {loadingEquipment ? (
                    <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                      <Loader2 className='h-4 w-4 animate-spin' /> Cargando equipos...
                    </div>
                  ) : (
                    <SearchableSelect
                      options={equipmentList.map(e => ({
                        id: e.id,
                        name: `${e.code} — ${e.brand} ${e.model}`,
                      }))}
                      value={equipmentId}
                      onChange={setEquipmentId}
                      placeholder={
                        isClient ? 'Buscar tu equipo...' : 'Buscar por código, marca o modelo...'
                      }
                    />
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>Tipo de mantenimiento *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='PREVENTIVE'>
                    <div>
                      <p className='font-medium'>Preventivo</p>
                      <p className='text-xs text-muted-foreground'>
                        Revisión rutinaria para evitar fallas
                      </p>
                    </div>
                  </SelectItem>
                  <SelectItem value='CORRECTIVE'>
                    <div>
                      <p className='font-medium'>Correctivo</p>
                      <p className='text-xs text-muted-foreground'>
                        Reparación de una falla existente
                      </p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{isClient ? 'Motivo de la solicitud *' : 'Descripción del trabajo *'}</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder={
                  isClient
                    ? 'Describe el problema o motivo...'
                    : 'Describe el trabajo a realizar...'
                }
              />
            </div>

            <div>
              <Label>{isClient ? 'Fecha y hora sugeridas *' : 'Fecha y hora programadas *'}</Label>
              <DateTimePicker value={scheduledAt} onChange={setScheduledAt} minDate={minDate} />
              {isClient && (
                <p className='text-xs text-muted-foreground mt-1'>
                  El técnico puede ajustar la fecha y hora al aprobar tu solicitud.
                </p>
              )}
            </div>

            {!isClient && (
              <MaintenanceAssigneeFields
                value={assignee}
                onChange={setAssignee}
                familyId={selectedFamilyId !== '_all' ? selectedFamilyId : null}
              />
            )}

            <div>
              <Label>Notas adicionales (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder='Información adicional relevante...'
              />
            </div>
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type='submit'
              disabled={loading || !equipmentId || !description || !scheduledAt}
            >
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {isClient ? 'Enviar Solicitud' : 'Programar Mantenimiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

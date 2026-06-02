'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { PATROL_RECURRENCE_LABELS_ES } from '@/lib/utils/patrol-utils'
import { formatDurationMinutes } from '@/lib/utils/patrol-utils'
import { FormData, EMPTY_FORM, Family, PatrolRoute, Agent, DAY_LABELS } from './types'
import { localDayToUTCDay, utcDayToLocalDay, formatDateTimeLocal } from './utils'

interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingId: string | null
  initialForm?: FormData
  families: Family[]
  routes: PatrolRoute[]
  agents: Agent[]
  saving: boolean
  onSave: (form: FormData, editingId: string | null) => Promise<void>
  onFamilyChange: (familyId: string) => void
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  editingId,
  initialForm,
  families,
  routes,
  agents,
  saving,
  onSave,
  onFamilyChange,
}: ScheduleFormDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  useEffect(() => {
    if (initialForm) {
      setForm(initialForm)
    } else {
      setForm({ ...EMPTY_FORM, familyId: families[0]?.id ?? '' })
    }
  }, [open, initialForm, families])

  const toggleDay = useCallback(
    (localDay: number) => {
      const utcDay = localDayToUTCDay(localDay, form.scheduledStart)
      setForm(f => ({
        ...f,
        recurrenceDays: f.recurrenceDays.includes(utcDay)
          ? f.recurrenceDays.filter(d => d !== utcDay)
          : [...f.recurrenceDays, utcDay].sort((a, b) => a - b),
      }))
    },
    [form.scheduledStart]
  )

  const handleStartChange = useCallback(
    (newStart: string) => {
      if (form.recurrenceDays.length > 0 && form.scheduledStart) {
        const oldLocalDays = form.recurrenceDays.map(utcDay =>
          utcDayToLocalDay(utcDay, form.scheduledStart)
        )
        const newUtcDays = oldLocalDays
          .map(localDay => localDayToUTCDay(localDay, newStart))
          .filter((d, i, arr) => arr.indexOf(d) === i)
          .sort((a, b) => a - b)
        setForm(f => ({ ...f, scheduledStart: newStart, recurrenceDays: newUtcDays }))
      } else {
        setForm(f => ({ ...f, scheduledStart: newStart }))
      }
    },
    [form.recurrenceDays, form.scheduledStart]
  )

  const handleSubmit = useCallback(async () => {
    const isRecurring = form.recurrence !== 'NONE'

    if (
      !form.familyId ||
      !form.routeId ||
      !form.agentId ||
      !form.scheduledStart ||
      (!isRecurring && !form.scheduledEnd) ||
      (isRecurring && !form.endTimeOnly)
    ) {
      toast({
        title: 'Campos requeridos',
        description: 'Completa todos los campos obligatorios',
        variant: 'destructive',
      })
      return
    }

    let scheduledEndISO: string
    if (isRecurring) {
      const startDate = new Date(form.scheduledStart)
      const [endHour, endMin] = form.endTimeOnly.split(':').map(Number)
      const endDate = new Date(startDate)
      endDate.setHours(endHour, endMin, 0, 0)

      if (endDate <= startDate) {
        endDate.setDate(endDate.getDate() + 1)
      }
      scheduledEndISO = endDate.toISOString()
    } else {
      scheduledEndISO = new Date(form.scheduledEnd).toISOString()
    }

    const startISO = new Date(form.scheduledStart).toISOString()

    if (new Date(scheduledEndISO) <= new Date(startISO)) {
      toast({
        title: 'Horario inválido',
        description: 'La hora de fin debe ser posterior a la de inicio',
        variant: 'destructive',
      })
      return
    }

    if (isRecurring && (form.recurrence === 'WEEKLY' || form.recurrence === 'CUSTOM')) {
      if (!Array.isArray(form.recurrenceDays) || form.recurrenceDays.length === 0) {
        toast({
          title: 'Días requeridos',
          description: 'Selecciona al menos un día de la semana',
          variant: 'destructive',
        })
        return
      }
    }

    await onSave(form, editingId)
  }, [form, editingId, onSave, toast])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='text-xl'>
            {editingId ? 'Editar Programación' : 'Nueva Programación'}
          </DialogTitle>
          <DialogDescription>
            {editingId
              ? 'Modifica los datos de la programación existente.'
              : 'Asigna una ruta a un guardia en un horario específico.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2 max-h-[72vh] overflow-y-auto pr-2'>
          <div className='space-y-1.5'>
            <Label className='text-sm font-medium'>
              Área <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.familyId}
              onValueChange={v => {
                setForm(f => ({ ...f, familyId: v, routeId: '', agentId: '' }))
                onFamilyChange(v)
              }}
              disabled={saving}
            >
              <SelectTrigger className='h-10'>
                <SelectValue placeholder='Selecciona un área' />
              </SelectTrigger>
              <SelectContent>
                {families.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label className='text-sm font-medium'>
              Ruta <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.routeId}
              onValueChange={v => {
                // Sugerir hora de fin basada en la duración estimada de la ruta
                const selectedRoute = routes.find(r => r.id === v)
                setForm(f => {
                  const updated = { ...f, routeId: v }
                  if (selectedRoute?.estimatedDurationMinutes && f.scheduledStart) {
                    const startDate = new Date(f.scheduledStart)
                    if (!isNaN(startDate.getTime())) {
                      const endDate = new Date(
                        startDate.getTime() + selectedRoute.estimatedDurationMinutes * 60000
                      )
                      if (f.recurrence === 'NONE') {
                        const y = endDate.getFullYear()
                        const mo = String(endDate.getMonth() + 1).padStart(2, '0')
                        const d = String(endDate.getDate()).padStart(2, '0')
                        const h = String(endDate.getHours()).padStart(2, '0')
                        const mi = String(endDate.getMinutes()).padStart(2, '0')
                        updated.scheduledEnd = `${y}-${mo}-${d}T${h}:${mi}`
                      } else {
                        const h = String(endDate.getHours()).padStart(2, '0')
                        const mi = String(endDate.getMinutes()).padStart(2, '0')
                        updated.endTimeOnly = `${h}:${mi}`
                      }
                    }
                  }
                  return updated
                })
              }}
              disabled={saving || !form.familyId}
            >
              <SelectTrigger className='h-10'>
                <SelectValue
                  placeholder={form.familyId ? 'Selecciona una ruta' : 'Primero selecciona un área'}
                />
              </SelectTrigger>
              <SelectContent>
                {routes.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    <span>{r.name}</span>
                    {r.estimatedDurationMinutes > 0 && (
                      <span className='ml-2 text-muted-foreground text-xs'>
                        {'— '}
                        {formatDurationMinutes(r.estimatedDurationMinutes)}
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.routeId &&
              (() => {
                const r = routes.find(x => x.id === form.routeId)
                if (!r) return null
                return (
                  <p className='text-xs text-muted-foreground'>
                    ⏱ Duración estimada de la ruta:{' '}
                    <span className='font-medium text-foreground'>
                      {formatDurationMinutes(r.estimatedDurationMinutes)}
                    </span>
                    {' — '}la hora de fin se ha sugerido automáticamente
                  </p>
                )
              })()}
          </div>

          <div className='space-y-1.5'>
            <Label className='text-sm font-medium'>
              Agente <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.agentId}
              onValueChange={v => setForm(f => ({ ...f, agentId: v }))}
              disabled={saving}
            >
              <SelectTrigger className='h-10'>
                <SelectValue placeholder='Selecciona un agente' />
              </SelectTrigger>
              <SelectContent>
                {agents.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name} — {g.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agents.length === 0 && (
              <p className='text-xs text-muted-foreground'>
                No hay usuarios con el módulo de patrullas habilitado
              </p>
            )}
          </div>

          <div className='border-t pt-4' />

          {/* ── Control de validación de horario ── */}
          <div className='space-y-1.5'>
            <Label className='text-sm font-medium flex items-center gap-1.5'>
              <Clock className='h-4 w-4 text-primary' />
              Validación de horario
            </Label>
            <Select
              value={
                form.overrideTimeValidation === null
                  ? 'inherit'
                  : form.overrideTimeValidation
                    ? 'strict'
                    : 'flexible'
              }
              onValueChange={v =>
                setForm(f => ({
                  ...f,
                  overrideTimeValidation: v === 'inherit' ? null : v === 'strict' ? true : false,
                }))
              }
              disabled={saving}
            >
              <SelectTrigger className='h-10'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='inherit'>🏠 Default del área</SelectItem>
                <SelectItem value='strict'>
                  🔒 Estricto — solo dentro del período de gracia
                </SelectItem>
                <SelectItem value='flexible'>
                  🔓 Flexible — puede iniciar en cualquier momento
                </SelectItem>
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              {form.overrideTimeValidation === null &&
                'Usa la configuración definida en el área (Configuración de Rondas).'}
              {form.overrideTimeValidation === true &&
                'Solo para esta programación: el agente debe iniciar dentro del período de gracia.'}
              {form.overrideTimeValidation === false &&
                'Solo para esta programación: el agente puede iniciar sin restricción de horario.'}
            </p>
          </div>

          <div className='space-y-1.5'>
            <Label className='text-sm font-medium'>¿Con qué frecuencia se repite?</Label>
            <Select
              value={form.recurrence === 'WEEKLY' ? 'CUSTOM' : form.recurrence}
              onValueChange={v =>
                setForm(f => ({
                  ...f,
                  recurrence: v as FormData['recurrence'],
                  recurrenceDays: [],
                  endTimeOnly: '',
                  scheduledEnd: v === 'NONE' ? '' : f.scheduledEnd,
                }))
              }
              disabled={saving}
            >
              <SelectTrigger className='h-10'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='NONE'>📅 Una sola vez — fecha y hora exacta</SelectItem>
                <SelectItem value='DAILY'>🔁 Todos los días — misma hora cada día</SelectItem>
                <SelectItem value='CUSTOM'>
                  📆 Días de la semana — elige qué días se repite
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selección de días — aparece inmediatamente al elegir Días de la semana */}
          {(form.recurrence === 'WEEKLY' || form.recurrence === 'CUSTOM') && (
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>
                ¿Qué días de la semana? <span className='text-destructive'>*</span>
              </Label>
              <p className='text-xs text-muted-foreground'>
                La ronda se ejecutará cada semana en los días que marques
              </p>
              <div className='flex gap-2 flex-wrap'>
                {DAY_LABELS.map((label, localDay) => {
                  const utcDay = localDayToUTCDay(localDay, form.scheduledStart)
                  const isSelected = form.recurrenceDays.includes(utcDay)
                  return (
                    <button
                      key={localDay}
                      type='button'
                      onClick={() => toggleDay(localDay)}
                      className={`px-3.5 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                      disabled={saving}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              {form.recurrenceDays.length === 0 && (
                <p className='text-xs text-destructive'>Selecciona al menos un día</p>
              )}
            </div>
          )}

          {form.recurrence === 'NONE' ? (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label className='text-sm font-medium'>
                  Fecha y hora de inicio <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='datetime-local'
                  value={form.scheduledStart}
                  onChange={e => handleStartChange(e.target.value)}
                  disabled={saving}
                  className='h-10'
                />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-sm font-medium'>
                  Fecha y hora de fin <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='datetime-local'
                  value={form.scheduledEnd}
                  min={form.scheduledStart}
                  onChange={e => setForm(f => ({ ...f, scheduledEnd: e.target.value }))}
                  disabled={saving}
                  className='h-10'
                />
              </div>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label className='text-sm font-medium'>
                  Primera fecha de inicio <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='datetime-local'
                  value={form.scheduledStart}
                  onChange={e => handleStartChange(e.target.value)}
                  disabled={saving}
                  className='h-10'
                />
                <p className='text-xs text-muted-foreground'>
                  Desde cuándo empieza la programación
                </p>
              </div>
              <div className='space-y-1.5'>
                <Label className='text-sm font-medium'>
                  Hora de fin de cada ronda <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='time'
                  value={form.endTimeOnly}
                  onChange={e => setForm(f => ({ ...f, endTimeOnly: e.target.value }))}
                  disabled={saving}
                  className='h-10'
                />
                <p className='text-xs text-muted-foreground'>Hora a la que termina cada ronda</p>
              </div>
            </div>
          )}

          {/* ── Resumen dinámico de lo que se va a crear ── */}
          {form.scheduledStart &&
            (form.recurrence === 'NONE' ? form.scheduledEnd : form.endTimeOnly) &&
            (() => {
              try {
                const startDate = new Date(form.scheduledStart)
                let endDate: Date

                if (form.recurrence === 'NONE') {
                  endDate = new Date(form.scheduledEnd)
                } else {
                  const [h, m] = form.endTimeOnly.split(':').map(Number)
                  endDate = new Date(startDate)
                  endDate.setHours(h, m, 0, 0)
                  if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1)
                }

                const diffMs = endDate.getTime() - startDate.getTime()
                if (diffMs <= 0) return null

                const diffMins = Math.round(diffMs / 60000)
                const durationLabel = formatDurationMinutes(diffMins)
                const selectedRoute = routes.find(r => r.id === form.routeId)
                const selectedAgent = agents.find(a => a.id === form.agentId)
                const routeMins = selectedRoute?.estimatedDurationMinutes ?? 0
                const isTooShort = routeMins > 0 && diffMins < routeMins

                // Construir descripción según frecuencia
                const formatTime = (d: Date) =>
                  d.toLocaleTimeString('es-EC', { timeStyle: 'short' })
                const formatDateTime = (d: Date) =>
                  d.toLocaleString('es-EC', {
                    timeZone: 'America/Guayaquil',
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })

                let scheduleDesc = ''
                let occurrenceCount = ''

                if (form.recurrence === 'NONE') {
                  scheduleDesc = `el ${formatDateTime(startDate)}`
                  occurrenceCount = '1 ronda'
                } else if (form.recurrence === 'DAILY') {
                  scheduleDesc = `todos los días a las ${formatTime(startDate)}`
                  occurrenceCount = '~30 rondas'
                } else {
                  const selectedDayNames = form.recurrenceDays
                    .map(utcDay => {
                      const localDay = (utcDay + (startDate.getTimezoneOffset() > 0 ? 0 : 0)) % 7
                      return DAY_LABELS[localDay] ?? DAY_LABELS[utcDay % 7]
                    })
                    .join(', ')
                  if (selectedDayNames) {
                    scheduleDesc = `los ${selectedDayNames} a las ${formatTime(startDate)}`
                    const weeksAhead = Math.ceil(30 / 7)
                    const approxCount = form.recurrenceDays.length * weeksAhead
                    occurrenceCount = `~${approxCount} rondas`
                  }
                }

                return (
                  <div className='space-y-2 border-t pt-3'>
                    <p className='text-xs font-medium text-foreground'>
                      Resumen de lo que se creará
                    </p>
                    <div className='rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs'>
                      {selectedRoute && (
                        <div className='flex gap-2'>
                          <span className='text-muted-foreground w-16 shrink-0'>Ruta</span>
                          <span className='font-medium'>{selectedRoute.name}</span>
                        </div>
                      )}
                      {selectedAgent && (
                        <div className='flex gap-2'>
                          <span className='text-muted-foreground w-16 shrink-0'>Agente</span>
                          <span className='font-medium'>{selectedAgent.name}</span>
                        </div>
                      )}
                      {scheduleDesc && (
                        <div className='flex gap-2'>
                          <span className='text-muted-foreground w-16 shrink-0'>Horario</span>
                          <span className='font-medium capitalize'>{scheduleDesc}</span>
                        </div>
                      )}
                      <div className='flex gap-2'>
                        <span className='text-muted-foreground w-16 shrink-0'>Duración</span>
                        <span className='font-medium'>{durationLabel} por ronda</span>
                      </div>
                      {form.recurrence !== 'NONE' && occurrenceCount && (
                        <div className='flex gap-2'>
                          <span className='text-muted-foreground w-16 shrink-0'>Genera</span>
                          <span className='font-medium'>
                            {occurrenceCount} para los próximos 30 días
                          </span>
                        </div>
                      )}
                    </div>
                    {isTooShort && (
                      <div className='flex items-start gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-300'>
                        <span className='shrink-0'>⚠️</span>
                        <span>
                          La ruta estima <strong>{formatDurationMinutes(routeMins)}</strong> pero el
                          horario asignado solo da <strong>{durationLabel}</strong>. El agente
                          podría no completar todos los checkpoints.
                        </span>
                      </div>
                    )}
                  </div>
                )
              } catch {
                return null
              }
            })()}
        </div>

        <DialogFooter className='gap-2 pt-2'>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
            {editingId ? 'Guardar cambios' : 'Crear programación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

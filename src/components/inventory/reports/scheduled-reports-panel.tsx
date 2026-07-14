'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bookmark,
  CalendarClock,
  Loader2,
  Mail,
  Pause,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import type { InventorySavedReport, InventoryScheduledReport } from '@/lib/inventory/reports/types'
import { exportFormatLabel, frequencyLabel, WEEKDAY_OPTIONS } from '@/lib/inventory/reports/schedule-utils'

function scrollToSavedReports() {
  document.getElementById('saved-reports-panel')?.scrollIntoView({ behavior: 'smooth' })
}

export function ScheduledReportsPanel({
  openCreateForReportId,
  onCreateDialogClose,
}: {
  openCreateForReportId?: string | null
  onCreateDialogClose?: () => void
}) {
  const router = useRouter()
  const [schedules, setSchedules] = useState<InventoryScheduledReport[]>([])
  const [savedReports, setSavedReports] = useState<InventorySavedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [savedReportId, setSavedReportId] = useState('')
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY')
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [dayOfWeek, setDayOfWeek] = useState('1')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [recipients, setRecipients] = useState('')
  const [exportFormat, setExportFormat] = useState<'CSV' | 'PDF' | 'BOTH'>('BOTH')

  const loadData = useCallback(async () => {
    try {
      const [schedRes, savedRes] = await Promise.all([
        fetch('/api/inventory/reports/schedules'),
        fetch('/api/inventory/reports/saved'),
      ])
      if (schedRes.ok) {
        const data = await schedRes.json()
        setSchedules(data.schedules ?? [])
      }
      if (savedRes.ok) {
        const data = await savedRes.json()
        setSavedReports(data.savedReports ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (openCreateForReportId) {
      setSavedReportId(openCreateForReportId)
      setDialogOpen(true)
    }
  }, [openCreateForReportId])

  const openCreate = (preselectedReportId?: string) => {
    setError(null)
    setSavedReportId(preselectedReportId ?? savedReports[0]?.id ?? '')
    setFrequency('WEEKLY')
    setScheduleTime('08:00')
    setDayOfWeek('1')
    setDayOfMonth('1')
    setRecipients('')
    setExportFormat('BOTH')
    setDialogOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) onCreateDialogClose?.()
  }

  const handleCreate = async () => {
    if (!savedReportId) return
    setSaving(true)
    setError(null)
    try {
      const recipientList = recipients
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)

      const res = await fetch('/api/inventory/reports/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          savedReportId,
          frequency,
          scheduleTime,
          dayOfWeek: frequency === 'WEEKLY' ? parseInt(dayOfWeek, 10) : null,
          dayOfMonth: frequency === 'MONTHLY' ? parseInt(dayOfMonth, 10) : null,
          recipients: recipientList,
          exportFormat,
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'No se pudo crear la programación')
      }

      handleDialogChange(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al programar')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (schedule: InventoryScheduledReport) => {
    await fetch(`/api/inventory/reports/schedules/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !schedule.enabled }),
    })
    loadData()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/inventory/reports/schedules/${id}`, { method: 'DELETE' })
    loadData()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='py-8 flex justify-center'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  const hasSavedReports = savedReports.length > 0
  const showSetupGuide = !hasSavedReports || schedules.length === 0

  return (
    <>
      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-3 space-y-0'>
          <div>
            <CardTitle className='text-base flex items-center gap-2'>
              <CalendarClock className='h-4 w-4' />
              Envíos programados
            </CardTitle>
            <CardDescription>
              Recibe reportes guardados por email — CSV, PDF o ambos
            </CardDescription>
          </div>
          <Button size='sm' variant='outline' onClick={() => openCreate()}>
            <Mail className='h-4 w-4 mr-1.5' />
            Programar
          </Button>
        </CardHeader>
        <CardContent className='space-y-4'>
          {showSetupGuide && (
            <div className='rounded-lg border bg-muted/30 p-4 space-y-3'>
              <p className='text-sm font-medium'>¿Cómo programar un envío?</p>
              <ol className='text-sm text-muted-foreground space-y-2 list-decimal list-inside'>
                <li>
                  <span className='inline-flex items-center gap-1'>
                    <Sparkles className='h-3.5 w-3.5 inline' />
                    Abre el explorador y configura filtros / columnas
                  </span>
                </li>
                <li>
                  <span className='inline-flex items-center gap-1'>
                    <Bookmark className='h-3.5 w-3.5 inline' />
                    Guarda la consulta con un nombre
                  </span>
                </li>
                <li>
                  <span className='inline-flex items-center gap-1'>
                    <Mail className='h-3.5 w-3.5 inline' />
                    Pulsa Programar y elige frecuencia y destinatarios
                  </span>
                </li>
              </ol>
              <div className='flex flex-wrap gap-2 pt-1'>
                {!hasSavedReports ? (
                  <Button
                    size='sm'
                    onClick={() => router.push('/inventory/reports/explore')}
                  >
                    Ir al explorador
                    <ArrowRight className='h-4 w-4 ml-1.5' />
                  </Button>
                ) : (
                  <>
                    <Button size='sm' onClick={() => openCreate()}>
                      Programar ahora
                    </Button>
                    <Button size='sm' variant='outline' onClick={scrollToSavedReports}>
                      Ver reportes guardados
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {schedules.length > 0 ? (
            <div className='space-y-3'>
              {schedules.map(schedule => (
                <div
                  key={schedule.id}
                  className='rounded-lg border p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'
                >
                  <div className='min-w-0'>
                    <p className='font-medium truncate'>{schedule.savedReportName}</p>
                    <p className='text-xs text-muted-foreground'>
                      {frequencyLabel(schedule.frequency)} · {schedule.scheduleTime}
                      {` · ${exportFormatLabel(schedule.exportFormat)}`}
                      {schedule.nextRunAt &&
                        ` · Próximo: ${new Date(schedule.nextRunAt).toLocaleString('es-EC')}`}
                    </p>
                    {schedule.recipients.length > 0 && (
                      <p className='text-xs text-muted-foreground truncate'>
                        → {schedule.recipients.join(', ')}
                      </p>
                    )}
                    {schedule.lastStatus === 'failed' && schedule.lastError && (
                      <p className='text-xs text-destructive mt-1'>{schedule.lastError}</p>
                    )}
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                      {schedule.enabled ? 'Activo' : 'Pausado'}
                    </Badge>
                    <Button variant='ghost' size='icon' onClick={() => toggleEnabled(schedule)}>
                      {schedule.enabled ? (
                        <Pause className='h-4 w-4' />
                      ) : (
                        <Play className='h-4 w-4' />
                      )}
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='text-muted-foreground hover:text-destructive'
                      onClick={() => handleDelete(schedule.id)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            hasSavedReports && (
              <p className='text-sm text-muted-foreground text-center py-2'>
                Tienes {savedReports.length} consulta(s) guardada(s). Pulsa{' '}
                <strong className='text-foreground'>Programar</strong> para crear tu primer envío.
              </p>
            )
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Programar envío por email</DialogTitle>
            <DialogDescription>
              Elige el formato de adjunto. Si dejas destinatarios vacío, se usa tu email.
            </DialogDescription>
          </DialogHeader>

          {!hasSavedReports ? (
            <div className='space-y-4 py-2'>
              <p className='text-sm text-muted-foreground'>
                Primero necesitas guardar una consulta desde el explorador. Allí configuras filtros,
                columnas y luego usas <strong className='text-foreground'>Guardar consulta</strong>.
              </p>
              <Button
                className='w-full sm:w-auto'
                onClick={() => {
                  handleDialogChange(false)
                  router.push('/inventory/reports/explore')
                }}
              >
                Ir al explorador
                <ArrowRight className='h-4 w-4 ml-1.5' />
              </Button>
            </div>
          ) : (
            <div className='space-y-3'>
              <div className='space-y-1'>
                <Label>Reporte guardado</Label>
                <Select value={savedReportId} onValueChange={setSavedReportId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar reporte' />
                  </SelectTrigger>
                  <SelectContent>
                    {savedReports.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                  También puedes programar desde el icono de calendario en cada reporte guardado.
                </p>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <Label>Frecuencia</Label>
                  <Select
                    value={frequency}
                    onValueChange={v => setFrequency(v as typeof frequency)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='DAILY'>Diario</SelectItem>
                      <SelectItem value='WEEKLY'>Semanal</SelectItem>
                      <SelectItem value='MONTHLY'>Mensual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label>Hora</Label>
                  <Input
                    type='time'
                    value={scheduleTime}
                    onChange={e => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
              {frequency === 'WEEKLY' && (
                <div className='space-y-1'>
                  <Label>Día de la semana</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_OPTIONS.map(d => (
                        <SelectItem key={d.value} value={String(d.value)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {frequency === 'MONTHLY' && (
                <div className='space-y-1'>
                  <Label>Día del mes</Label>
                  <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={String(d)}>
                          Día {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className='space-y-1'>
                <Label>Formato de envío</Label>
                <Select
                  value={exportFormat}
                  onValueChange={v => setExportFormat(v as typeof exportFormat)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='BOTH'>CSV + PDF</SelectItem>
                    <SelectItem value='CSV'>Solo CSV</SelectItem>
                    <SelectItem value='PDF'>Solo PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1'>
                <Label>Destinatarios (opcional, separados por coma)</Label>
                <Input
                  placeholder='email1@empresa.com, email2@empresa.com'
                  value={recipients}
                  onChange={e => setRecipients(e.target.value)}
                />
              </div>
              {error && <p className='text-sm text-destructive'>{error}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => handleDialogChange(false)}>
              Cancelar
            </Button>
            {hasSavedReports && (
              <Button onClick={handleCreate} disabled={saving || !savedReportId}>
                {saving && <Loader2 className='h-4 w-4 animate-spin mr-1.5' />}
                Crear programación
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

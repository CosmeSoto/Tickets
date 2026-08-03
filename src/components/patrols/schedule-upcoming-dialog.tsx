'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { PatrolStatusBadge } from '@/components/patrol/patrol-status-badge'

interface UpcomingPatrol {
  id: string
  status: string
  scheduledStart: string
  scheduledEnd: string
  route: { id: string; name: string }
}

interface ScheduleUpcomingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string | null
  scheduleLabel?: string
}

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', {
    timeZone: DEFAULT_TIMEZONE,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export function ScheduleUpcomingDialog({
  open,
  onOpenChange,
  scheduleId,
  scheduleLabel,
}: ScheduleUpcomingDialogProps) {
  const [loading, setLoading] = useState(false)
  const [patrols, setPatrols] = useState<UpcomingPatrol[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!scheduleId) return
    setLoading(true)
    setError(null)
    try {
      const from = new Date()
      from.setHours(0, 0, 0, 0)
      const params = new URLSearchParams({
        scheduleId,
        status: 'PENDING,IN_PROGRESS',
        from: from.toISOString(),
        limit: '50',
        page: '1',
      })
      const res = await fetch(`/api/patrols?${params}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'No se pudieron cargar las rondas')
      }
      const json = await res.json()
      setPatrols(json.data ?? [])
    } catch (err) {
      setPatrols([])
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [scheduleId])

  useEffect(() => {
    if (open && scheduleId) void load()
  }, [open, scheduleId, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <CalendarClock className='h-5 w-5' />
            Próximas rondas
          </DialogTitle>
          <DialogDescription>
            {scheduleLabel
              ? `Instancias generadas para “${scheduleLabel}” (desde hoy).`
              : 'Instancias generadas a partir de esta programación (desde hoy).'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='flex items-center justify-center py-10 text-muted-foreground text-sm gap-2'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Cargando…
          </div>
        ) : error ? (
          <p className='text-sm text-destructive py-6 text-center'>{error}</p>
        ) : patrols.length === 0 ? (
          <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
            No hay rondas pendientes o en curso desde hoy. Si acabas de crear la programación,
            guarda de nuevo o espera a que se regeneren las instancias (hasta 30 días).
          </div>
        ) : (
          <div className='space-y-2 max-h-[360px] overflow-y-auto'>
            <div className='flex items-center justify-between text-xs text-muted-foreground px-0.5'>
              <span>{patrols.length} ronda(s)</span>
              <Badge variant='outline' className='text-xs font-normal'>
                Orden: más próximas primero
              </Badge>
            </div>
            {patrols.map(p => (
              <div
                key={p.id}
                className='flex items-start justify-between gap-3 rounded-lg border p-3 text-sm'
              >
                <div className='min-w-0 space-y-0.5'>
                  <p className='font-medium capitalize'>{formatWhen(p.scheduledStart)}</p>
                  <p className='text-xs text-muted-foreground'>
                    Hasta {formatWhen(p.scheduledEnd)}
                    {p.route?.name ? ` · ${p.route.name}` : ''}
                  </p>
                </div>
                <PatrolStatusBadge status={p.status} />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

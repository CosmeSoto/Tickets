'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, CalendarClock, Pencil, PowerOff, Power, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { ExportButton } from '@/components/common/export-button'
import { useModuleData } from '@/hooks/common/use-module-data'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import { createScheduleColumns } from '@/components/patrols/patrol-columns'
import {
  PATROL_SCHEDULES_EXPORT_COLUMNS,
  PATROL_RECURRENCE_LABELS_ES,
} from '@/lib/utils/patrol-utils'

interface PatrolSchedule {
  id: string
  familyId: string
  routeId: string
  agentId: string
  scheduledStart: string
  scheduledEnd: string
  recurrence: string
  recurrenceDays: number[]
  isActive: boolean
  createdAt: string
  route: { id: string; name: string }
  agent: { id: string; name: string; email: string }
}

interface Family {
  id: string
  name: string
  code: string
}

interface PatrolRoute {
  id: string
  name: string
}

interface Agent {
  id: string
  name: string
  email: string
  role: string
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/**
 * Convierte un día local (0-6) a día UTC dado un datetime-local string.
 * Necesario porque el scheduler usa getUTCDay() para calcular ocurrencias.
 * Para horas 00:00-18:59 Ecuador (UTC-5), el día local = día UTC.
 * Para horas 19:00-23:59 Ecuador, el día UTC es el día siguiente.
 */
function localDayToUTCDay(localDay: number, scheduledStartLocal: string): number {
  if (!scheduledStartLocal) return localDay
  // Crear una fecha con el día local seleccionado y la hora del scheduledStart
  // para determinar si cruza medianoche UTC
  const refDate = new Date(scheduledStartLocal)
  if (isNaN(refDate.getTime())) return localDay
  // Diferencia entre día UTC y día local del scheduledStart
  const localDayOfRef = refDate.getDay()
  const utcDayOfRef = refDate.getUTCDay()
  const dayOffset = (utcDayOfRef - localDayOfRef + 7) % 7
  return (localDay + dayOffset) % 7
}

/**
 * Convierte un día UTC (0-6) a día local dado un datetime-local string.
 * Usado al cargar un schedule existente para mostrar los días correctos al usuario.
 */
function utcDayToLocalDay(utcDay: number, scheduledStartLocal: string): number {
  if (!scheduledStartLocal) return utcDay
  const refDate = new Date(scheduledStartLocal)
  if (isNaN(refDate.getTime())) return utcDay
  const localDayOfRef = refDate.getDay()
  const utcDayOfRef = refDate.getUTCDay()
  const dayOffset = (utcDayOfRef - localDayOfRef + 7) % 7
  return (utcDay - dayOffset + 7) % 7
}

interface FormData {
  familyId: string
  routeId: string
  agentId: string
  scheduledStart: string // datetime-local: fecha + hora de inicio
  scheduledEnd: string // datetime-local para NONE; solo se usa la hora para recurrencias
  endTimeOnly: string // time (HH:MM) — hora de fin para recurrencias DAILY/WEEKLY/CUSTOM
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'CUSTOM'
  recurrenceDays: number[]
}

const EMPTY_FORM: FormData = {
  familyId: '',
  routeId: '',
  agentId: '',
  scheduledStart: '',
  scheduledEnd: '',
  endTimeOnly: '',
  recurrence: 'NONE',
  recurrenceDays: [],
}

export default function SchedulesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  const [families, setFamilies] = useState<Family[]>([])
  const [routes, setRoutes] = useState<PatrolRoute[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [permanentlyDeletingId, setPermanentlyDeletingId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Build endpoint
  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    params.append('limit', '100')
    if (debouncedSearch) params.append('search', debouncedSearch)
    if (includeInactive) params.append('includeInactive', 'true')
    return `/api/patrols/schedules?${params.toString()}`
  }, [debouncedSearch, includeInactive])

  // Fetch data
  const {
    data: schedulesRaw,
    loading,
    error,
    reload,
  } = useModuleData<PatrolSchedule>({
    endpoint,
    initialLoad: true,
  })

  const schedules = schedulesRaw || []

  // Pagination
  const pagination = usePagination(schedules, { pageSize: 20 })

  // Export
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'programaciones-rondas',
    title: 'Programaciones de Rondas',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${schedules.length} programaciones`,
    getData: () => schedules,
    columns: PATROL_SCHEDULES_EXPORT_COLUMNS,
  })

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchRoutesForFamily = useCallback(async (familyId: string) => {
    if (!familyId) {
      setRoutes([])
      return
    }
    try {
      const res = await fetch(`/api/patrols/routes?familyId=${familyId}&limit=100`)
      const data = await res.json()
      setRoutes(data.data ?? [])
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchAgents = useCallback(async (familyId?: string) => {
    try {
      const params = new URLSearchParams()
      params.append('patrolsEnabled', 'true')
      params.append('limit', '100')
      if (familyId) params.append('familyId', familyId)
      const res = await fetch(`/api/users?${params.toString()}`)
      const data = await res.json()
      if (data.data) setAgents(data.data)
    } catch {
      /* silencioso */
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchFamilies()
    fetchAgents()
  }, [session, status, router, fetchFamilies, fetchAgents])

  useEffect(() => {
    if (form.familyId) {
      fetchRoutesForFamily(form.familyId)
      fetchAgents(form.familyId)
    } else {
      fetchRoutesForFamily('')
      fetchAgents()
    }
  }, [form.familyId, fetchRoutesForFamily, fetchAgents])

  const toggleDay = (localDay: number) => {
    // Convertir el día local seleccionado a día UTC para guardarlo
    const utcDay = localDayToUTCDay(localDay, form.scheduledStart)
    setForm(f => ({
      ...f,
      recurrenceDays: f.recurrenceDays.includes(utcDay)
        ? f.recurrenceDays.filter(d => d !== utcDay)
        : [...f.recurrenceDays, utcDay].sort((a, b) => a - b),
    }))
  }

  // Cuando cambia scheduledStart, recalcular recurrenceDays si ya hay días seleccionados
  // para mantener la correspondencia UTC correcta
  const handleStartChange = (newStart: string) => {
    if (form.recurrenceDays.length > 0 && form.scheduledStart) {
      // Convertir los días UTC actuales a días locales con la hora anterior
      // y luego reconvertir a UTC con la nueva hora
      const oldLocalDays = form.recurrenceDays.map(utcDay =>
        utcDayToLocalDay(utcDay, form.scheduledStart)
      )
      const newUtcDays = oldLocalDays
        .map(localDay => localDayToUTCDay(localDay, newStart))
        .filter((d, i, arr) => arr.indexOf(d) === i) // deduplicar
        .sort((a, b) => a - b)
      setForm(f => ({ ...f, scheduledStart: newStart, recurrenceDays: newUtcDays }))
    } else {
      setForm(f => ({ ...f, scheduledStart: newStart }))
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, familyId: families[0]?.id ?? '' })
    setDialogOpen(true)
  }

  const openEdit = (schedule: PatrolSchedule) => {
    setEditingId(schedule.id)

    // Formatear fechas para datetime-local (usa hora local del cliente)
    const formatDateTimeLocal = (iso: string) => {
      const date = new Date(iso)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    // Para recurrencias, extraer solo la hora de fin del scheduledEnd
    // El scheduledEnd en DB puede tener fecha incorrecta si fue creado con bug anterior
    // Usamos solo HH:MM del scheduledEnd para el campo endTimeOnly
    const endDate = new Date(schedule.scheduledEnd)
    const endTimeOnly = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

    setForm({
      familyId: schedule.familyId,
      routeId: schedule.routeId,
      agentId: schedule.agentId,
      scheduledStart: formatDateTimeLocal(schedule.scheduledStart),
      scheduledEnd: formatDateTimeLocal(schedule.scheduledEnd),
      endTimeOnly,
      recurrence: schedule.recurrence as any,
      recurrenceDays: schedule.recurrenceDays,
    })

    // Cargar rutas y agentes para la familia del schedule
    fetchRoutesForFamily(schedule.familyId)
    fetchAgents(schedule.familyId)
    setDialogOpen(true)
  }

  const handleSave = async () => {
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

    // Construir scheduledEnd correcto según el tipo de recurrencia
    let scheduledEndISO: string
    if (isRecurring) {
      // Para recurrencias: el fin es el mismo día que el inicio, con la hora de endTimeOnly
      // Esto garantiza que durationMs sea siempre < 24h
      const startDate = new Date(form.scheduledStart)
      const [endHour, endMin] = form.endTimeOnly.split(':').map(Number)
      const endDate = new Date(startDate)
      endDate.setHours(endHour, endMin, 0, 0)

      // Si la hora de fin es anterior o igual a la de inicio, es del día siguiente
      // (ej: ronda nocturna 23:00 - 01:00)
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

    setSaving(true)
    try {
      const payload = {
        familyId: form.familyId,
        routeId: form.routeId,
        agentId: form.agentId,
        scheduledStart: startISO,
        scheduledEnd: scheduledEndISO,
        recurrence: form.recurrence,
        recurrenceDays: form.recurrenceDays,
      }

      const url = editingId ? `/api/patrols/schedules/${editingId}` : '/api/patrols/schedules'

      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')

      toast({
        title: editingId ? 'Programación actualizada' : 'Programación creada',
        description: editingId
          ? 'Los cambios se han guardado correctamente'
          : data.generatedPatrols > 0
            ? `${data.generatedPatrols} patrulla(s) generada(s)`
            : 'Sin patrullas generadas aún',
      })
      setDialogOpen(false)
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/patrols/schedules/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al desactivar')
      toast({ title: 'Programación desactivada' })
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setDeactivatingId(null)
    }
  }

  const handleReactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/patrols/schedules/${id}?reactivate=true`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al reactivar')
      toast({ title: 'Programación reactivada' })
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setReactivatingId(null)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/patrols/schedules/${id}?permanent=true`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar permanentemente')
      toast({ title: 'Programación eliminada permanentemente' })
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setPermanentlyDeletingId(null)
    }
  }

  if (status === 'loading' || !session) return null

  const columns = createScheduleColumns({
    onEdit: openEdit,
    onDeactivate: id => setDeactivatingId(id),
    onReactivate: id => setReactivatingId(id),
    onPermanentDelete: id => setPermanentlyDeletingId(id),
    isSuperAdmin,
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: schedules.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  return (
    <ModuleLayout
      title='Programación de Rondas'
      subtitle='Asignación de rutas y agentes en horarios específicos'
      loading={loading && schedules.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <Button size='sm' onClick={openCreate}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Nueva Programación</span>
        </Button>
      }
    >
      {/* Filtros */}
      <div className='flex flex-col sm:flex-row gap-3 mb-4'>
        <div className='relative flex-1'>
          <Input
            placeholder='Buscar programaciones...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            id='show-inactive-sched'
            checked={includeInactive}
            onCheckedChange={v => {
              setIncludeInactive(v)
              pagination.goToPage(1)
            }}
          />
          <Label htmlFor='show-inactive-sched' className='text-sm cursor-pointer'>
            Mostrar inactivas
          </Label>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        title='Programaciones'
        description={`Gestión de programaciones (${schedules.length} programaciones)`}
        data={schedules}
        columns={columns}
        loading={loading}
        error={error}
        pagination={paginationConfig}
        onRefresh={reload}
        externalSearch={true}
        hideInternalFilters={true}
        rowActions={(schedule: PatrolSchedule) => (
          <div className='flex items-center gap-1 justify-end'>
            <Button size='sm' variant='ghost' onClick={() => openEdit(schedule)}>
              <Pencil className='h-3.5 w-3.5' />
            </Button>
            {schedule.isActive ? (
              <Button
                size='sm'
                variant='ghost'
                className='text-destructive hover:text-destructive'
                onClick={() => setDeactivatingId(schedule.id)}
              >
                <PowerOff className='h-3.5 w-3.5' />
              </Button>
            ) : (
              <Button
                size='sm'
                variant='ghost'
                className='text-green-600 hover:text-green-700 dark:text-green-400'
                onClick={() => setReactivatingId(schedule.id)}
              >
                <Power className='h-3.5 w-3.5' />
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                size='sm'
                variant='ghost'
                className='text-red-700 hover:text-red-800 dark:text-red-500'
                onClick={() => setPermanentlyDeletingId(schedule.id)}
                title='Eliminar permanentemente'
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        )}
        actions={
          schedules.length > 0 ? (
            <ExportButton
              onExportCSV={exportCSV}
              onExportExcel={exportExcel}
              onExportPDF={exportPDF}
              loading={exporting}
            />
          ) : undefined
        }
        emptyState={{
          icon: <CalendarClock className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
          title: 'No hay programaciones',
          description: 'Crea la primera programación con el botón de arriba',
        }}
      />

      {/* ── Dialog crear/editar ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
            {/* ── 1. Área ── */}
            <div className='space-y-1.5'>
              <Label className='text-sm font-medium'>
                Área <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={form.familyId}
                onValueChange={v => setForm(f => ({ ...f, familyId: v, routeId: '' }))}
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

            {/* ── 2. Ruta ── */}
            <div className='space-y-1.5'>
              <Label className='text-sm font-medium'>
                Ruta <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={form.routeId}
                onValueChange={v => setForm(f => ({ ...f, routeId: v }))}
                disabled={saving || !form.familyId}
              >
                <SelectTrigger className='h-10'>
                  <SelectValue
                    placeholder={
                      form.familyId ? 'Selecciona una ruta' : 'Primero selecciona un área'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {routes.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── 3. Agente ── */}
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

            {/* ── 4. Recurrencia — PRIMERO para que las fechas se adapten ── */}
            <div className='space-y-1.5'>
              <Label className='text-sm font-medium'>Tipo de programación</Label>
              <Select
                value={form.recurrence}
                onValueChange={v =>
                  setForm(f => ({
                    ...f,
                    recurrence: v as FormData['recurrence'],
                    // Limpiar días y hora de fin al cambiar tipo
                    recurrenceDays: [],
                    endTimeOnly: '',
                    // Para NONE, limpiar scheduledEnd para que el usuario lo rellene
                    scheduledEnd: v === 'NONE' ? '' : f.scheduledEnd,
                  }))
                }
                disabled={saving}
              >
                <SelectTrigger className='h-10'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PATROL_RECURRENCE_LABELS_ES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                {form.recurrence === 'NONE' &&
                  'Una sola ronda en la fecha y hora exactas que indiques.'}
                {form.recurrence === 'DAILY' &&
                  'Una ronda cada día a la misma hora, durante 30 días.'}
                {form.recurrence === 'WEEKLY' &&
                  'Una ronda por semana en los días que selecciones.'}
                {form.recurrence === 'CUSTOM' &&
                  'Rondas en los días específicos de la semana que elijas.'}
              </p>
            </div>

            {/* ── 5. Fechas — cambian según recurrencia ── */}
            {form.recurrence === 'NONE' ? (
              /* Sin recurrencia: fecha + hora completa de inicio Y fin */
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
              /* Con recurrencia: fecha+hora de inicio y SOLO hora de fin */
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

            {/* Resumen de duración calculada */}
            {form.scheduledStart &&
              (form.recurrence === 'NONE' ? form.scheduledEnd : form.endTimeOnly) &&
              (() => {
                try {
                  let endDate: Date
                  const startDate = new Date(form.scheduledStart)
                  if (form.recurrence === 'NONE') {
                    endDate = new Date(form.scheduledEnd)
                  } else {
                    const [h, m] = form.endTimeOnly.split(':').map(Number)
                    endDate = new Date(startDate)
                    endDate.setHours(h, m, 0, 0)
                    if (endDate <= startDate) endDate.setDate(endDate.getDate() + 1)
                  }
                  const diffMs = endDate.getTime() - startDate.getTime()
                  if (diffMs > 0) {
                    const diffH = Math.floor(diffMs / 3600000)
                    const diffM = Math.floor((diffMs % 3600000) / 60000)
                    const label =
                      diffH > 0 ? `${diffH}h${diffM > 0 ? ` ${diffM}min` : ''}` : `${diffM}min`
                    return (
                      <p className='text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2'>
                        ⏱ Duración de cada ronda:{' '}
                        <span className='font-medium text-foreground'>{label}</span>
                      </p>
                    )
                  }
                } catch {
                  /* silencioso */
                }
                return null
              })()}

            {/* ── 6. Días de la semana (solo WEEKLY / CUSTOM) ── */}
            {(form.recurrence === 'WEEKLY' || form.recurrence === 'CUSTOM') && (
              <div className='space-y-2'>
                <Label className='text-sm font-medium'>
                  Días de la semana <span className='text-destructive'>*</span>
                </Label>
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

            {/* Banner informativo para recurrencias */}
            {form.recurrence !== 'NONE' && (
              <div className='flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300'>
                <span className='mt-0.5'>ℹ️</span>
                <span>
                  Se generarán rondas automáticamente para los próximos <strong>30 días</strong>. El
                  cron nocturno las mantiene actualizadas.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className='gap-2 pt-2'>
            <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              {editingId ? 'Guardar cambios' : 'Crear programación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate */}
      <AlertDialog open={!!deactivatingId} onOpenChange={() => setDeactivatingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar programación?</AlertDialogTitle>
            <AlertDialogDescription>
              No se generarán más patrullas para esta programación. Las patrullas ya generadas no se
              cancelan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => deactivatingId && handleDeactivate(deactivatingId)}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm reactivate */}
      <AlertDialog open={!!reactivatingId} onOpenChange={() => setReactivatingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar programación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se volverán a generar patrullas para esta programación según su configuración.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-green-700 text-white hover:bg-green-800'
              onClick={() => reactivatingId && handleReactivate(reactivatingId)}
            >
              Reactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm permanent delete */}
      <AlertDialog
        open={!!permanentlyDeletingId}
        onOpenChange={() => setPermanentlyDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar programación PERMANENTEMENTE?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La programación se eliminará completamente de la
              base de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-700 text-white hover:bg-red-800'
              onClick={() => permanentlyDeletingId && handlePermanentDelete(permanentlyDeletingId)}
            >
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

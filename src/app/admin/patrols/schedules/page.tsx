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
  scheduledStart: string
  scheduledEnd: string
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'CUSTOM'
  recurrenceDays: number[]
}

const EMPTY_FORM: FormData = {
  familyId: '',
  routeId: '',
  agentId: '',
  scheduledStart: '',
  scheduledEnd: '',
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

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, familyId: families[0]?.id ?? '' })
    setDialogOpen(true)
  }

  const openEdit = (schedule: PatrolSchedule) => {
    setEditingId(schedule.id)

    // Formatear fechas para datetime-local
    const formatDateTimeLocal = (iso: string) => {
      const date = new Date(iso)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }

    setForm({
      familyId: schedule.familyId,
      routeId: schedule.routeId,
      agentId: schedule.agentId,
      scheduledStart: formatDateTimeLocal(schedule.scheduledStart),
      scheduledEnd: formatDateTimeLocal(schedule.scheduledEnd),
      recurrence: schedule.recurrence as any,
      recurrenceDays: schedule.recurrenceDays,
    })

    // Cargar rutas y agentes para la familia del schedule
    fetchRoutesForFamily(schedule.familyId)
    fetchAgents(schedule.familyId)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (
      !form.familyId ||
      !form.routeId ||
      !form.agentId ||
      !form.scheduledStart ||
      !form.scheduledEnd
    ) {
      toast({
        title: 'Campos requeridos',
        description: 'Completa todos los campos obligatorios',
        variant: 'destructive',
      })
      return
    }
    if (new Date(form.scheduledEnd) <= new Date(form.scheduledStart)) {
      toast({
        title: 'Horario inválido',
        description: 'La hora de fin debe ser posterior a la de inicio',
        variant: 'destructive',
      })
      return
    }

    if (form.recurrence === 'WEEKLY' || form.recurrence === 'CUSTOM') {
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
        scheduledStart: new Date(form.scheduledStart).toISOString(),
        scheduledEnd: new Date(form.scheduledEnd).toISOString(),
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
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Programación' : 'Nueva Programación'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifica los datos de la programación existente.'
                : 'Asigna una ruta a un guardia en un horario específico.'}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1'>
            {/* Área */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>
                Área <span className='text-destructive'>*</span>
              </Label>
              <select
                value={form.familyId}
                onChange={e => setForm(f => ({ ...f, familyId: e.target.value, routeId: '' }))}
                className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                disabled={saving}
              >
                <option value=''>Selecciona un área</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Ruta */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>
                Ruta <span className='text-destructive'>*</span>
              </Label>
              <select
                value={form.routeId}
                onChange={e => setForm(f => ({ ...f, routeId: e.target.value }))}
                className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                disabled={saving || !form.familyId}
              >
                <option value=''>Selecciona una ruta</option>
                {routes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Agente */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>
                Agente <span className='text-destructive'>*</span>
              </Label>
              <select
                value={form.agentId}
                onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}
                className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                disabled={saving}
              >
                <option value=''>Selecciona un agente</option>
                {agents.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.role === 'TECHNICIAN' ? 'Técnico' : 'Cliente'}) — {g.email}
                  </option>
                ))}
              </select>
              {agents.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  No hay usuarios con el módulo de patrullas habilitado
                </p>
              )}
            </div>

            {/* Fechas */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  {form.recurrence === 'NONE' ? 'Inicio' : 'Hora de inicio'}{' '}
                  <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='datetime-local'
                  value={form.scheduledStart}
                  onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
                  disabled={saving}
                />
                {form.recurrence !== 'NONE' && (
                  <p className='text-xs text-muted-foreground'>Hora a la que inicia cada ronda</p>
                )}
              </div>
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  {form.recurrence === 'NONE' ? 'Fin' : 'Hora de fin'}{' '}
                  <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='datetime-local'
                  value={form.scheduledEnd}
                  onChange={e => setForm(f => ({ ...f, scheduledEnd: e.target.value }))}
                  disabled={saving}
                />
                {form.recurrence !== 'NONE' && (
                  <p className='text-xs text-muted-foreground'>Hora a la que termina cada ronda</p>
                )}
              </div>
            </div>

            {form.recurrence !== 'NONE' && (
              <div className='p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400'>
                Con recurrencia activa, se generarán rondas automáticamente para los próximos 30
                días usando la hora de inicio y fin configuradas.
              </div>
            )}

            {/* Recurrencia */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>Recurrencia</Label>
              <select
                value={form.recurrence}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    recurrence: e.target.value as FormData['recurrence'],
                    recurrenceDays: [],
                  }))
                }
                className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                disabled={saving}
              >
                {Object.entries(PATROL_RECURRENCE_LABELS_ES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            {/* Días de la semana (para WEEKLY / CUSTOM) */}
            {(form.recurrence === 'WEEKLY' || form.recurrence === 'CUSTOM') && (
              <div className='space-y-2'>
                <Label className='text-sm'>
                  Días de la semana <span className='text-destructive'>*</span>
                </Label>
                <div className='flex gap-1.5 flex-wrap'>
                  {DAY_LABELS.map((label, localDay) => {
                    // Convertir día local a UTC para comparar con recurrenceDays guardados
                    const utcDay = localDayToUTCDay(localDay, form.scheduledStart)
                    const isSelected = form.recurrenceDays.includes(utcDay)
                    return (
                      <button
                        key={localDay}
                        type='button'
                        onClick={() => toggleDay(localDay)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                        disabled={saving}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
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

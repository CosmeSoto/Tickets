'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  CalendarClock,
  Pencil,
  PowerOff,
  Loader2,
  RefreshCw,
  User,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { useDebounce } from '@/hooks/common/use-debounce'
import { PATROL_RECURRENCE_LABELS_ES } from '@/lib/utils/patrol-utils'

interface PatrolSchedule {
  id: string
  familyId: string
  routeId: string
  guardId: string
  scheduledStart: string
  scheduledEnd: string
  recurrence: string
  recurrenceDays: number[]
  isActive: boolean
  createdAt: string
  route: { id: string; name: string }
  guard: { id: string; name: string; email: string }
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
interface Guard {
  id: string
  name: string
  email: string
  role: string
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const EMPTY_FORM = {
  familyId: '',
  routeId: '',
  guardId: '',
  scheduledStart: '',
  scheduledEnd: '',
  recurrence: 'NONE' as 'NONE' | 'DAILY' | 'WEEKLY' | 'CUSTOM',
  recurrenceDays: [] as number[],
}

export default function SchedulesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [schedules, setSchedules] = useState<PatrolSchedule[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [routes, setRoutes] = useState<PatrolRoute[]>([])
  const [guards, setGuards] = useState<Guard[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        ...(includeInactive ? { includeInactive: 'true' } : {}),
      })
      const res = await fetch(`/api/patrols/schedules?${params}`)
      const data = await res.json()
      setSchedules(data.data ?? [])
      setPagination(data.pagination ?? null)
    } catch {
      toast({
        title: 'Error',
        description: 'Error al cargar programaciones',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [page, includeInactive, toast])

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

  const fetchGuards = useCallback(async () => {
    try {
      // Usuarios con patrolsEnabled=true
      const res = await fetch('/api/users?patrolsEnabled=true&limit=100')
      const data = await res.json()
      if (data.success || data.data) setGuards(data.data ?? [])
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
    fetchGuards()
  }, [session, status, router, fetchFamilies, fetchGuards])

  useEffect(() => {
    if (session) fetchSchedules()
  }, [session, fetchSchedules])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    if (form.familyId) fetchRoutesForFamily(form.familyId)
  }, [form.familyId, fetchRoutesForFamily])

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, familyId: families[0]?.id ?? '' })
    setDialogOpen(true)
  }

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      recurrenceDays: f.recurrenceDays.includes(day)
        ? f.recurrenceDays.filter(d => d !== day)
        : [...f.recurrenceDays, day].sort(),
    }))
  }

  const handleSave = async () => {
    if (
      !form.familyId ||
      !form.routeId ||
      !form.guardId ||
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
    if (['WEEKLY', 'CUSTOM'].includes(form.recurrence) && form.recurrenceDays.length === 0) {
      toast({
        title: 'Días requeridos',
        description: 'Selecciona al menos un día de la semana',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/patrols/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          familyId: form.familyId,
          routeId: form.routeId,
          guardId: form.guardId,
          scheduledStart: new Date(form.scheduledStart).toISOString(),
          scheduledEnd: new Date(form.scheduledEnd).toISOString(),
          recurrence: form.recurrence,
          recurrenceDays: form.recurrenceDays,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear')

      toast({
        title: 'Programación creada',
        description:
          data.generatedPatrols > 0
            ? `${data.generatedPatrols} patrulla(s) generada(s)`
            : 'Sin patrullas generadas aún',
      })
      setDialogOpen(false)
      fetchSchedules()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al crear',
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
      fetchSchedules()
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

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('es-EC', {
      timeZone: 'America/Guayaquil',
      dateStyle: 'short',
      timeStyle: 'short',
    })

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Programación de Rondas'
      subtitle='Asignación de rutas y guardias en horarios específicos'
      loading={loading && schedules.length === 0}
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
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Buscar...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            id='show-inactive-sched'
            checked={includeInactive}
            onCheckedChange={v => {
              setIncludeInactive(v)
              setPage(1)
            }}
          />
          <Label htmlFor='show-inactive-sched' className='text-sm cursor-pointer'>
            Mostrar inactivas
          </Label>
        </div>
        <Button variant='outline' size='sm' onClick={fetchSchedules} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <CalendarClock className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>No hay programaciones</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Crea la primera programación con el botón de arriba
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className='space-y-3 sm:hidden'>
            {schedules.map(sched => (
              <Card key={sched.id} className={!sched.isActive ? 'opacity-60' : ''}>
                <CardContent className='p-4 space-y-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium text-sm truncate'>{sched.route.name}</p>
                      <div className='flex items-center gap-1 text-xs text-muted-foreground mt-0.5'>
                        <User className='h-3 w-3' />
                        <span className='truncate'>{sched.guard.name}</span>
                      </div>
                    </div>
                    <div className='flex gap-1 flex-shrink-0'>
                      <Badge variant='outline' className='text-xs'>
                        {PATROL_RECURRENCE_LABELS_ES[sched.recurrence] ?? sched.recurrence}
                      </Badge>
                      <Badge variant={sched.isActive ? 'default' : 'secondary'} className='text-xs'>
                        {sched.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                  </div>
                  <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <Clock className='h-3 w-3' />
                    <span>{formatDateTime(sched.scheduledStart)}</span>
                  </div>
                  {sched.isActive && (
                    <Button
                      size='sm'
                      variant='outline'
                      className='w-full text-destructive hover:text-destructive'
                      onClick={() => setDeactivatingId(sched.id)}
                    >
                      <PowerOff className='h-3 w-3 mr-1' /> Desactivar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className='hidden sm:block rounded-lg border overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Ruta</th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Guardia</th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell'>
                    Inicio
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell'>
                    Recurrencia
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Estado</th>
                  <th className='w-16' />
                </tr>
              </thead>
              <tbody className='divide-y'>
                {schedules.map(sched => (
                  <tr
                    key={sched.id}
                    className={`hover:bg-muted/30 transition-colors ${!sched.isActive ? 'opacity-60' : ''}`}
                  >
                    <td className='px-4 py-3 font-medium'>{sched.route.name}</td>
                    <td className='px-4 py-3 text-muted-foreground'>{sched.guard.name}</td>
                    <td className='px-4 py-3 text-muted-foreground hidden md:table-cell'>
                      {formatDateTime(sched.scheduledStart)}
                    </td>
                    <td className='px-4 py-3 hidden lg:table-cell'>
                      <Badge variant='outline' className='text-xs'>
                        {PATROL_RECURRENCE_LABELS_ES[sched.recurrence] ?? sched.recurrence}
                      </Badge>
                    </td>
                    <td className='px-4 py-3'>
                      <Badge variant={sched.isActive ? 'default' : 'secondary'} className='text-xs'>
                        {sched.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className='px-4 py-3'>
                      {sched.isActive && (
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-destructive hover:text-destructive'
                          onClick={() => setDeactivatingId(sched.id)}
                        >
                          <PowerOff className='h-3.5 w-3.5' />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className='flex items-center justify-between mt-4'>
              <p className='text-xs text-muted-foreground'>
                {pagination.total} programación{pagination.total !== 1 ? 'es' : ''}
              </p>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!pagination.hasNext}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Dialog crear ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Nueva Programación</DialogTitle>
            <DialogDescription>
              Asigna una ruta a un guardia en un horario específico.
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

            {/* Guardia */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>
                Guardia <span className='text-destructive'>*</span>
              </Label>
              <select
                value={form.guardId}
                onChange={e => setForm(f => ({ ...f, guardId: e.target.value }))}
                className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                disabled={saving}
              >
                <option value=''>Selecciona un guardia</option>
                {guards.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.role === 'TECHNICIAN' ? 'Técnico' : 'Cliente'}) — {g.email}
                  </option>
                ))}
              </select>
              {guards.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  No hay usuarios con el módulo de patrullas habilitado
                </p>
              )}
            </div>

            {/* Fechas */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  Inicio <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='datetime-local'
                  value={form.scheduledStart}
                  onChange={e => setForm(f => ({ ...f, scheduledStart: e.target.value }))}
                  disabled={saving}
                />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  Fin <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='datetime-local'
                  value={form.scheduledEnd}
                  onChange={e => setForm(f => ({ ...f, scheduledEnd: e.target.value }))}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Recurrencia */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>Recurrencia</Label>
              <select
                value={form.recurrence}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    recurrence: e.target.value as typeof form.recurrence,
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
            {['WEEKLY', 'CUSTOM'].includes(form.recurrence) && (
              <div className='space-y-2'>
                <Label className='text-sm'>
                  Días de la semana <span className='text-destructive'>*</span>
                </Label>
                <div className='flex gap-1.5 flex-wrap'>
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type='button'
                      onClick={() => toggleDay(i)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        form.recurrenceDays.includes(i)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                      disabled={saving}
                    >
                      {label}
                    </button>
                  ))}
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
              Crear programación
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
    </ModuleLayout>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  ClipboardList,
  Pencil,
  PowerOff,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  GripVertical,
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
import { Textarea } from '@/components/ui/textarea'
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

interface CheckpointOption {
  id: string
  name: string
  location: string
  isActive: boolean
  qrType: 'DYNAMIC' | 'STATIC'
}

interface RouteCheckpointEntry {
  checkpointId: string
  name: string
  location: string
  order: number
  isRequired: boolean
  isActive: boolean
}

interface PatrolRoute {
  id: string
  familyId: string
  name: string
  description: string | null
  estimatedDurationMinutes: number
  isActive: boolean
  createdAt: string
  _count: { routeCheckpoints: number }
  routeCheckpoints: Array<{
    order: number
    isRequired: boolean
    checkpoint: { id: string; name: string; location: string; isActive: boolean; qrType: string }
  }>
}

interface Family {
  id: string
  name: string
  code: string
}

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

const EMPTY_FORM = {
  familyId: '',
  name: '',
  description: '',
  estimatedDurationMinutes: '60',
}

export default function RoutesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [routes, setRoutes] = useState<PatrolRoute[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [routeCheckpoints, setRouteCheckpoints] = useState<RouteCheckpointEntry[]>([])
  const [availableCheckpoints, setAvailableCheckpoints] = useState<CheckpointOption[]>([])
  const [saving, setSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(includeInactive ? { includeInactive: 'true' } : {}),
      })
      const res = await fetch(`/api/patrols/routes?${params}`)
      const data = await res.json()
      setRoutes(data.data ?? [])
      setPagination(data.pagination ?? null)
    } catch {
      toast({ title: 'Error', description: 'Error al cargar rutas', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, includeInactive, toast])

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      /* silencioso */
    }
  }, [])

  const fetchCheckpointsForFamily = useCallback(async (familyId: string) => {
    if (!familyId) {
      setAvailableCheckpoints([])
      return
    }
    try {
      const res = await fetch(`/api/patrols/checkpoints?familyId=${familyId}&limit=100`)
      const data = await res.json()
      setAvailableCheckpoints(data.data ?? [])
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
  }, [session, status, router, fetchFamilies])

  useEffect(() => {
    if (session) fetchRoutes()
  }, [session, fetchRoutes])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    if (form.familyId) fetchCheckpointsForFamily(form.familyId)
  }, [form.familyId, fetchCheckpointsForFamily])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, familyId: families[0]?.id ?? '' })
    setRouteCheckpoints([])
    setDialogOpen(true)
  }

  const openEdit = (route: PatrolRoute) => {
    setEditingId(route.id)
    setForm({
      familyId: route.familyId,
      name: route.name,
      description: route.description ?? '',
      estimatedDurationMinutes: String(route.estimatedDurationMinutes),
    })
    setRouteCheckpoints(
      route.routeCheckpoints
        .sort((a, b) => a.order - b.order)
        .map(rc => ({
          checkpointId: rc.checkpoint.id,
          name: rc.checkpoint.name,
          location: rc.checkpoint.location,
          order: rc.order,
          isRequired: rc.isRequired,
          isActive: rc.checkpoint.isActive,
        }))
    )
    setDialogOpen(true)
  }

  const addCheckpoint = (cp: CheckpointOption) => {
    if (routeCheckpoints.some(rc => rc.checkpointId === cp.id)) return
    setRouteCheckpoints(prev => [
      ...prev,
      {
        checkpointId: cp.id,
        name: cp.name,
        location: cp.location,
        order: prev.length + 1,
        isRequired: true,
        isActive: cp.isActive,
      },
    ])
  }

  const removeCheckpoint = (checkpointId: string) => {
    setRouteCheckpoints(prev => {
      const filtered = prev.filter(rc => rc.checkpointId !== checkpointId)
      return filtered.map((rc, i) => ({ ...rc, order: i + 1 }))
    })
  }

  const moveCheckpoint = (index: number, direction: 'up' | 'down') => {
    setRouteCheckpoints(prev => {
      const arr = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= arr.length) return arr
      ;[arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]]
      return arr.map((rc, i) => ({ ...rc, order: i + 1 }))
    })
  }

  const toggleRequired = (checkpointId: string) => {
    setRouteCheckpoints(prev =>
      prev.map(rc =>
        rc.checkpointId === checkpointId ? { ...rc, isRequired: !rc.isRequired } : rc
      )
    )
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.familyId) {
      toast({
        title: 'Campos requeridos',
        description: 'Nombre y área son obligatorios',
        variant: 'destructive',
      })
      return
    }
    if (routeCheckpoints.length === 0) {
      toast({
        title: 'Sin checkpoints',
        description: 'Agrega al menos un checkpoint a la ruta',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const body = {
        familyId: form.familyId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        estimatedDurationMinutes: parseInt(form.estimatedDurationMinutes) || 60,
        checkpoints: routeCheckpoints.map(rc => ({
          checkpointId: rc.checkpointId,
          order: rc.order,
          isRequired: rc.isRequired,
        })),
      }

      const res = editingId
        ? await fetch(`/api/patrols/routes/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/patrols/routes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')

      if (data.warnings?.length > 0) {
        toast({ title: 'Ruta guardada con advertencias', description: data.warnings.join(', ') })
      } else {
        toast({ title: editingId ? 'Ruta actualizada' : 'Ruta creada' })
      }
      setDialogOpen(false)
      fetchRoutes()
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
      const res = await fetch(`/api/patrols/routes/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al desactivar')
      toast({
        title: 'Ruta desactivada',
        description:
          data.cancelledPatrols > 0
            ? `${data.cancelledPatrols} patrulla(s) cancelada(s)`
            : undefined,
      })
      fetchRoutes()
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

  const hasInactiveCheckpoints = routeCheckpoints.some(rc => !rc.isActive)

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Rutas de Patrulla'
      subtitle='Secuencias ordenadas de checkpoints para los recorridos'
      loading={loading && routes.length === 0}
      headerActions={
        <Button size='sm' onClick={openCreate}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Nueva Ruta</span>
        </Button>
      }
    >
      {/* Filtros */}
      <div className='flex flex-col sm:flex-row gap-3 mb-4'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Buscar rutas...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            id='show-inactive-routes'
            checked={includeInactive}
            onCheckedChange={v => {
              setIncludeInactive(v)
              setPage(1)
            }}
          />
          <Label htmlFor='show-inactive-routes' className='text-sm cursor-pointer'>
            Mostrar inactivas
          </Label>
        </div>
        <Button variant='outline' size='sm' onClick={fetchRoutes} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : routes.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <ClipboardList className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>No hay rutas</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Crea la primera ruta con el botón de arriba
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className='space-y-3 sm:hidden'>
            {routes.map(route => (
              <Card key={route.id} className={!route.isActive ? 'opacity-60' : ''}>
                <CardContent className='p-4 space-y-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium text-sm truncate'>{route.name}</p>
                      <p className='text-xs text-muted-foreground'>
                        {route.estimatedDurationMinutes} min estimados
                      </p>
                    </div>
                    <Badge
                      variant={route.isActive ? 'default' : 'secondary'}
                      className='text-xs flex-shrink-0'
                    >
                      {route.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    {route._count.routeCheckpoints} checkpoint
                    {route._count.routeCheckpoints !== 1 ? 's' : ''}
                  </p>
                  {route.routeCheckpoints.some(rc => !rc.checkpoint.isActive) && (
                    <div className='flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400'>
                      <AlertTriangle className='h-3 w-3' />
                      Contiene checkpoints inactivos
                    </div>
                  )}
                  <div className='flex gap-2 pt-1'>
                    <Button
                      size='sm'
                      variant='outline'
                      className='flex-1'
                      onClick={() => openEdit(route)}
                    >
                      <Pencil className='h-3 w-3 mr-1' /> Editar
                    </Button>
                    {route.isActive && (
                      <Button
                        size='sm'
                        variant='outline'
                        className='text-destructive hover:text-destructive'
                        onClick={() => setDeactivatingId(route.id)}
                      >
                        <PowerOff className='h-3 w-3' />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className='hidden sm:block rounded-lg border overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Nombre</th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell'>
                    Duración est.
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>
                    Checkpoints
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Estado</th>
                  <th className='w-24' />
                </tr>
              </thead>
              <tbody className='divide-y'>
                {routes.map(route => (
                  <tr
                    key={route.id}
                    className={`hover:bg-muted/30 transition-colors ${!route.isActive ? 'opacity-60' : ''}`}
                  >
                    <td className='px-4 py-3'>
                      <div>
                        <p className='font-medium'>{route.name}</p>
                        {route.routeCheckpoints.some(rc => !rc.checkpoint.isActive) && (
                          <div className='flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 mt-0.5'>
                            <AlertTriangle className='h-3 w-3' />
                            Checkpoints inactivos
                          </div>
                        )}
                      </div>
                    </td>
                    <td className='px-4 py-3 text-muted-foreground hidden md:table-cell'>
                      {route.estimatedDurationMinutes} min
                    </td>
                    <td className='px-4 py-3 text-muted-foreground'>
                      {route._count.routeCheckpoints}
                    </td>
                    <td className='px-4 py-3'>
                      <Badge variant={route.isActive ? 'default' : 'secondary'} className='text-xs'>
                        {route.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-1 justify-end'>
                        <Button size='sm' variant='ghost' onClick={() => openEdit(route)}>
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
                        {route.isActive && (
                          <Button
                            size='sm'
                            variant='ghost'
                            className='text-destructive hover:text-destructive'
                            onClick={() => setDeactivatingId(route.id)}
                          >
                            <PowerOff className='h-3.5 w-3.5' />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className='flex items-center justify-between mt-4'>
              <p className='text-xs text-muted-foreground'>
                {pagination.total} ruta{pagination.total !== 1 ? 's' : ''}
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

      {/* ── Dialog crear/editar ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Ruta' : 'Nueva Ruta'}</DialogTitle>
            <DialogDescription>
              Define la secuencia de checkpoints que componen esta ruta de patrullaje.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              {/* Área */}
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  Área <span className='text-destructive'>*</span>
                </Label>
                <select
                  value={form.familyId}
                  onChange={e => setForm(f => ({ ...f, familyId: e.target.value }))}
                  className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                  disabled={saving || !!editingId}
                >
                  <option value=''>Selecciona un área</option>
                  {families.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Duración */}
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  Duración estimada (min) <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='number'
                  min={1}
                  max={1440}
                  value={form.estimatedDurationMinutes}
                  onChange={e => setForm(f => ({ ...f, estimatedDurationMinutes: e.target.value }))}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Nombre */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>
                Nombre <span className='text-destructive'>*</span>
              </Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder='Ej: Ronda Nocturna Planta Baja'
                disabled={saving}
                maxLength={200}
              />
            </div>

            {/* Descripción */}
            <div className='space-y-1.5'>
              <Label className='text-sm'>Descripción (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder='Notas sobre esta ruta...'
                disabled={saving}
                rows={2}
              />
            </div>

            {/* Checkpoints de la ruta */}
            <div className='space-y-2'>
              <Label className='text-sm font-medium'>
                Checkpoints en la ruta ({routeCheckpoints.length})
              </Label>

              {hasInactiveCheckpoints && (
                <div className='flex items-center gap-2 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400'>
                  <AlertTriangle className='h-3.5 w-3.5 flex-shrink-0' />
                  Esta ruta contiene checkpoints inactivos. No podrá programarse hasta
                  reemplazarlos.
                </div>
              )}

              {routeCheckpoints.length === 0 ? (
                <div className='p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground'>
                  Agrega checkpoints desde la lista de abajo
                </div>
              ) : (
                <div className='space-y-1.5 max-h-48 overflow-y-auto'>
                  {routeCheckpoints.map((rc, i) => (
                    <div
                      key={rc.checkpointId}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-sm ${!rc.isActive ? 'border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/10' : 'bg-muted/30'}`}
                    >
                      <GripVertical className='h-4 w-4 text-muted-foreground flex-shrink-0' />
                      <span className='w-5 text-xs text-muted-foreground font-mono'>
                        {rc.order}.
                      </span>
                      <div className='flex-1 min-w-0'>
                        <p className='truncate font-medium text-xs'>{rc.name}</p>
                        <p className='truncate text-xs text-muted-foreground'>{rc.location}</p>
                      </div>
                      <div className='flex items-center gap-1 flex-shrink-0'>
                        <button
                          type='button'
                          onClick={() => toggleRequired(rc.checkpointId)}
                          className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${rc.isRequired ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground'}`}
                          title={
                            rc.isRequired
                              ? 'Requerido (click para hacer opcional)'
                              : 'Opcional (click para hacer requerido)'
                          }
                        >
                          {rc.isRequired ? 'Req' : 'Opt'}
                        </button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-6 w-6 p-0'
                          onClick={() => moveCheckpoint(i, 'up')}
                          disabled={i === 0}
                        >
                          <ChevronUp className='h-3 w-3' />
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-6 w-6 p-0'
                          onClick={() => moveCheckpoint(i, 'down')}
                          disabled={i === routeCheckpoints.length - 1}
                        >
                          <ChevronDown className='h-3 w-3' />
                        </Button>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-6 w-6 p-0 text-destructive hover:text-destructive'
                          onClick={() => removeCheckpoint(rc.checkpointId)}
                        >
                          <X className='h-3 w-3' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selector de checkpoints disponibles */}
            {form.familyId && (
              <div className='space-y-2'>
                <Label className='text-sm font-medium'>Agregar checkpoints</Label>
                {availableCheckpoints.length === 0 ? (
                  <p className='text-xs text-muted-foreground'>
                    No hay checkpoints activos en esta área
                  </p>
                ) : (
                  <div className='max-h-36 overflow-y-auto space-y-1 border rounded-lg p-2'>
                    {availableCheckpoints
                      .filter(cp => !routeCheckpoints.some(rc => rc.checkpointId === cp.id))
                      .map(cp => (
                        <button
                          key={cp.id}
                          type='button'
                          onClick={() => addCheckpoint(cp)}
                          className='w-full text-left p-2 rounded hover:bg-muted/50 transition-colors text-xs flex items-center gap-2'
                        >
                          <Plus className='h-3 w-3 text-muted-foreground flex-shrink-0' />
                          <div className='min-w-0'>
                            <p className='font-medium truncate'>{cp.name}</p>
                            <p className='text-muted-foreground truncate'>{cp.location}</p>
                          </div>
                        </button>
                      ))}
                    {availableCheckpoints.filter(
                      cp => !routeCheckpoints.some(rc => rc.checkpointId === cp.id)
                    ).length === 0 && (
                      <p className='text-xs text-muted-foreground text-center py-2'>
                        Todos los checkpoints ya están en la ruta
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
              {editingId ? 'Guardar cambios' : 'Crear ruta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm deactivate */}
      <AlertDialog open={!!deactivatingId} onOpenChange={() => setDeactivatingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar ruta?</AlertDialogTitle>
            <AlertDialogDescription>
              Se cancelarán todas las patrullas PENDIENTES futuras de esta ruta y se notificará a
              los guardias asignados.
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

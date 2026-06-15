'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  ClipboardList,
  AlertTriangle,
  Pencil,
  PowerOff,
  Trash2,
  Loader2,
  ChevronUp,
  ChevronDown,
  X,
  GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
import { createRouteColumns } from '@/components/patrols/patrol-columns'
import { PATROL_ROUTES_EXPORT_COLUMNS, formatDurationMinutes } from '@/lib/utils/patrol-utils'

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

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  const [families, setFamilies] = useState<Family[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [routeCheckpoints, setRouteCheckpoints] = useState<RouteCheckpointEntry[]>([])
  const [availableCheckpoints, setAvailableCheckpoints] = useState<CheckpointOption[]>([])
  const [saving, setSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
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
    return `/api/patrols/routes?${params.toString()}`
  }, [debouncedSearch, includeInactive])

  // Fetch data
  const {
    data: routesRaw,
    loading,
    error,
    reload,
  } = useModuleData<PatrolRoute>({
    endpoint,
    initialLoad: true,
  })

  const routes = routesRaw || []

  // Pagination
  const pagination = usePagination(routes, { pageSize: 20 })

  // Export
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'rutas-patrullas',
    title: 'Rutas de Patrulla',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${routes.length} rutas`,
    getData: () => routes,
    columns: PATROL_ROUTES_EXPORT_COLUMNS,
  })

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false&module=patrols')
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

  const handlePermanentDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/patrols/routes/${id}?permanent=true`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar permanentemente')
      toast({ title: 'Ruta eliminada permanentemente' })
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

  const hasInactiveCheckpoints = routeCheckpoints.some(rc => !rc.isActive)

  if (status === 'loading' || !session) return null

  const columns = createRouteColumns({
    onEdit: openEdit,
    onDeactivate: id => setDeactivatingId(id),
    onPermanentDelete: id => setPermanentlyDeletingId(id),
    isSuperAdmin,
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: routes.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  return (
    <ModuleLayout
      title='Rutas de Patrulla'
      subtitle='Secuencias ordenadas de checkpoints para los recorridos'
      loading={loading && routes.length === 0}
      error={error}
      onRetry={reload}
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
          <Input
            placeholder='Buscar rutas...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            id='show-inactive-routes'
            checked={includeInactive}
            onCheckedChange={v => {
              setIncludeInactive(v)
              pagination.goToPage(1)
            }}
          />
          <Label htmlFor='show-inactive-routes' className='text-sm cursor-pointer'>
            Mostrar inactivas
          </Label>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        title='Rutas de Patrulla'
        description={`Gestión de rutas (${routes.length} rutas)`}
        data={routes}
        columns={columns}
        loading={loading}
        error={error}
        pagination={paginationConfig}
        onRefresh={reload}
        externalSearch={true}
        hideInternalFilters={true}
        onRowClick={openEdit}
        rowActions={(route: PatrolRoute) => (
          <div className='flex items-center gap-1 justify-end'>
            <Button size='sm' variant='ghost' onClick={() => openEdit(route)} title='Editar'>
              <Pencil className='h-3.5 w-3.5' />
            </Button>
            {route.isActive && (
              <Button
                size='sm'
                variant='ghost'
                className='text-destructive hover:text-destructive'
                onClick={() => setDeactivatingId(route.id)}
                title='Desactivar'
              >
                <PowerOff className='h-3.5 w-3.5' />
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                size='sm'
                variant='ghost'
                className='text-red-700 hover:text-red-800 dark:text-red-500'
                onClick={() => setPermanentlyDeletingId(route.id)}
                title='Eliminar permanentemente'
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        )}
        actions={
          routes.length > 0 ? (
            <ExportButton
              onExportCSV={exportCSV}
              onExportExcel={exportExcel}
              onExportPDF={exportPDF}
              loading={exporting}
            />
          ) : undefined
        }
        emptyState={{
          icon: <ClipboardList className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
          title: 'No hay rutas',
          description: 'Crea la primera ruta con el botón de arriba',
        }}
      />

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
                <Select
                  value={form.familyId}
                  onValueChange={v => setForm(f => ({ ...f, familyId: v }))}
                  disabled={saving || !!editingId}
                >
                  <SelectTrigger className='h-9'>
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

              {/* Duración */}
              <div className='space-y-1.5'>
                <Label className='text-sm'>
                  Duración estimada <span className='text-destructive'>*</span>
                </Label>
                <div className='flex items-center gap-2'>
                  <Input
                    type='number'
                    min={1}
                    max={1440}
                    value={form.estimatedDurationMinutes}
                    onChange={e =>
                      setForm(f => ({ ...f, estimatedDurationMinutes: e.target.value }))
                    }
                    disabled={saving}
                    className='h-9'
                    placeholder='60'
                  />
                  <span className='text-sm text-muted-foreground whitespace-nowrap'>min</span>
                </div>
                {(() => {
                  const mins = parseInt(form.estimatedDurationMinutes)
                  if (!mins || mins <= 0) return null
                  const totalLabel = formatDurationMinutes(mins)
                  const cpCount = routeCheckpoints.length
                  const perCp = cpCount > 0 ? Math.round(mins / cpCount) : null
                  return (
                    <div className='space-y-0.5'>
                      <p className='text-xs text-muted-foreground'>≈ {totalLabel} total</p>
                      {perCp !== null && (
                        <p className='text-xs text-muted-foreground'>
                          ≈ <span className='font-medium text-foreground'>{perCp} min</span> por
                          checkpoint
                          <span className='text-muted-foreground'> ({cpCount} checkpoints)</span>
                        </p>
                      )}
                    </div>
                  )
                })()}
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

      {/* Confirm permanent delete */}
      <AlertDialog
        open={!!permanentlyDeletingId}
        onOpenChange={() => setPermanentlyDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar ruta PERMANENTEMENTE?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La ruta se eliminará completamente de la base de
              datos.
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

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, CalendarClock, Pencil, PowerOff, Power, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { DataTable } from '@/components/ui/data-table'
import { ExportButton } from '@/components/common/export-button'
import { useModuleData } from '@/hooks/common/use-module-data'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import { createScheduleColumns } from '@/components/patrols/patrol-columns'
import { PATROL_SCHEDULES_EXPORT_COLUMNS } from '@/lib/utils/patrol-utils'
import {
  PatrolSchedule,
  Family,
  PatrolRoute,
  Agent,
  FormData,
  EMPTY_FORM,
} from '@/components/patrols/types'
import { formatDateTimeLocal } from '@/components/patrols/utils'
import { ScheduleFormDialog } from '@/components/patrols/schedule-form-dialog'

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
  const [initialForm, setInitialForm] = useState<FormData | undefined>()
  const [saving, setSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [permanentlyDeletingId, setPermanentlyDeletingId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    params.append('limit', '100')
    if (debouncedSearch) params.append('search', debouncedSearch)
    if (includeInactive) params.append('includeInactive', 'true')
    return `/api/patrols/schedules?${params.toString()}`
  }, [debouncedSearch, includeInactive])

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

  const pagination = usePagination(schedules, { pageSize: 20 })

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'programaciones-rondas',
    title: 'Programaciones de Rondas',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${schedules.length} programaciones`,
    getData: () => schedules,
    columns: PATROL_SCHEDULES_EXPORT_COLUMNS,
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
      if (familyId) params.append('patrolFamilyId', familyId)
      const res = await fetch(`/api/users?${params.toString()}`)
      const data = await res.json()
      // Solo TECHNICIAN y CLIENT pueden ser asignados como agentes de ronda
      // ADMIN (normal y super) solo supervisa, no ejecuta patrullas
      if (data.data) {
        setAgents(data.data.filter((u: any) => u.role !== 'ADMIN'))
      }
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

  // handleFamilyChange: notifica al padre para cargar rutas y agentes del área seleccionada
  const handleFamilyChange = useCallback(
    (familyId: string) => {
      if (familyId) {
        fetchRoutesForFamily(familyId)
        fetchAgents(familyId)
      } else {
        fetchRoutesForFamily('')
        fetchAgents()
      }
    },
    [fetchRoutesForFamily, fetchAgents]
  )

  const openCreate = () => {
    setEditingId(null)
    setInitialForm({ ...EMPTY_FORM, familyId: families[0]?.id ?? '' })
    setDialogOpen(true)
  }

  const openEdit = (schedule: PatrolSchedule) => {
    setEditingId(schedule.id)

    const endDate = new Date(schedule.scheduledEnd)
    const endTimeOnly = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`

    setInitialForm({
      familyId: schedule.familyId,
      routeId: schedule.routeId,
      agentId: schedule.agentId,
      scheduledStart: formatDateTimeLocal(schedule.scheduledStart),
      scheduledEnd: formatDateTimeLocal(schedule.scheduledEnd),
      endTimeOnly,
      recurrence: schedule.recurrence as any,
      recurrenceDays: schedule.recurrenceDays,
    })

    fetchRoutesForFamily(schedule.familyId)
    fetchAgents(schedule.familyId)
    setDialogOpen(true)
  }

  const handleSave = async (form: FormData, currentEditingId: string | null) => {
    const isRecurring = form.recurrence !== 'NONE'

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

      const url = currentEditingId
        ? `/api/patrols/schedules/${currentEditingId}`
        : '/api/patrols/schedules'

      const res = await fetch(url, {
        method: currentEditingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')

      toast({
        title: currentEditingId ? 'Programación actualizada' : 'Programación creada',
        description: currentEditingId
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

      <ScheduleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        initialForm={initialForm}
        families={families}
        routes={routes}
        agents={agents}
        saving={saving}
        onSave={handleSave}
        onFamilyChange={handleFamilyChange}
      />

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

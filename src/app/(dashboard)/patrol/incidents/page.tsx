'use client'

/**
 * Página "Mis Novedades" del agente.
 * Lista las novedades reportadas por el usuario durante sus rondas.
 * Incluye:
 * - Filtros por severidad, estado y rango de fechas
 * - Tabla con columnas ordenables
 * - Exportación multi-formato (CSV, Excel, PDF)
 * - Edición/eliminación dentro de la ventana de gracia
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileWarning } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { useExport } from '@/hooks/common/use-export'
import { PATROL_INCIDENTS_AGENT_EXPORT_COLUMNS } from '@/lib/utils/patrol-utils'
import { IncidentCard } from '@/components/patrols/incidents/incident-card'
import { IncidentFormDialog } from '@/components/patrols/incidents/incident-form-dialog'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ── Constantes ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
  ESCALATED: 'Escalada',
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface Incident {
  id: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
  createdAt: string
  checkpoint: { name: string; location: string }
  patrol: { route: { name: string }; scheduledStart: string; familyId?: string }
  photos: { id: string; path: string }[]
  ticket?: { id: string; ticketCode: string; status: string } | null
  isEditable?: boolean
}

interface PaginationData {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext?: boolean
}

// ── Filtros iniciales ─────────────────────────────────────────────────────────

const INITIAL_FILTERS = {
  severity: '',
  status: '',
  dateFrom: '',
  dateTo: '',
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MisNovedadesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  // Datos
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pagination, setPagination] = useState<PaginationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros y paginación
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [page, setPage] = useState(1)

  // Diálogo de edición
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Confirmación de eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Guard de autenticación
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    const role = (session.user as any).role
    if (role !== 'ADMIN' && (session.user as any).patrolsEnabled !== true) {
      router.push('/unauthorized')
    }
  }, [session, status, router])

  // ── Cargar novedades ────────────────────────────────────────────────────────
  const fetchIncidents = useCallback(
    async (currentFilters: typeof INITIAL_FILTERS, currentPage: number) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(PAGE_SIZE),
        })

        if (currentFilters.severity) params.set('severity', currentFilters.severity)
        if (currentFilters.status) params.set('status', currentFilters.status)
        if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom)
        if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo)

        const res = await fetch(`/api/patrols/incidents?${params}`)
        if (!res.ok) throw new Error('Error al cargar novedades')
        const data = await res.json()
        setIncidents(data.data ?? [])
        setPagination(data.pagination ?? null)
      } catch (err) {
        setIncidents([])
        setPagination(null)
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las novedades')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  // Carga inicial y al cambiar filtros/página
  useEffect(() => {
    if (status !== 'authenticated') return
    fetchIncidents(filters, page)
  }, [status, filters, page, fetchIncidents])

  // ── Handlers de filtros ─────────────────────────────────────────────────────
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS)
    setPage(1)
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  // ── Handlers de edición/eliminación ─────────────────────────────────────────
  const handleEdit = (id: string) => {
    const incident = incidents.find(i => i.id === id)
    if (incident) {
      setEditingIncident(incident)
      setEditDialogOpen(true)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/patrols/incidents/${deletingId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al eliminar la novedad')
      }
      toast({ title: 'Novedad eliminada', description: 'La novedad fue eliminada correctamente' })
      setDeletingId(null)
      fetchIncidents(filters, page)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ── Exportación multi-formato ───────────────────────────────────────────────
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'mis-novedades',
    title: 'Mis Novedades',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${pagination?.total ?? incidents.length} novedades`,
    getData: () => incidents,
    columns: PATROL_INCIDENTS_AGENT_EXPORT_COLUMNS,
  })

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Mis Novedades'
      subtitle='Novedades reportadas durante tus rondas'
      loading={loading && incidents.length === 0 && !error}
      error={error}
      onRetry={() => fetchIncidents(filters, page)}
    >
      <ListTableToolbar
        title={
          <p className='text-sm text-muted-foreground'>
            {pagination?.total ?? incidents.length} novedad
            {(pagination?.total ?? incidents.length) !== 1 ? 'es' : ''}
          </p>
        }
        loading={loading}
        onRefresh={() => fetchIncidents(filters, page)}
        showViewToggle={false}
        export={{
          onExportCSV: exportCSV,
          onExportExcel: exportExcel,
          onExportPDF: exportPDF,
          loading: exporting,
          disabled: incidents.length === 0,
        }}
        className='mb-4'
      />

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4'>
        <div className='space-y-1'>
          <Label className='text-xs'>Severidad</Label>
          <Select
            value={filters.severity || 'all'}
            onValueChange={v => handleFilterChange('severity', v === 'all' ? '' : v)}
          >
            <SelectTrigger className='h-9'>
              <SelectValue placeholder='Todas' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas</SelectItem>
              <SelectItem value='LOW'>Baja</SelectItem>
              <SelectItem value='MEDIUM'>Media</SelectItem>
              <SelectItem value='HIGH'>Alta</SelectItem>
              <SelectItem value='CRITICAL'>Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1'>
          <Label className='text-xs'>Estado</Label>
          <Select
            value={filters.status || 'all'}
            onValueChange={v => handleFilterChange('status', v === 'all' ? '' : v)}
          >
            <SelectTrigger className='h-9'>
              <SelectValue placeholder='Todos' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              <SelectItem value='OPEN'>Abierta</SelectItem>
              <SelectItem value='RESOLVED'>Resuelta</SelectItem>
              <SelectItem value='ESCALATED'>Escalada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1'>
          <Label className='text-xs'>Desde</Label>
          <DateInput
            className='h-9'
            value={filters.dateFrom}
            onChange={e => handleFilterChange('dateFrom', e.target.value)}
            clearable
          />
        </div>

        <div className='space-y-1'>
          <Label className='text-xs'>Hasta</Label>
          <DateInput
            className='h-9'
            value={filters.dateTo}
            onChange={e => handleFilterChange('dateTo', e.target.value)}
            clearable
          />
        </div>
      </div>

      {/* Botón limpiar filtros */}
      {hasActiveFilters && (
        <div className='mb-4'>
          <Button variant='ghost' size='sm' onClick={handleClearFilters}>
            Limpiar filtros
          </Button>
        </div>
      )}

      {/* ── Lista de novedades ─────────────────────────────────────────────── */}
      <div className='space-y-3'>
        {incidents.map(incident => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            onClick={id => router.push(`/patrol/incidents/${id}`)}
            onEdit={handleEdit}
            onDelete={id => setDeletingId(id)}
          />
        ))}
      </div>

      {/* Estado vacío */}
      {!loading && incidents.length === 0 && !error && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <FileWarning className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>
              {hasActiveFilters
                ? 'No se encontraron novedades con estos filtros'
                : 'No tienes novedades reportadas'}
            </p>
            <p className='text-xs text-muted-foreground mt-1'>
              {hasActiveFilters
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Las novedades que reportes durante tus rondas aparecerán aquí'}
            </p>
            {hasActiveFilters && (
              <Button variant='outline' size='sm' className='mt-4' onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Paginación ─────────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className='flex items-center justify-between mt-6'>
          <p className='text-xs text-muted-foreground'>
            {pagination.total} novedad{pagination.total !== 1 ? 'es' : ''} en total
          </p>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Anterior
            </Button>
            <span className='text-sm text-muted-foreground'>
              {page} / {pagination.totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* ── Diálogo de edición ─────────────────────────────────────────────── */}
      {editingIncident && (
        <IncidentFormDialog
          open={editDialogOpen}
          onOpenChange={open => {
            setEditDialogOpen(open)
            if (!open) setEditingIncident(null)
          }}
          mode='edit'
          incident={{
            id: editingIncident.id,
            description: editingIncident.description,
            severity: editingIncident.severity,
            photoIds: editingIncident.photos.map(p => p.id),
          }}
          onSuccess={() => {
            setEditDialogOpen(false)
            setEditingIncident(null)
            fetchIncidents(filters, page)
            toast({ title: 'Novedad actualizada' })
          }}
        />
      )}

      {/* ── Confirmación de eliminación ────────────────────────────────────── */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La novedad será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={handleDeleteConfirm}
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

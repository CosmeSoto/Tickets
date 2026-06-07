'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FileWarning, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
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

interface Incident {
  id: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
  createdAt: string
  checkpoint: { name: string; location: string }
  patrol: { route: { name: string }; scheduledStart: string }
  photos: { id: string; path: string }[]
  ticket?: { id: string; ticketCode: string; status: string } | null
  isEditable?: boolean
}

interface PaginationData {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
}

export default function MisNovedadesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [incidents, setIncidents] = useState<Incident[]>([])
  const [pagination, setPagination] = useState<PaginationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  // Edit dialog state
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Auth guard
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
    }
  }, [session, status, router])

  const fetchIncidents = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
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
  }, [])

  useEffect(() => {
    if (session) fetchIncidents(page)
  }, [session, page, fetchIncidents])

  // Edit handler
  const handleEdit = (id: string) => {
    const incident = incidents.find(i => i.id === id)
    if (incident) {
      setEditingIncident(incident)
      setEditDialogOpen(true)
    }
  }

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/patrols/incidents/${deletingId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al eliminar la novedad')
      }
      toast({ title: 'Novedad eliminada', description: 'La novedad fue eliminada correctamente', variant: 'success' })
      setDeletingId(null)
      fetchIncidents(page)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Mis Novedades'
      subtitle='Novedades reportadas durante tus rondas'
      loading={loading && incidents.length === 0 && !error}
      error={error}
      onRetry={() => fetchIncidents(page)}
    >
      {/* Incident list */}
      <div className='space-y-3'>
        {incidents.map(incident => (
          <IncidentCard
            key={incident.id}
            incident={incident}
            onEdit={handleEdit}
            onDelete={(id) => setDeletingId(id)}
          />
        ))}
      </div>

      {/* Empty state */}
      {!loading && incidents.length === 0 && !error && (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <FileWarning className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>No tienes novedades reportadas</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Las novedades que reportes durante tus rondas aparecerán aquí
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className='flex items-center justify-center gap-2 mt-6'>
          <Button
            variant='outline'
            size='sm'
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            Anterior
          </Button>
          <span className='text-sm text-muted-foreground'>
            Página {page} de {pagination.totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            disabled={!pagination.hasNext}
            onClick={() => setPage(p => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Edit dialog */}
      <IncidentFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode='edit'
        incident={editingIncident ? {
          id: editingIncident.id,
          description: editingIncident.description,
          severity: editingIncident.severity,
          photoIds: editingIncident.photos.map(p => p.id),
        } : undefined}
        onSuccess={() => fetchIncidents(page)}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La novedad será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

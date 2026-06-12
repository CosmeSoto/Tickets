'use client'

/**
 * Página de detalle de una novedad para el agente.
 * Muestra toda la información de la novedad y permite editar/eliminar
 * si está dentro de la ventana de gracia configurada para el área.
 */

import { use, useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  MapPin,
  AlertTriangle,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

// ── Constantes ────────────────────────────────────────────────────────────────

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}
const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800',
}
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
  ESCALATED: 'Escalada',
}
const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
  ESCALATED: 'bg-purple-100 text-purple-800',
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface IncidentDetail {
  id: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
  createdAt: string
  isEditable: boolean
  checkpoint: { id: string; name: string; location: string }
  patrol: { id: string; scheduledStart: string; route: { id: string; name: string } }
  agent: { id: string; name: string }
  photos: { id: string; path: string }[]
  ticket?: { id: string; ticketCode: string; status: string } | null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function IncidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [incident, setIncident] = useState<IncidentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Diálogos
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Guard de autenticación
  useEffect(() => {
    if (status === 'loading') return
    if (!session) router.push('/login')
  }, [session, status, router])

  // Cargar detalle de la novedad
  const fetchIncident = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/patrols/incidents/${id}`)
      if (!res.ok) {
        if (res.status === 404) throw new Error('Novedad no encontrada')
        throw new Error('Error al cargar la novedad')
      }
      const json = await res.json()
      setIncident(json.data ?? json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (status === 'authenticated') fetchIncident()
  }, [status, fetchIncident])

  // Eliminar novedad
  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/patrols/incidents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al eliminar')
      }
      toast({ title: 'Novedad eliminada' })
      router.push('/patrol/incidents')
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al eliminar',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    )
  }

  if (error || !incident) {
    return (
      <div className='max-w-lg mx-auto px-4 py-12 text-center'>
        <AlertTriangle className='h-12 w-12 text-muted-foreground/40 mx-auto mb-4' />
        <p className='text-sm font-medium text-muted-foreground'>
          {error ?? 'Novedad no encontrada'}
        </p>
        <Button
          variant='outline'
          size='sm'
          className='mt-4'
          onClick={() => router.push('/patrol/incidents')}
        >
          Volver a Mis Novedades
        </Button>
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true, locale: es })

  return (
    <div className='max-w-2xl mx-auto px-4 py-6 space-y-4'>
      {/* Navegación */}
      <button
        type='button'
        onClick={() => router.push('/patrol/incidents')}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Volver a Mis Novedades
      </button>

      {/* Cabecera */}
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h1 className='text-lg font-bold'>Detalle de Novedad</h1>
          <p className='text-xs text-muted-foreground mt-0.5'>
            Reportada {timeAgo} en {incident.checkpoint.name}
          </p>
        </div>
        {/* Acciones de edición/eliminación */}
        {incident.isEditable && (
          <div className='flex items-center gap-1'>
            <Button variant='outline' size='sm' onClick={() => setEditOpen(true)}>
              <Pencil className='h-3.5 w-3.5 mr-1' />
              Editar
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='text-destructive hover:text-destructive'
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className='h-3.5 w-3.5 mr-1' />
              Eliminar
            </Button>
          </div>
        )}
      </div>

      {/* Información principal */}
      <Card>
        <CardContent className='pt-6 space-y-4'>
          {/* Badges */}
          <div className='flex items-center gap-2 flex-wrap'>
            <Badge className={SEVERITY_COLORS[incident.severity]}>
              {SEVERITY_LABELS[incident.severity]}
            </Badge>
            <Badge className={STATUS_COLORS[incident.status]}>
              {STATUS_LABELS[incident.status]}
            </Badge>
            {incident.isEditable && (
              <Badge variant='outline' className='text-xs'>
                <Clock className='h-3 w-3 mr-1' />
                Editable
              </Badge>
            )}
          </div>

          {/* Descripción */}
          <div>
            <p className='text-sm font-medium text-muted-foreground mb-1'>Descripción</p>
            <p className='text-sm whitespace-pre-wrap'>{incident.description}</p>
          </div>

          {/* Contexto */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <div>
              <p className='text-xs text-muted-foreground'>Checkpoint</p>
              <p className='text-sm font-medium flex items-center gap-1'>
                <MapPin className='h-3.5 w-3.5 text-muted-foreground' />
                {incident.checkpoint.name}
              </p>
              {incident.checkpoint.location && (
                <p className='text-xs text-muted-foreground mt-0.5'>
                  {incident.checkpoint.location}
                </p>
              )}
            </div>
            <div>
              <p className='text-xs text-muted-foreground'>Ruta</p>
              <p className='text-sm font-medium'>{incident.patrol.route.name}</p>
              <p className='text-xs text-muted-foreground mt-0.5'>
                Programada:{' '}
                {new Date(incident.patrol.scheduledStart).toLocaleString('es-EC', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Fotos */}
          {incident.photos.length > 0 && (
            <div>
              <p className='text-xs text-muted-foreground mb-2'>Fotos adjuntas</p>
              <div className='flex gap-2 flex-wrap'>
                {incident.photos.map(photo => (
                  <img
                    key={photo.id}
                    src={`/uploads/${photo.path}`}
                    alt='Foto de novedad'
                    className='w-24 h-24 rounded-lg object-cover border'
                  />
                ))}
              </div>
            </div>
          )}

          {/* Link a ticket si fue escalada */}
          {incident.status === 'ESCALATED' && incident.ticket && (
            <div className='pt-3 border-t'>
              <a
                href={`/admin/tickets/${incident.ticket.id}`}
                className='inline-flex items-center gap-1.5 text-sm text-primary hover:underline'
              >
                <ExternalLink className='h-3.5 w-3.5' />
                Ver ticket #{incident.ticket.ticketCode} ({incident.ticket.status})
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de edición */}
      {incident.isEditable && (
        <IncidentFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          mode='edit'
          incident={{
            id: incident.id,
            description: incident.description,
            severity: incident.severity,
            photoIds: incident.photos.map(p => p.id),
          }}
          onSuccess={() => {
            setEditOpen(false)
            fetchIncident()
            toast({ title: 'Novedad actualizada' })
          }}
        />
      )}

      {/* Confirmación de eliminación */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
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
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

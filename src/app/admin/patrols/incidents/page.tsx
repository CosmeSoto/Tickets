'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, RefreshCw, ExternalLink, Clock, User, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ModuleLayout } from '@/components/common/layout/module-layout'

interface PatrolIncident {
  id: string
  title: string
  description: string
  status: string
  priority: string
  createdAt: string
  ticketCode: string | null
  family: { id: string; name: string; color: string | null } | null
  client: { id: string; name: string }
  assignee: { id: string; name: string } | null
  checkIn: {
    id: string
    patrol: { id: string; route: { name: string } } | null
    checkpoint: { id: string; name: string } | null
  } | null
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

export default function PatrolIncidentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [incidents, setIncidents] = useState<PatrolIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('open')

  const fetchIncidents = useCallback(async (sf: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ source: 'PATROL', limit: '50' })
      if (sf === 'open') params.set('status', 'OPEN')
      else if (sf === 'in_progress') params.set('status', 'IN_PROGRESS')
      else if (sf === 'resolved') params.set('status', 'RESOLVED')
      // 'all' = no status filter

      const res = await fetch(`/api/patrols/incidents?${params}`)
      if (res.ok) {
        const data = await res.json()
        setIncidents(data.data ?? [])
      }
    } catch {
      setIncidents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchIncidents(statusFilter)
  }, [session, status, router, fetchIncidents, statusFilter])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('es-EC', {
      timeZone: 'America/Guayaquil',
      dateStyle: 'short',
      timeStyle: 'short',
    })

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Incidencias de Rondas'
      subtitle='Novedades reportadas por los agentes durante sus patrullas'
      loading={loading && incidents.length === 0}
      headerActions={
        <Button
          variant='outline'
          size='sm'
          onClick={() => fetchIncidents(statusFilter)}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
          <span className='hidden sm:inline'>Actualizar</span>
        </Button>
      }
    >
      {/* Filtros */}
      <div className='flex gap-2 flex-wrap mb-4'>
        {[
          { value: 'open', label: 'Abiertas' },
          { value: 'in_progress', label: 'En progreso' },
          { value: 'resolved', label: 'Resueltas' },
          { value: 'all', label: 'Todas' },
        ].map(opt => (
          <Button
            key={opt.value}
            size='sm'
            variant={statusFilter === opt.value ? 'default' : 'outline'}
            onClick={() => setStatusFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* Lista de incidencias */}
      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : incidents.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <AlertTriangle className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>Sin incidencias</p>
            <p className='text-xs text-muted-foreground mt-1'>
              No hay incidencias reportadas en este estado
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {incidents.map(incident => (
            <Card
              key={incident.id}
              className='cursor-pointer hover:border-primary/50 transition-colors'
              onClick={() => router.push(`/admin/tickets/${incident.id}`)}
            >
              <CardContent className='p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      {incident.ticketCode && (
                        <span className='text-xs font-mono text-muted-foreground'>
                          {incident.ticketCode}
                        </span>
                      )}
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[incident.status] ?? ''}`}
                      >
                        {STATUS_LABELS[incident.status] ?? incident.status}
                      </Badge>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[incident.priority] ?? ''}`}
                      >
                        {PRIORITY_LABELS[incident.priority] ?? incident.priority}
                      </Badge>
                    </div>
                    <p className='font-medium text-sm truncate'>{incident.title}</p>
                    <p className='text-xs text-muted-foreground line-clamp-1 mt-0.5'>
                      {incident.description}
                    </p>

                    <div className='flex items-center gap-4 mt-2 text-xs text-muted-foreground'>
                      <span className='flex items-center gap-1'>
                        <User className='h-3 w-3' />
                        {incident.client.name}
                      </span>
                      <span className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        {formatDate(incident.createdAt)}
                      </span>
                      {incident.family && (
                        <span className='flex items-center gap-1'>
                          <MapPin className='h-3 w-3' />
                          {incident.family.name}
                        </span>
                      )}
                    </div>

                    {incident.checkIn?.patrol && (
                      <div className='mt-1.5 text-xs text-muted-foreground'>
                        <span className='font-medium'>Ruta:</span>{' '}
                        {incident.checkIn.patrol.route?.name ?? '—'}
                        {incident.checkIn.checkpoint && (
                          <>
                            {' • '}
                            <span className='font-medium'>Checkpoint:</span>{' '}
                            {incident.checkIn.checkpoint.name}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <ExternalLink className='h-4 w-4 text-muted-foreground flex-shrink-0 mt-1' />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ModuleLayout>
  )
}

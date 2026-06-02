'use client'

import {
  User,
  ClipboardList,
  AlertTriangle,
  Clock,
  MapPin,
  QrCode,
  Wifi,
  WifiOff,
  ShieldAlert,
  Calendar,
  BadgeCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Column } from '@/components/ui/data-table'
import {
  QR_TYPE_LABELS_ES,
  PATROL_RECURRENCE_LABELS_ES,
  formatDurationMinutes,
} from '@/lib/utils/patrol-utils'
import type { PatrolSchedule } from './types'

// ===== CHECKPOINTS =====

interface Checkpoint {
  id: string
  familyId: string
  name: string
  description: string | null
  location: string
  latitude: number | null
  longitude: number | null
  geofenceRadiusMeters: number | null
  hasConnectivity: boolean
  isSensitive: boolean
  isActive: boolean
  qrType: 'DYNAMIC' | 'STATIC'
  createdAt: string
  updatedAt: string
}

interface CheckpointColumnsProps {
  onEdit: (cp: Checkpoint) => void
  onDownloadQR: (cp: Checkpoint) => void
  onDeactivate: (id: string) => void
  onReactivate: (id: string) => void
  onPermanentDelete: (id: string) => void
  onOpenDisplay: (cp: Checkpoint) => void
  downloadingQrId: string | null
  isSuperAdmin: boolean
}

export function createCheckpointColumns({
  onEdit,
  onDownloadQR,
  onDeactivate,
  onReactivate,
  onPermanentDelete,
  onOpenDisplay,
  downloadingQrId,
  isSuperAdmin,
}: CheckpointColumnsProps): Column<Checkpoint>[] {
  return [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      render: (cp: Checkpoint) => (
        <div className='min-w-0'>
          <div className='font-medium text-foreground truncate max-w-[200px]'>{cp.name}</div>
          <div className='text-xs text-muted-foreground truncate max-w-[200px]'>{cp.location}</div>
        </div>
      ),
    },
    {
      key: 'family',
      label: 'Área',
      sortable: true,
      render: (cp: any) => (
        <span className='text-xs text-muted-foreground truncate max-w-[150px]'>
          {cp.family?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'qrType',
      label: 'Tipo QR',
      sortable: true,
      render: (cp: Checkpoint) => (
        <Badge variant='outline' className='text-xs'>
          <QrCode className='h-3 w-3 mr-1' />
          {QR_TYPE_LABELS_ES[cp.qrType] ?? cp.qrType}
        </Badge>
      ),
    },
    {
      key: 'hasConnectivity',
      label: 'Conectividad',
      sortable: true,
      render: (cp: Checkpoint) =>
        cp.hasConnectivity ? (
          <span className='flex items-center gap-1 text-xs text-green-700 dark:text-green-400'>
            <Wifi className='h-3 w-3' /> Sí
          </span>
        ) : (
          <span className='flex items-center gap-1 text-xs text-muted-foreground'>
            <WifiOff className='h-3 w-3' /> No
          </span>
        ),
    },
    {
      key: 'isSensitive',
      label: 'Sensible',
      sortable: true,
      render: (cp: Checkpoint) =>
        cp.isSensitive ? (
          <span className='flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400'>
            <ShieldAlert className='h-3 w-3' /> Sí
          </span>
        ) : (
          'No'
        ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      render: (cp: Checkpoint) => (
        <Badge variant={cp.isActive ? 'default' : 'secondary'} className='text-xs'>
          {cp.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      label: 'Creado',
      sortable: true,
      render: (cp: Checkpoint) => (
        <span className='text-xs text-muted-foreground'>
          {new Date(cp.createdAt).toLocaleDateString('es-EC', {
            dateStyle: 'short',
          })}
        </span>
      ),
    },
  ]
}

// ===== ROUTES =====

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

interface RouteColumnsProps {
  onEdit: (route: PatrolRoute) => void
  onDeactivate: (id: string) => void
  onPermanentDelete: (id: string) => void
  isSuperAdmin: boolean
}

export function createRouteColumns({
  onEdit,
  onDeactivate,
  onPermanentDelete,
  isSuperAdmin,
}: RouteColumnsProps): Column<PatrolRoute>[] {
  return [
    {
      key: 'name',
      label: 'Ruta',
      sortable: true,
      render: (route: any) => (
        <div>
          <p className='font-medium'>{route.name}</p>
          {route.routeCheckpoints.some(
            (rc: { checkpoint: { isActive: boolean } }) => !rc.checkpoint.isActive
          ) && (
            <div className='flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400 mt-0.5'>
              <AlertTriangle className='h-3 w-3' />
              Checkpoints inactivos
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'family',
      label: 'Área',
      sortable: true,
      render: (route: any) => (
        <span className='text-xs text-muted-foreground truncate max-w-[150px]'>
          {route.family?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'estimatedDurationMinutes',
      label: 'Duración Est.',
      sortable: true,
      render: (route: PatrolRoute) => (
        <span className='text-muted-foreground text-sm'>
          {formatDurationMinutes(route.estimatedDurationMinutes)}
        </span>
      ),
    },
    {
      key: '_count.routeCheckpoints',
      label: 'Checkpoints',
      sortable: true,
      render: (route: PatrolRoute) => (
        <span className='font-medium'>{route._count.routeCheckpoints}</span>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      render: (route: PatrolRoute) => (
        <Badge variant={route.isActive ? 'default' : 'secondary'} className='text-xs'>
          {route.isActive ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
  ]
}

// ===== SCHEDULES =====

interface ScheduleColumnsProps {
  onEdit: (schedule: PatrolSchedule) => void
  onDeactivate: (id: string) => void
  onReactivate: (id: string) => void
  onPermanentDelete: (id: string) => void
  isSuperAdmin: boolean
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function createScheduleColumns({
  onEdit,
  onDeactivate,
  onReactivate,
  onPermanentDelete,
  isSuperAdmin,
}: ScheduleColumnsProps): Column<PatrolSchedule>[] {
  return [
    {
      key: 'route',
      label: 'Ruta',
      sortable: true,
      render: (schedule: any) => (
        <span className='font-medium'>{schedule?.route?.name ?? '—'}</span>
      ),
    },
    {
      key: 'family',
      label: 'Área',
      sortable: true,
      render: (schedule: any) => (
        <span className='text-xs text-muted-foreground truncate max-w-[150px]'>
          {schedule?.family?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'agent',
      label: 'Personal',
      sortable: true,
      render: (schedule: any) => {
        if (!schedule) return <span className='text-muted-foreground text-xs'>—</span>
        return (
          <div className='flex items-center gap-2'>
            <User className='h-4 w-4 text-muted-foreground shrink-0' />
            <div className='min-w-0'>
              <div className='font-medium text-sm truncate'>{schedule.agent?.name ?? '—'}</div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'scheduledStart',
      label: 'Horario',
      sortable: true,
      render: (schedule: PatrolSchedule) => {
        if (!schedule) return <span className='text-muted-foreground text-xs'>—</span>
        const start = new Date(schedule.scheduledStart)
        const end = new Date(schedule.scheduledEnd)
        const diffMs = end.getTime() - start.getTime()
        const diffMins = Math.round(diffMs / 60000)
        // Para recurrencias, mostrar solo la hora; para NONE mostrar fecha+hora
        const isRecurring = schedule.recurrence !== 'NONE'
        const startLabel = isRecurring
          ? start.toLocaleTimeString('es-EC', { timeStyle: 'short' })
          : start.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
        const endLabel = end.toLocaleTimeString('es-EC', { timeStyle: 'short' })
        return (
          <div className='text-xs'>
            <span className='text-foreground font-medium'>{startLabel}</span>
            <span className='text-muted-foreground'> → {endLabel}</span>
            <span className='ml-1 text-muted-foreground'>({formatDurationMinutes(diffMins)})</span>
          </div>
        )
      },
    },
    {
      key: 'recurrence',
      label: 'Recurrencia',
      sortable: true,
      render: (schedule: PatrolSchedule) => (
        <Badge variant='outline' className='text-xs'>
          {PATROL_RECURRENCE_LABELS_ES[schedule.recurrence] ?? schedule.recurrence}
        </Badge>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      render: (schedule: PatrolSchedule) => (
        <Badge variant={schedule.isActive ? 'default' : 'secondary'} className='text-xs'>
          {schedule.isActive ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
  ]
}

// ===== REPORTES =====

interface AgentRow {
  agentId: string
  agentName: string
  assigned: number
  completed: number
  missed: number
  incomplete: number
  avgCompletion: number
}

interface RouteRow {
  routeId: string
  routeName: string
  executions: number
  completionRate: number
  avgDurationMinutes: number
  mostMissedCheckpoints: Array<{ checkpointId: string; name: string; missCount: number }>
}

export function createAgentColumns(): Column<AgentRow>[] {
  return [
    {
      key: 'agentName',
      label: 'Personal',
      sortable: true,
      render: (row: AgentRow) => (
        <div className='flex items-center gap-2'>
          <User className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>{row.agentName}</span>
        </div>
      ),
    },
    {
      key: 'assigned',
      label: 'Asignadas',
      sortable: true,
      render: (row: AgentRow) => <span className='font-medium'>{row.assigned}</span>,
    },
    {
      key: 'completed',
      label: 'Completadas',
      sortable: true,
      render: (row: AgentRow) => (
        <span className='font-medium text-green-600 dark:text-green-400'>{row.completed}</span>
      ),
    },
    {
      key: 'missed',
      label: 'Omitidas',
      sortable: true,
      render: (row: AgentRow) => (
        <span className='font-medium text-red-600 dark:text-red-400'>{row.missed}</span>
      ),
    },
    {
      key: 'incomplete',
      label: 'Incompletas',
      sortable: true,
      render: (row: AgentRow) => (
        <span className='font-medium text-orange-600 dark:text-orange-400'>{row.incomplete}</span>
      ),
    },
    {
      key: 'avgCompletion',
      label: 'Completitud Promedio',
      sortable: true,
      width: '200px',
      render: (row: AgentRow) => (
        <div className='flex items-center gap-2'>
          <Progress value={row.avgCompletion} className='h-1.5 flex-1' />
          <span className='text-xs font-medium w-10 text-right'>{row.avgCompletion}%</span>
        </div>
      ),
    },
  ]
}

export function createReportRouteColumns(): Column<RouteRow>[] {
  return [
    {
      key: 'routeName',
      label: 'Ruta',
      sortable: true,
      render: (row: RouteRow) => (
        <div className='flex items-center gap-2'>
          <ClipboardList className='h-4 w-4 text-muted-foreground' />
          <span className='font-medium'>{row.routeName}</span>
        </div>
      ),
    },
    {
      key: 'executions',
      label: 'Ejecuciones',
      sortable: true,
      render: (row: RouteRow) => <span className='font-medium'>{row.executions}</span>,
    },
    {
      key: 'completionRate',
      label: 'Tasa de Completitud',
      sortable: true,
      width: '200px',
      render: (row: RouteRow) => (
        <div className='flex items-center gap-2'>
          <Progress value={row.completionRate} className='h-1.5 flex-1' />
          <span className='text-xs font-medium w-10 text-right'>{row.completionRate}%</span>
        </div>
      ),
    },
    {
      key: 'avgDurationMinutes',
      label: 'Duración Prom. (min)',
      sortable: true,
      render: (row: RouteRow) => (
        <span className='text-muted-foreground'>{row.avgDurationMinutes} min</span>
      ),
    },
    {
      key: 'mostMissedCheckpoints',
      label: 'Checkpoint Más Omitido',
      sortable: true,
      render: (row: RouteRow) =>
        row.mostMissedCheckpoints.length > 0 ? (
          <div className='flex items-center gap-1.5'>
            <AlertTriangle className='h-3 w-3 text-orange-500 flex-shrink-0' />
            <span className='truncate max-w-[160px]'>{row.mostMissedCheckpoints[0].name}</span>
            <Badge variant='outline' className='text-xs flex-shrink-0'>
              {row.mostMissedCheckpoints[0].missCount}x
            </Badge>
          </div>
        ) : (
          <span className='text-muted-foreground text-xs'>—</span>
        ),
    },
  ]
}

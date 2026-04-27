'use client'

/**
 * TicketsStatsSection — Sección de métricas del módulo de Tickets.
 * Diseño consistente con InventoryStatsSection:
 *   - Header con título, badge de estado y enlace "Ver tickets →"
 *   - Cards de métricas principales
 *   - Sub-sección de planes de resolución (si existen)
 */

import {
  Ticket, CheckCircle, AlertCircle, Users, Clock,
  Activity, FileText, Calendar, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface TicketsStats {
  // Admin
  totalUsers?: number
  totalTickets?: number
  openTickets?: number
  inProgressTickets?: number
  urgentTickets?: number
  activeTickets?: number
  todayTickets?: number
  resolutionRate?: number
  resolutionPlans?: {
    total: number
    avgEstimatedHours: number
    avgActualHours: number
    efficiency: number
    taskCompletionRate: number
  }
  // Técnico
  assignedTickets?: number
  completedToday?: number
  avgResolutionTime?: string
  satisfactionScore?: number
  workload?: string
  performance?: string
  myResolutionPlans?: {
    total: number
    avgEstimatedHours: number
    avgActualHours: number
    efficiency: number
    taskCompletionRate: number
  }
  // Cliente
  thisMonthTickets?: number
  resolvedTickets?: number
  satisfactionRating?: number
  ticketsToRate?: number
}

interface TicketsStatsSectionProps {
  stats: TicketsStats
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  isLoading?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TICKET_LINKS: Record<string, string> = {
  ADMIN: '/admin/tickets',
  TECHNICIAN: '/technician/tickets',
  CLIENT: '/client/tickets',
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TicketsStatsSection({ stats, role, isLoading }: TicketsStatsSectionProps) {
  if (isLoading) {
    return (
      <div className='mb-8'>
        <div className='flex items-center justify-between mb-4'>
          <Skeleton className='h-5 w-40' />
          <Skeleton className='h-8 w-28' />
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
          {[...Array(4)].map((_, i) => <Skeleton key={i} className='h-28 rounded-xl' />)}
        </div>
      </div>
    )
  }

  const ticketsLink = TICKET_LINKS[role]

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  if (role === 'ADMIN') {
    const resolutionRate = stats.resolutionRate ?? 0
    const hasUrgent = (stats.urgentTickets ?? 0) > 0
    const healthStatus = resolutionRate >= 85 ? 'success' : resolutionRate >= 70 ? 'warning' : 'error'

    return (
      <div className='mb-8'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <Ticket className='h-5 w-5 text-muted-foreground' />
            <h3 className='text-sm font-semibold text-foreground'>Módulo de Tickets</h3>
            {hasUrgent && (
              <Badge variant='destructive' className='text-xs h-5 px-1.5'>
                {stats.urgentTickets} urgentes
              </Badge>
            )}
          </div>
          <Button variant='ghost' size='sm' asChild>
            <Link href={ticketsLink} className='gap-1 text-xs'>
              Ver tickets <ArrowRight className='h-3 w-3' />
            </Link>
          </Button>
        </div>

        {/* Cards principales */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
          <SymmetricStatsCard
            title='Total Usuarios'
            value={stats.totalUsers ?? 0}
            icon={Users}
            color='blue'
            badge={{ text: `${stats.todayTickets ?? 0} nuevos hoy`, variant: 'secondary' }}
          />
          <SymmetricStatsCard
            title='Total Tickets'
            value={stats.totalTickets ?? 0}
            icon={Ticket}
            color='green'
            badge={{ text: `${stats.activeTickets ?? 0} activos`, variant: 'default' }}
          />
          <SymmetricStatsCard
            title='Tickets Abiertos'
            value={stats.openTickets ?? 0}
            icon={AlertCircle}
            color='orange'
            status={(stats.openTickets ?? 0) > 20 ? 'warning' : 'normal'}
            badge={{
              text: `${stats.urgentTickets ?? 0} urgentes`,
              variant: hasUrgent ? 'destructive' : 'default',
            }}
          />
          <SymmetricStatsCard
            title='Tasa de Resolución'
            value={`${resolutionRate}%`}
            icon={CheckCircle}
            color='purple'
            status={healthStatus}
          />
        </div>

        {/* Planes de resolución — sub-sección colapsable */}
        {stats.resolutionPlans && stats.resolutionPlans.total > 0 && (
          <>
            <div className='flex items-center gap-2 mb-3 mt-2'>
              <div className='h-px flex-1 bg-border' />
              <span className='text-xs text-muted-foreground px-2'>Planes de resolución</span>
              <div className='h-px flex-1 bg-border' />
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              <SymmetricStatsCard
                title='Planes Creados'
                value={stats.resolutionPlans.total}
                icon={FileText}
                color='blue'
                badge={{ text: 'Total', variant: 'secondary' }}
              />
              <SymmetricStatsCard
                title='Tiempo Estimado'
                value={`${stats.resolutionPlans.avgEstimatedHours}h`}
                icon={Calendar}
                color='green'
                badge={{ text: 'Planificado', variant: 'default' }}
              />
              <SymmetricStatsCard
                title='Tiempo Real'
                value={`${stats.resolutionPlans.avgActualHours}h`}
                icon={Clock}
                color='orange'
                badge={{ text: 'Ejecutado', variant: 'default' }}
              />
              <SymmetricStatsCard
                title='Eficiencia'
                value={`${stats.resolutionPlans.efficiency}%`}
                icon={Activity}
                color='purple'
                status={stats.resolutionPlans.efficiency >= 90 ? 'success' : stats.resolutionPlans.efficiency >= 70 ? 'normal' : 'warning'}
                badge={{ text: `${stats.resolutionPlans.taskCompletionRate}% tareas`, variant: 'default' }}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  // ── TECHNICIAN ─────────────────────────────────────────────────────────────
  if (role === 'TECHNICIAN') {
    const workloadLevel = stats.workload ?? 'low'
    const workloadBadge = {
      high: { text: 'Carga Alta', variant: 'destructive' as const },
      medium: { text: 'Carga Media', variant: 'outline' as const },
      low: { text: 'Carga Baja', variant: 'secondary' as const },
    }[workloadLevel] ?? { text: 'Carga Baja', variant: 'secondary' as const }

    return (
      <div className='mb-8'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <Ticket className='h-5 w-5 text-muted-foreground' />
            <h3 className='text-sm font-semibold text-foreground'>Módulo de Tickets</h3>
            <Badge variant={workloadBadge.variant} className='text-xs h-5 px-1.5'>
              {workloadBadge.text}
            </Badge>
          </div>
          <Button variant='ghost' size='sm' asChild>
            <Link href={ticketsLink} className='gap-1 text-xs'>
              Ver tickets <ArrowRight className='h-3 w-3' />
            </Link>
          </Button>
        </div>

        {/* Cards principales */}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
          <SymmetricStatsCard
            title='Tickets Asignados'
            value={stats.assignedTickets ?? 0}
            icon={Ticket}
            color='blue'
            role='TECHNICIAN'
            status={workloadLevel === 'high' ? 'warning' : 'normal'}
            badge={workloadBadge}
          />
          <SymmetricStatsCard
            title='Completados Hoy'
            value={stats.completedToday ?? 0}
            icon={CheckCircle}
            color='green'
            role='TECHNICIAN'
            status='success'
          />
          <SymmetricStatsCard
            title='Tiempo Promedio'
            value={stats.avgResolutionTime ?? '0h'}
            icon={Clock}
            color='purple'
            role='TECHNICIAN'
          />
          <SymmetricStatsCard
            title='Satisfacción'
            value={`${stats.satisfactionScore ?? 0}/5`}
            icon={Activity}
            color='orange'
            role='TECHNICIAN'
            status={(stats.satisfactionScore ?? 0) >= 4.5 ? 'success' : (stats.satisfactionScore ?? 0) >= 4 ? 'normal' : 'warning'}
            badge={{ text: `${Math.floor((stats.satisfactionScore ?? 0) * 20)}%`, variant: 'default' }}
          />
        </div>

        {/* Mis planes de resolución */}
        {stats.myResolutionPlans && stats.myResolutionPlans.total > 0 && (
          <>
            <div className='flex items-center gap-2 mb-3 mt-2'>
              <div className='h-px flex-1 bg-border' />
              <span className='text-xs text-muted-foreground px-2'>Mis planes de resolución</span>
              <div className='h-px flex-1 bg-border' />
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
              <SymmetricStatsCard title='Planes Creados' value={stats.myResolutionPlans.total} icon={FileText} color='blue' role='TECHNICIAN' badge={{ text: 'Total', variant: 'secondary' }} />
              <SymmetricStatsCard title='Tiempo Estimado' value={`${stats.myResolutionPlans.avgEstimatedHours}h`} icon={Calendar} color='green' role='TECHNICIAN' badge={{ text: 'Promedio', variant: 'default' }} />
              <SymmetricStatsCard title='Tiempo Real' value={`${stats.myResolutionPlans.avgActualHours}h`} icon={Clock} color='orange' role='TECHNICIAN' badge={{ text: 'Promedio', variant: 'default' }} />
              <SymmetricStatsCard
                title='Mi Eficiencia'
                value={`${stats.myResolutionPlans.efficiency}%`}
                icon={Activity}
                color='purple'
                role='TECHNICIAN'
                status={stats.myResolutionPlans.efficiency >= 90 ? 'success' : stats.myResolutionPlans.efficiency >= 70 ? 'normal' : 'warning'}
                badge={{ text: `${stats.myResolutionPlans.taskCompletionRate}% tareas`, variant: 'default' }}
              />
            </div>
          </>
        )}
      </div>
    )
  }

  // ── CLIENT ─────────────────────────────────────────────────────────────────
  const hasOpenTickets = (stats.openTickets ?? 0) > 0
  const hasToRate = (stats.ticketsToRate ?? 0) > 0

  return (
    <div className='mb-8'>
      {/* Header */}
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
          <Ticket className='h-5 w-5 text-muted-foreground' />
          <h3 className='text-sm font-semibold text-foreground'>Mis Tickets</h3>
          {hasToRate && (
            <Badge variant='outline' className='text-xs h-5 px-1.5 border-amber-400 text-amber-700'>
              {stats.ticketsToRate} por calificar
            </Badge>
          )}
        </div>
        <Button variant='ghost' size='sm' asChild>
          <Link href={ticketsLink} className='gap-1 text-xs'>
            Ver tickets <ArrowRight className='h-3 w-3' />
          </Link>
        </Button>
      </div>

      {/* Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
        <SymmetricStatsCard
          title='Total Tickets'
          value={stats.totalTickets ?? 0}
          icon={Ticket}
          color='blue'
          role='CLIENT'
          trend={{ value: stats.thisMonthTickets ?? 0, label: 'este mes', isPositive: true }}
        />
        <SymmetricStatsCard
          title='Abiertos'
          value={stats.openTickets ?? 0}
          icon={AlertCircle}
          color='orange'
          role='CLIENT'
          status={hasOpenTickets ? 'warning' : 'normal'}
          badge={hasOpenTickets ? { text: 'Requieren atención', variant: 'outline' } : undefined}
        />
        <SymmetricStatsCard
          title='Resueltos'
          value={stats.resolvedTickets ?? 0}
          icon={CheckCircle}
          color='green'
          role='CLIENT'
          status='success'
        />
        <SymmetricStatsCard
          title='Mi Satisfacción'
          value={`${stats.satisfactionRating ?? 0}/5`}
          icon={Activity}
          color='purple'
          role='CLIENT'
          status={(stats.satisfactionRating ?? 0) >= 4.5 ? 'success' : (stats.satisfactionRating ?? 0) >= 4 ? 'normal' : 'warning'}
          badge={{ text: `${Math.floor((stats.satisfactionRating ?? 0) * 20)}%`, variant: 'default' }}
        />
      </div>
    </div>
  )
}

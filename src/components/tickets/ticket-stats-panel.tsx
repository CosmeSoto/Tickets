'use client'

import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp,
  Users,
  Calendar,
  Timer
} from 'lucide-react'

interface TicketStatsPanelProps {
  stats: {
    total: number
    open: number
    inProgress: number
    resolved: number
    closed: number
    highPriority: number
    avgResolutionTime?: string
    todayCreated?: number
    unassigned?: number
  }
  loading?: boolean
}

export function TicketStatsPanel({ stats, loading }: TicketStatsPanelProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(8)].map((_, i) => (
          <SymmetricStatsCard
            key={i}
            title="Cargando..."
            value="--"
            icon={Ticket}
            color="gray"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SymmetricStatsCard
        title="Total de Tickets"
        value={stats.total}
        icon={Ticket}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Tickets Abiertos"
        value={stats.open}
        icon={AlertCircle}
        color="orange"
        status={stats.open > 10 ? "warning" : "normal"}
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.open / stats.total) * 100)}%` : "0%",
          variant: "secondary"
        }}
      />

      <SymmetricStatsCard
        title="En Progreso"
        value={stats.inProgress}
        icon={Clock}
        color="purple"
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.inProgress / stats.total) * 100)}%` : "0%",
          variant: "default"
        }}
      />

      <SymmetricStatsCard
        title="Resueltos"
        value={stats.resolved}
        icon={CheckCircle2}
        color="green"
        status="success"
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.resolved / stats.total) * 100)}%` : "0%",
          variant: "default"
        }}
      />

      <SymmetricStatsCard
        title="Alta Prioridad"
        value={stats.highPriority}
        icon={TrendingUp}
        color="red"
        status={stats.highPriority > 5 ? "error" : "normal"}
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.highPriority / stats.total) * 100)}%` : "0%",
          variant: stats.highPriority > 5 ? "destructive" : "secondary"
        }}
      />

      <SymmetricStatsCard
        title="Sin Asignar"
        value={stats.unassigned || 0}
        icon={Users}
        color="gray"
        status={(stats.unassigned || 0) > 3 ? "warning" : "normal"}
        badge={{
          text: stats.total > 0 ? `${Math.round(((stats.unassigned || 0) / stats.total) * 100)}%` : "0%",
          variant: "outline"
        }}
      />

      <SymmetricStatsCard
        title="Creados Hoy"
        value={stats.todayCreated || 0}
        icon={Calendar}
        color="blue"
        trend={{
          value: (stats.todayCreated || 0) > 5 ? 15 : -5,
          label: "vs ayer",
          isPositive: (stats.todayCreated || 0) > 5
        }}
      />

      <SymmetricStatsCard
        title="Tiempo Promedio"
        value={stats.avgResolutionTime || 'N/A'}
        icon={Timer}
        color="purple"
        status="normal"
      />
    </div>
  )
}

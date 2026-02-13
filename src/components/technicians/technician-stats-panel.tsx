'use client'

import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Ticket, 
  Tag, 
  Building,
  TrendingUp,
  Calendar
} from 'lucide-react'

interface TechnicianStats {
  total: number
  active: number
  inactive: number
  totalTickets: number
  totalAssignments: number
  departments: number
  avgTicketsPerTechnician: number
  avgAssignmentsPerTechnician: number
}

interface TechnicianStatsPanelProps {
  stats: TechnicianStats
  loading?: boolean
}

export function TechnicianStatsPanel({ stats, loading }: TechnicianStatsPanelProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(8)].map((_, i) => (
          <SymmetricStatsCard
            key={i}
            title="Cargando..."
            value="--"
            icon={Users}
            color="gray"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SymmetricStatsCard
        title="Total Técnicos"
        value={stats.total}
        icon={Users}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Técnicos Activos"
        value={stats.active}
        icon={UserCheck}
        color="green"
        status="success"
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : "0%",
          variant: "default"
        }}
      />

      <SymmetricStatsCard
        title="Técnicos Inactivos"
        value={stats.inactive}
        icon={UserX}
        color="red"
        status={stats.inactive > 3 ? "warning" : "normal"}
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.inactive / stats.total) * 100)}%` : "0%",
          variant: "secondary"
        }}
      />

      <SymmetricStatsCard
        title="Tickets Asignados"
        value={stats.totalTickets}
        icon={Ticket}
        color="orange"
        trend={{
          value: stats.totalTickets > 50 ? 8 : -2,
          label: "vs mes anterior",
          isPositive: stats.totalTickets > 50
        }}
      />

      <SymmetricStatsCard
        title="Especialidades"
        value={stats.totalAssignments}
        icon={Tag}
        color="purple"
        badge={{
          text: `${stats.totalAssignments} asignadas`,
          variant: "outline"
        }}
      />

      <SymmetricStatsCard
        title="Departamentos"
        value={stats.departments}
        icon={Building}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Promedio Tickets"
        value={stats.avgTicketsPerTechnician.toFixed(1)}
        icon={TrendingUp}
        color="green"
        status={stats.avgTicketsPerTechnician > 10 ? "warning" : "normal"}
      />

      <SymmetricStatsCard
        title="Promedio Especialidades"
        value={stats.avgAssignmentsPerTechnician.toFixed(1)}
        icon={Calendar}
        color="purple"
        status="normal"
      />
    </div>
  )
}
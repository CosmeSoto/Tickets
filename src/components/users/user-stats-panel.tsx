'use client'

import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Shield,
  Wrench,
  UserCircle,
  TrendingUp,
  Calendar
} from 'lucide-react'
import { UserStats } from '@/hooks/use-users'

interface UserStatsPanelProps {
  stats: UserStats
  loading?: boolean
}

export function UserStatsPanel({ stats, loading }: UserStatsPanelProps) {
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

  const activityRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SymmetricStatsCard
        title="Total de Usuarios"
        value={stats.total}
        icon={Users}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Usuarios Activos"
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
        title="Usuarios Inactivos"
        value={stats.inactive}
        icon={UserX}
        color="red"
        status={stats.inactive > 5 ? "warning" : "normal"}
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.inactive / stats.total) * 100)}%` : "0%",
          variant: "secondary"
        }}
      />

      <SymmetricStatsCard
        title="Tasa de Actividad"
        value={`${activityRate}%`}
        icon={TrendingUp}
        color="purple"
        status={activityRate >= 80 ? "success" : activityRate >= 60 ? "normal" : "warning"}
        trend={{
          value: activityRate >= 80 ? 5 : -3,
          label: "vs mes anterior",
          isPositive: activityRate >= 80
        }}
      />

      <SymmetricStatsCard
        title="Administradores"
        value={stats.admins}
        icon={Shield}
        color="purple"
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.admins / stats.total) * 100)}%` : "0%",
          variant: "outline"
        }}
      />

      <SymmetricStatsCard
        title="Técnicos"
        value={stats.technicians}
        icon={Wrench}
        color="blue"
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.technicians / stats.total) * 100)}%` : "0%",
          variant: "default"
        }}
      />

      <SymmetricStatsCard
        title="Clientes"
        value={stats.clients}
        icon={UserCircle}
        color="green"
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.clients / stats.total) * 100)}%` : "0%",
          variant: "default"
        }}
      />

      <SymmetricStatsCard
        title="Nuevos Hoy"
        value={0} // TODO: Implementar cálculo de usuarios creados hoy
        icon={Calendar}
        color="orange"
        trend={{
          value: 0,
          label: "vs ayer",
          isPositive: false
        }}
      />
    </div>
  )
}
'use client'

import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { 
  Building, 
  CheckCircle, 
  XCircle, 
  Users, 
  FolderTree,
  TrendingUp,
  Calendar,
  Target
} from 'lucide-react'

interface DepartmentStatsProps {
  stats: {
    total: number
    active: number
    inactive: number
    totalUsers: number
    totalCategories: number
  }
  loading?: boolean
}

export function DepartmentStats({ stats, loading }: DepartmentStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(8)].map((_, i) => (
          <SymmetricStatsCard
            key={i}
            title="Cargando..."
            value="--"
            icon={Building}
            color="gray"
          />
        ))}
      </div>
    )
  }

  const activePercentage = stats.total > 0 ? (stats.active / stats.total) * 100 : 0
  const avgUsersPerDept = stats.active > 0 ? (stats.totalUsers / stats.active) : 0
  const avgCategoriesPerDept = stats.active > 0 ? (stats.totalCategories / stats.active) : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SymmetricStatsCard
        title="Total Departamentos"
        value={stats.total}
        icon={Building}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Departamentos Activos"
        value={stats.active}
        icon={CheckCircle}
        color="green"
        status="success"
        badge={{
          text: `${activePercentage.toFixed(1)}%`,
          variant: "default"
        }}
      />

      <SymmetricStatsCard
        title="Departamentos Inactivos"
        value={stats.inactive}
        icon={XCircle}
        color="red"
        status={stats.inactive > 2 ? "warning" : "normal"}
        badge={{
          text: stats.total > 0 ? `${Math.round((stats.inactive / stats.total) * 100)}%` : "0%",
          variant: "secondary"
        }}
      />

      <SymmetricStatsCard
        title="Total Técnicos"
        value={stats.totalUsers}
        icon={Users}
        color="purple"
        trend={{
          value: stats.totalUsers > 10 ? 12 : -5,
          label: "vs mes anterior",
          isPositive: stats.totalUsers > 10
        }}
      />

      <SymmetricStatsCard
        title="Total Categorías"
        value={stats.totalCategories}
        icon={FolderTree}
        color="orange"
        status="normal"
      />

      <SymmetricStatsCard
        title="Promedio Técnicos"
        value={avgUsersPerDept.toFixed(1)}
        icon={TrendingUp}
        color="green"
        status={avgUsersPerDept > 5 ? "success" : "normal"}
      />

      <SymmetricStatsCard
        title="Promedio Categorías"
        value={avgCategoriesPerDept.toFixed(1)}
        icon={Target}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Tasa de Actividad"
        value={`${activePercentage.toFixed(1)}%`}
        icon={Calendar}
        color="purple"
        status={activePercentage >= 80 ? "success" : activePercentage >= 60 ? "normal" : "warning"}
      />
    </div>
  )
}
'use client'

import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { 
  FolderTree, 
  Folder, 
  Tag, 
  CheckCircle,
  AlertCircle,
  Users,
  Building,
  TrendingUp
} from 'lucide-react'

interface CategoryStats {
  total: number
  active: number
  inactive: number
  filtered?: number
  withTechnicians?: number
  byLevel: {
    level1: number
    level2: number
    level3: number
    level4: number
  }
}

interface CategoryStatsPanelProps {
  stats: CategoryStats
  loading?: boolean
}

export function CategoryStatsPanel({ stats, loading }: CategoryStatsPanelProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(8)].map((_, i) => (
          <SymmetricStatsCard
            key={i}
            title="Cargando..."
            value="--"
            icon={FolderTree}
            color="gray"
          />
        ))}
      </div>
    )
  }

  const activePercentage = stats.total > 0 ? (stats.active / stats.total) * 100 : 0
  const inactivePercentage = stats.total > 0 ? (stats.inactive / stats.total) * 100 : 0
  const technicianCoverage = stats.total > 0 ? ((stats.withTechnicians || 0) / stats.total) * 100 : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <SymmetricStatsCard
        title="Total Categorías"
        value={stats.total}
        icon={FolderTree}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Categorías Activas"
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
        title="Categorías Inactivas"
        value={stats.inactive}
        icon={AlertCircle}
        color="red"
        status={stats.inactive > 5 ? "warning" : "normal"}
        badge={{
          text: `${inactivePercentage.toFixed(1)}%`,
          variant: "secondary"
        }}
      />

      <SymmetricStatsCard
        title="Con Técnicos Asignados"
        value={stats.withTechnicians || 0}
        icon={Users}
        color="purple"
        status={technicianCoverage >= 80 ? "success" : technicianCoverage >= 50 ? "normal" : "warning"}
        badge={{
          text: `${technicianCoverage.toFixed(1)}%`,
          variant: "outline"
        }}
      />

      <SymmetricStatsCard
        title="Nivel 1 (Raíz)"
        value={stats.byLevel.level1}
        icon={Building}
        color="blue"
        status="normal"
      />

      <SymmetricStatsCard
        title="Nivel 2 (Departamentos)"
        value={stats.byLevel.level2}
        icon={Folder}
        color="green"
        status="normal"
      />

      <SymmetricStatsCard
        title="Nivel 3 (Servicios)"
        value={stats.byLevel.level3}
        icon={Tag}
        color="orange"
        status="normal"
      />

      <SymmetricStatsCard
        title="Nivel 4 (Especialidades)"
        value={stats.byLevel.level4}
        icon={Tag}
        color="purple"
        trend={{
          value: stats.byLevel.level4 > 10 ? 8 : -3,
          label: "especialización",
          isPositive: stats.byLevel.level4 > 10
        }}
      />
    </div>
  )
}
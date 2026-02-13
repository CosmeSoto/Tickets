'use client'

import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  FolderTree,
  TrendingUp,
  Activity
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ReportKPIMetricsProps {
  stats: {
    totalTickets: number
    resolvedTickets: number
    inProgressTickets: number
    openTickets: number
    closedTickets: number
    avgResolutionTime: string
    totalTechnicians: number
    activeTechnicians: number
    avgTechnicianResolutionRate: string
    totalCategories: number
    activeCategories: number
    avgCategoryResolutionRate: string
    hasActiveFilters: boolean
    filterCount: number
  }
  loading?: boolean
}

export function ReportKPIMetrics({ stats, loading = false }: ReportKPIMetricsProps) {
  
  // Calcular porcentajes y tendencias
  const resolutionRate = stats.totalTickets > 0 
    ? ((stats.resolvedTickets / stats.totalTickets) * 100)
    : 0
  
  const inProgressRate = stats.totalTickets > 0 
    ? ((stats.inProgressTickets / stats.totalTickets) * 100)
    : 0

  const openRate = stats.totalTickets > 0 
    ? ((stats.openTickets / stats.totalTickets) * 100)
    : 0

  const finalizationRate = stats.totalTickets > 0 
    ? (((stats.resolvedTickets + stats.closedTickets) / stats.totalTickets) * 100)
    : 0

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Filtros activos placeholder */}
        <div className="h-12 bg-gray-200 rounded-lg animate-pulse"></div>
        
        {/* Métricas principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <SymmetricStatsCard
              key={i}
              title="Cargando..."
              value="--"
              icon={BarChart3}
              color="gray"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros activos */}
      {stats.hasActiveFilters && (
        <div className="flex items-center justify-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 text-blue-700">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">
              Mostrando datos filtrados ({stats.filterCount} filtro{stats.filterCount !== 1 ? 's' : ''} activo{stats.filterCount !== 1 ? 's' : ''})
            </span>
          </div>
        </div>
      )}

      {/* Métricas principales de tickets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SymmetricStatsCard
          title="Total de Tickets"
          value={stats.totalTickets}
          icon={BarChart3}
          color="blue"
          status="normal"
        />

        <SymmetricStatsCard
          title="Tickets Resueltos"
          value={stats.resolvedTickets}
          icon={CheckCircle}
          color="green"
          status={resolutionRate >= 80 ? "success" : resolutionRate >= 60 ? "normal" : "warning"}
          badge={{
            text: `${resolutionRate.toFixed(1)}%`,
            variant: "default"
          }}
          trend={{
            value: resolutionRate >= 80 ? 8 : -3,
            label: "eficiencia",
            isPositive: resolutionRate >= 80
          }}
        />

        <SymmetricStatsCard
          title="En Progreso"
          value={stats.inProgressTickets}
          icon={AlertCircle}
          color="orange"
          status={stats.inProgressTickets > 20 ? "warning" : "normal"}
          badge={{
            text: `${inProgressRate.toFixed(1)}%`,
            variant: "secondary"
          }}
        />

        <SymmetricStatsCard
          title="Tiempo Promedio"
          value={stats.avgResolutionTime}
          icon={Clock}
          color="purple"
          status="normal"
        />

        <SymmetricStatsCard
          title="Técnicos Activos"
          value={stats.activeTechnicians}
          icon={Users}
          color="blue"
          badge={{
            text: `de ${stats.totalTechnicians}`,
            variant: "outline"
          }}
        />

        <SymmetricStatsCard
          title="Eficiencia Técnicos"
          value={`${stats.avgTechnicianResolutionRate}%`}
          icon={Users}
          color="green"
          status={parseFloat(stats.avgTechnicianResolutionRate) >= 85 ? "success" : 
                 parseFloat(stats.avgTechnicianResolutionRate) >= 70 ? "normal" : "warning"}
          trend={{
            value: parseFloat(stats.avgTechnicianResolutionRate) >= 85 ? 5 : -2,
            label: "promedio",
            isPositive: parseFloat(stats.avgTechnicianResolutionRate) >= 85
          }}
        />

        <SymmetricStatsCard
          title="Categorías Activas"
          value={stats.activeCategories}
          icon={FolderTree}
          color="purple"
          badge={{
            text: `de ${stats.totalCategories}`,
            variant: "outline"
          }}
        />

        <SymmetricStatsCard
          title="Eficiencia Categorías"
          value={`${stats.avgCategoryResolutionRate}%`}
          icon={Activity}
          color="orange"
          status={parseFloat(stats.avgCategoryResolutionRate) >= 80 ? "success" : 
                 parseFloat(stats.avgCategoryResolutionRate) >= 65 ? "normal" : "warning"}
          trend={{
            value: parseFloat(stats.avgCategoryResolutionRate) >= 80 ? 6 : -4,
            label: "promedio",
            isPositive: parseFloat(stats.avgCategoryResolutionRate) >= 80
          }}
        />
      </div>

      {/* Resumen de estado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SymmetricStatsCard
          title="Tickets Abiertos"
          value={stats.openTickets}
          icon={AlertCircle}
          color="blue"
          status={stats.openTickets > 30 ? "warning" : "normal"}
          badge={{
            text: `${openRate.toFixed(1)}%`,
            variant: "secondary"
          }}
        />

        <SymmetricStatsCard
          title="Tickets Cerrados"
          value={stats.closedTickets}
          icon={CheckCircle}
          color="gray"
          status="normal"
        />

        <SymmetricStatsCard
          title="Tasa de Finalización"
          value={`${finalizationRate.toFixed(1)}%`}
          icon={TrendingUp}
          color="green"
          status={finalizationRate >= 85 ? "success" : finalizationRate >= 70 ? "normal" : "warning"}
          trend={{
            value: finalizationRate >= 85 ? 10 : -5,
            label: "resueltos + cerrados",
            isPositive: finalizationRate >= 85
          }}
        />
      </div>
    </div>
  )
}
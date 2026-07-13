/**
 * Audit Stats Cards Component
 * Displays audit statistics in card format
 */

import { FileText, Users, AlertTriangle, Activity } from 'lucide-react'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import type { AuditStats } from './utils/audit-types'

interface AuditStatsCardsProps {
  stats: AuditStats | null
  criticalActionsCount: number
  hasActiveFilters?: boolean
  filteredTotal?: number
}

export function AuditStatsCards({
  stats,
  criticalActionsCount,
  hasActiveFilters,
  filteredTotal,
}: AuditStatsCardsProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
      <SymmetricStatsCard
        title={hasActiveFilters ? 'Eventos (filtro activo)' : 'Total de Eventos'}
        value={hasActiveFilters ? (filteredTotal ?? stats?.totalLogs ?? 0) : stats?.totalLogs || 0}
        icon={FileText}
        color='blue'
      />

      <SymmetricStatsCard
        title='Usuarios Activos'
        value={stats?.topUsers?.length || 0}
        icon={Users}
        color='green'
      />

      <SymmetricStatsCard
        title='Acciones Críticas'
        value={criticalActionsCount}
        icon={AlertTriangle}
        color='orange'
        status={criticalActionsCount > 10 ? 'warning' : 'normal'}
      />

      <SymmetricStatsCard
        title='Módulos Activos'
        value={stats?.actionStats?.length || 0}
        icon={Activity}
        color='purple'
      />
    </div>
  )
}

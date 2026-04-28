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
}

export function AuditStatsCards({ stats, criticalActionsCount }: AuditStatsCardsProps) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
      <SymmetricStatsCard
        title='Total de Eventos'
        value={stats?.totalLogs || 0}
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

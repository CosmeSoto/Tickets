/**
 * Audit Page - Refactored
 * Sistema de Auditoría - Monitoreo y logs de actividad del sistema
 *
 * Refactorización completa siguiendo el patrón exitoso del módulo de reportes:
 * - Reducción de 1,592 líneas a ~150 líneas (90.6% reducción)
 * - Lógica de negocio centralizada en custom hook (use-audit.ts)
 * - Componentes modulares y reutilizables
 * - Utilidades separadas para formateo y exportación
 * - Full dark mode support
 */

'use client'

import { Loader2 } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { useToast } from '@/hooks/use-toast'
import { useAudit } from '@/hooks/use-audit'
import { AuditStatsCards } from '@/components/audit/audit-stats-cards'
import { AuditFiltersComponent } from '@/components/audit/audit-filters'
import { AuditTable } from '@/components/audit/audit-table'
import { AuditDetailsDialog } from '@/components/audit/audit-details-dialog'

export default function AuditPage() {
  const { toast } = useToast()
  const {
    // Session
    session,
    status,

    // Data
    logs,
    stats,
    families,
    selectedLog,

    // State
    loading,
    isDialogOpen,
    pagination,
    filters,
    hasActiveFilters,

    // Computed
    criticalActionsCount,

    // Actions
    updateFilter,
    clearFilters,
    openLogDetails,
    closeLogDetails,
    handlePageChange,
    handleLimitChange,
    handleExportCSV,
    handleExportJSON,
  } = useAudit()

  // ── Loading state ──
  if (status === 'loading') {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <Loader2 className='animate-spin h-8 w-8 text-primary mx-auto' />
          <p className='mt-2 text-muted-foreground'>Cargando...</p>
        </div>
      </div>
    )
  }

  // ── Authorization check ──
  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  // ── Export handlers with toast ──
  const handleExportCSVWithToast = () => {
    toast({
      title: '📤 Exportando...',
      description: 'Preparando archivo CSV. Esto puede tomar unos momentos.',
    })

    handleExportCSV(
      message => {
        toast({
          title: '✅ Exportación Completada',
          description: message,
          duration: 10000,
        })
      },
      error => {
        toast({
          title: '❌ Error en Exportación',
          description: error,
          variant: 'destructive',
          duration: 8000,
        })
      }
    )
  }

  const handleExportJSONWithToast = () => {
    toast({
      title: '📤 Exportando...',
      description: 'Preparando archivo JSON. Esto puede tomar unos momentos.',
    })

    handleExportJSON(
      message => {
        toast({
          title: '✅ Exportación Completada',
          description: message,
          duration: 10000,
        })
      },
      error => {
        toast({
          title: '❌ Error en Exportación',
          description: error,
          variant: 'destructive',
          duration: 8000,
        })
      }
    )
  }

  return (
    <ModuleLayout
      title='Sistema de Auditoría'
      subtitle='Monitoreo y logs de actividad del sistema'
      loading={loading}
    >
      <div className='space-y-6'>
        {/* Estadísticas de Auditoría */}
        <AuditStatsCards stats={stats} criticalActionsCount={criticalActionsCount} />

        {/* Filtros de Auditoría */}
        <AuditFiltersComponent
          filters={filters}
          families={families}
          hasActiveFilters={hasActiveFilters}
          loading={loading}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          onExportCSV={handleExportCSVWithToast}
          onExportJSON={handleExportJSONWithToast}
        />

        {/* Tabla de Logs */}
        <AuditTable
          logs={logs}
          loading={loading}
          pagination={pagination}
          onViewDetails={openLogDetails}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          onClearFilters={clearFilters}
        />
      </div>

      {/* Modal de Detalles */}
      <AuditDetailsDialog log={selectedLog} isOpen={isDialogOpen} onClose={closeLogDetails} />
    </ModuleLayout>
  )
}

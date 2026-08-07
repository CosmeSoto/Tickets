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

import { Suspense } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { useAudit } from '@/hooks/use-audit'
import { useExport } from '@/hooks/common/use-export'
import { useToast } from '@/hooks/use-toast'
import { AuditStatsCards } from '@/components/audit/audit-stats-cards'
import { AuditFiltersComponent } from '@/components/audit/audit-filters'
import { AuditTable } from '@/components/audit/audit-table'
import { AuditDetailsDialog } from '@/components/audit/audit-details-dialog'
import { AUDIT_EXPORT_COLUMNS } from '@/components/audit/utils/audit-export-columns'

export default function AuditPage() {
  return (
    <Suspense
      fallback={
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
        </div>
      }
    >
      <AuditPageContent />
    </Suspense>
  )
}

function AuditPageContent() {
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
    activePresetId,
    criticalActionsCount,

    // Actions
    updateFilter,
    clearFilters,
    applyPreset,
    openLogDetails,
    closeLogDetails,
    handlePageChange,
    handleLimitChange,
    handleExportCSV,
    handleExportJSON,
  } = useAudit()

  const { toast } = useToast()

  // PDF desde la página visible; CSV/JSON vía API con todos los filtros
  const { exportPDF, exporting } = useExport({
    filename: 'auditoria',
    title: 'Registro de Auditoría',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${logs.length} registros`,
    columns: AUDIT_EXPORT_COLUMNS,
    getData: () => logs,
  })

  const onExportCSV = () =>
    handleExportCSV(
      msg => toast({ title: 'Exportación completada', description: msg }),
      err => toast({ title: 'Error al exportar', description: err, variant: 'destructive' })
    )

  const onExportJSON = () =>
    handleExportJSON(
      msg => toast({ title: 'Exportación completada', description: msg }),
      err => toast({ title: 'Error al exportar', description: err, variant: 'destructive' })
    )

  // ── Loading state (sesión) ──
  if (status === 'loading') {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
      </div>
    )
  }

  // ── Authorization check ──
  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  // ── Export handlers ──
  // Usamos directamente exportCSV, exportExcel, exportPDF del hook useExport

  return (
    <ModuleLayout
      title='Sistema de Auditoría'
      subtitle='Monitoreo y logs de actividad del sistema'
      loading={loading}
    >
      <div className='space-y-6'>
        {/* Estadísticas de Auditoría */}
        <AuditStatsCards
          stats={stats}
          criticalActionsCount={criticalActionsCount}
          hasActiveFilters={hasActiveFilters}
          filteredTotal={pagination.total}
        />

        {/* Filtros de Auditoría */}
        <AuditFiltersComponent
          filters={filters}
          families={families.map(f => ({ ...f, color: f.color ?? null }))}
          hasActiveFilters={hasActiveFilters}
          activePresetId={activePresetId}
          loading={loading}
          onFilterChange={updateFilter}
          onApplyPreset={applyPreset}
          onClearFilters={clearFilters}
          onExportCSV={onExportCSV}
          onExportJSON={onExportJSON}
          onExportPDF={exportPDF}
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

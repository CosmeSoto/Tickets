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

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { useAudit } from '@/hooks/use-audit'
import { useExport } from '@/hooks/common/use-export'
import { AuditStatsCards } from '@/components/audit/audit-stats-cards'
import { AuditFiltersComponent } from '@/components/audit/audit-filters'
import { AuditTable } from '@/components/audit/audit-table'
import { AuditDetailsDialog } from '@/components/audit/audit-details-dialog'
import { AUDIT_EXPORT_COLUMNS } from '@/components/audit/utils/audit-export-columns'

export default function AuditPage() {
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
  } = useAudit()

  // Exportación estándar (CSV, Excel, PDF) usando los datos filtrados de la tabla
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'auditoria',
    title: 'Registro de Auditoría',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${logs.length} registros`,
    columns: AUDIT_EXPORT_COLUMNS,
    getData: () => logs,
  })

  // ── Loading state (sesión) ──
  if (status === 'loading') {
    return (
      <ModuleLayout
        title='Sistema de Auditoría'
        subtitle='Monitoreo y logs de actividad del sistema'
        loading
      >
        {null}
      </ModuleLayout>
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
        <AuditStatsCards stats={stats} criticalActionsCount={criticalActionsCount} />

        {/* Filtros de Auditoría */}
        <AuditFiltersComponent
          filters={filters}
          families={families.map(f => ({ ...f, color: f.color ?? null }))}
          hasActiveFilters={hasActiveFilters}
          loading={loading}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          onExportCSV={exportCSV}
          onExportJSON={exportExcel}
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

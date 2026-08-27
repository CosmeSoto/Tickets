/**
 * Audit Page - Refactored
 * Sistema de Auditoría - Monitoreo y logs de actividad del sistema
 */

'use client'

import { Suspense } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { useAudit } from '@/hooks/use-audit'
import { useToast } from '@/hooks/use-toast'
import { AuditStatsCards } from '@/components/audit/audit-stats-cards'
import { AuditFiltersComponent } from '@/components/audit/audit-filters'
import { AuditTable } from '@/components/audit/audit-table'
import { AuditDetailsDialog } from '@/components/audit/audit-details-dialog'

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
    session,
    status,
    isSuperAdmin,
    logs,
    stats,
    families,
    selectedLog,
    loading,
    exporting,
    isDialogOpen,
    pagination,
    filters,
    hasActiveFilters,
    activePresetId,
    criticalActionsCount,
    columnOrder,
    visibleColumns,
    includeSensitive,
    selectedIds,
    deleting,
    setColumnOrder,
    setVisibleColumns,
    setIncludeSensitive,
    setSelectedIds,
    updateFilter,
    clearFilters,
    applyPreset,
    openLogDetails,
    closeLogDetails,
    handlePageChange,
    handleLimitChange,
    handleExportCSV,
    handleExportExcel,
    handleExportJSON,
    handleExportJSONInternal,
    handleExportPDFFull,
    deleteSelected,
    deleteFiltered,
  } = useAudit()

  const { toast } = useToast()

  const toastOk = (msg: string) => toast({ title: 'Exportación completada', description: msg })
  const toastErr = (err: string) =>
    toast({ title: 'Error al exportar', description: err, variant: 'destructive' })
  const toastInternalOk = (msg: string) =>
    toast({
      title: 'Exportación interna',
      description: msg,
      variant: 'destructive',
    })
  const toastDeleteOk = (msg: string) => toast({ title: 'Registros eliminados', description: msg })
  const toastDeleteErr = (err: string) =>
    toast({ title: 'Error al eliminar', description: err, variant: 'destructive' })

  if (status === 'loading') {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <ModuleLayout
      title='Sistema de Auditoría'
      subtitle='Monitoreo y logs de actividad del sistema · exportación alineada a LOPDP'
      loading={loading}
    >
      <div className='space-y-6'>
        <AuditStatsCards
          stats={stats}
          criticalActionsCount={criticalActionsCount}
          hasActiveFilters={hasActiveFilters}
          filteredTotal={pagination.total}
        />

        <AuditFiltersComponent
          filters={filters}
          families={families.map(f => ({ ...f, color: f.color ?? null }))}
          hasActiveFilters={hasActiveFilters}
          activePresetId={activePresetId}
          loading={loading}
          exporting={exporting}
          columnOrder={columnOrder}
          visibleColumns={visibleColumns}
          includeSensitive={includeSensitive}
          onColumnOrderChange={setColumnOrder}
          onVisibleColumnsChange={setVisibleColumns}
          onIncludeSensitiveChange={setIncludeSensitive}
          onFilterChange={updateFilter}
          onApplyPreset={applyPreset}
          onClearFilters={clearFilters}
          onExportCSV={() => handleExportCSV(toastOk, toastErr)}
          onExportExcel={() => handleExportExcel(toastOk, toastErr)}
          onExportJSON={() => handleExportJSON(toastOk, toastErr)}
          onExportJSONInternal={() => handleExportJSONInternal(toastInternalOk, toastErr)}
          onExportPDF={() => handleExportPDFFull(toastOk, toastErr)}
          isSuperAdmin={isSuperAdmin}
          selectedCount={selectedIds.length}
          filteredTotal={pagination.total}
          deleting={deleting}
          onDeleteSelected={() => deleteSelected(toastDeleteOk, toastDeleteErr)}
          onDeleteFiltered={() => deleteFiltered(toastDeleteOk, toastDeleteErr)}
        />

        <AuditTable
          logs={logs}
          loading={loading}
          pagination={pagination}
          onViewDetails={openLogDetails}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          onClearFilters={clearFilters}
          selectable={isSuperAdmin}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />
      </div>

      <AuditDetailsDialog log={selectedLog} isOpen={isDialogOpen} onClose={closeLogDetails} />
    </ModuleLayout>
  )
}

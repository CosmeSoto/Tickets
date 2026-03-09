'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Hooks y lógica de negocio
import { useTechnicianData } from '@/hooks/technicians/use-technician-data'
import { useTechnicianStats } from '@/components/admin/technicians/TechnicianManagement.module'

// Componentes de layout y UI
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'

// Componentes específicos del módulo
import { TechnicianStatsPanel } from '@/components/technicians/technician-stats-panel'
import { TechnicianFilters } from '@/components/technicians/technician-filters'
import { TechnicianAssignmentsModal } from '@/components/ui/technician-assignments-modal'
import { DemoteTechnicianDialog } from '@/components/technicians/demote-technician-dialog'

// Diálogos modularizados
import {
  TechnicianFormDialog,
  DeleteConfirmationDialog,
  DemoteConfirmationDialog,
  UserSelectionDialog
} from '@/components/admin/technicians/dialogs'

// Columnas y tarjetas
import { 
  createTechnicianColumns, 
  TechnicianCard 
} from '@/components/admin/technicians/tables/technician-columns'

export default function TechniciansPage() {
  // Estado para el diálogo de selección de usuario
  const [showUserSelection, setShowUserSelection] = useState(false)

  // Hook consolidado con toda la lógica
  const {
    // Datos
    technicians,
    departments,
    availableCategories,
    filteredTechnicians,
    loading,
    error,
    reload,

    // Filtros
    filters,
    setFilter,
    clearFilters,

    // Vista y paginación
    viewMode,
    setViewMode,
    pagination,

    // Estados de diálogos
    isDialogOpen,
    setIsDialogOpen,
    editingTechnician,
    deletingTechnician,
    setDeletingTechnician,
    demotingTechnician,
    setDemotingTechnician,
    promotingUser,
    demoteValidation,
    setDemoteValidation,
    assignmentsModal,
    setAssignmentsModal,

    // Handlers
    handleEdit,
    handlePromoteUser,
    handleViewAssignments,
    handleOpenDemoteDialog,
    handleDelete,
    handleDemote,
    handleCloseDialog
  } = useTechnicianData()

  // Estadísticas calculadas
  const stats = useTechnicianStats(technicians, departments)

  // Configuración de columnas con callbacks
  const columns = createTechnicianColumns({
    onEdit: handleEdit,
    onDelete: setDeletingTechnician,
    onDemote: handleOpenDemoteDialog,
    onViewAssignments: handleViewAssignments
  })

  // Configuración de paginación para DataTable
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredTechnicians.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  return (
    <ModuleLayout
      title="Gestión de Técnicos"
      subtitle="Administración de técnicos y sus asignaciones"
      loading={loading}
      error={error}
      onRetry={reload}
      headerActions={
        <Button onClick={() => setShowUserSelection(true)}>
          <Plus className='h-4 w-4 mr-2' />
          Promover Usuario a Técnico
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Panel de estadísticas */}
        <TechnicianStatsPanel stats={stats} loading={loading} />

        {/* Filtros */}
        <TechnicianFilters
          mode="technicians"
          searchTerm={filters.search}
          setSearchTerm={(term) => setFilter('search', term)}
          departmentFilter={filters.department}
          setDepartmentFilter={(dept) => setFilter('department', dept)}
          statusFilter={filters.status}
          setStatusFilter={(status) => setFilter('status', status)}
          loading={loading}
          onRefresh={reload}
          onClearFilters={clearFilters}
          departments={departments}
        />

        {/* DataTable con Toggle de Vistas */}
        <DataTable
          title="Técnicos"
          description={`Gestión de técnicos del sistema (${filteredTechnicians.length} técnicos) - Clic para ver asignaciones`}
          data={pagination.currentItems}
          columns={columns}
          loading={loading}
          pagination={paginationConfig}
          onRefresh={reload}
          onRowClick={handleViewAssignments}
          viewMode={viewMode as 'table' | 'cards'}
          onViewModeChange={setViewMode as (mode: 'table' | 'cards') => void}
          externalSearch={true}
          hideInternalFilters={true}
          cardRenderer={(technician) => (
            <TechnicianCard
              technician={technician}
              onEdit={handleEdit}
              onDelete={setDeletingTechnician}
              onDemote={handleOpenDemoteDialog}
              onViewAssignments={handleViewAssignments}
            />
          )}
          emptyState={{
            title: filters.search || filters.department !== 'all' || filters.status !== 'all'
              ? "No se encontraron técnicos"
              : "No hay técnicos disponibles",
            description: filters.search || filters.department !== 'all' || filters.status !== 'all'
              ? "Intenta ajustar los filtros de búsqueda"
              : "Comienza promoviendo un usuario a técnico",
            action: filters.search || filters.department !== 'all' || filters.status !== 'all' ? (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            ) : (
              <Button onClick={() => setShowUserSelection(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Promover Usuario
              </Button>
            )
          }}
        />
      </div>

      {/* Diálogo de selección de usuario */}
      <UserSelectionDialog
        open={showUserSelection}
        onOpenChange={setShowUserSelection}
        onUserSelected={(user) => {
          handlePromoteUser(user)
          setShowUserSelection(false)
        }}
      />

      {/* Diálogos modularizados */}
      <TechnicianFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingTechnician={editingTechnician}
        promotingUser={promotingUser}
        departments={departments}
        availableCategories={availableCategories || []}
        onSuccess={reload}
        onClose={handleCloseDialog}
      />

      <DeleteConfirmationDialog
        open={!!deletingTechnician}
        technician={deletingTechnician}
        onConfirm={handleDelete}
        onCancel={() => setDeletingTechnician(null)}
      />

      {/* Diálogo simple de despromover */}
      {demotingTechnician && (
        <DemoteTechnicianDialog
          open={!!demotingTechnician}
          onOpenChange={(open) => {
            if (!open) {
              setDemotingTechnician(null)
              setDemoteValidation(null)
            }
          }}
          technician={{
            id: demotingTechnician.id,
            name: demotingTechnician.name,
            email: demotingTechnician.email
          }}
          onSuccess={reload}
        />
      )}

      {/* Modal de asignaciones */}
      <TechnicianAssignmentsModal
        isOpen={assignmentsModal.isOpen}
        onClose={() => setAssignmentsModal({ isOpen: false, technicianId: '', technicianName: '' })}
        technicianId={assignmentsModal.technicianId}
        technicianName={assignmentsModal.technicianName}
      />
    </ModuleLayout>
  )
}

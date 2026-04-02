'use client'

/**
 * TechnicianManagementPanel — Panel de gestión global de técnicos.
 * Reemplaza la antigua página /admin/technicians.
 * Se abre como diálogo desde el Tab Personal de Familias.
 *
 * Contiene: stats, filtros, tabla/cards, promover, editar, despromover.
 * La asignación por familia sigue viviendo en TechnicianFamilyAssignment.
 */

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { TechnicianStatsPanel } from '@/components/technicians/technician-stats-panel'
import { TechnicianFilters } from '@/components/technicians/technician-filters'
import { TechnicianAssignmentsModal } from '@/components/ui/technician-assignments-modal'
import { DemoteTechnicianDialog } from '@/components/technicians/demote-technician-dialog'
import {
  TechnicianFormDialog,
  DeleteConfirmationDialog,
  UserSelectionDialog,
} from '@/components/admin/technicians/dialogs'
import {
  createTechnicianColumns,
  TechnicianCard,
} from '@/components/admin/technicians/tables/technician-columns'
import { useTechnicianData } from '@/hooks/technicians/use-technician-data'
import { useTechnicianStats } from '@/components/admin/technicians/TechnicianManagement.module'

// ── Trigger button ────────────────────────────────────────────────────────────

interface TechnicianManagementPanelProps {
  /** Called after any change that may affect family technician assignments */
  onChanged?: () => void
}

export function TechnicianManagementPanel({ onChanged }: TechnicianManagementPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Users className="h-4 w-4" />
        Administrar usuarios técnicos
      </Button>

      <TechnicianManagementDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) onChanged?.()
        }}
      />
    </>
  )
}

// ── Dialog ────────────────────────────────────────────────────────────────────

function TechnicianManagementDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [showUserSelection, setShowUserSelection] = useState(false)

  const {
    technicians,
    departments,
    availableCategories,
    filteredTechnicians,
    loading,
    error,
    reload,
    filters,
    setFilter,
    clearFilters,
    viewMode,
    setViewMode,
    pagination,
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
    handleEdit,
    handlePromoteUser,
    handleViewAssignments,
    handleOpenDemoteDialog,
    handleDelete,
    handleCloseDialog,
  } = useTechnicianData()

  const stats = useTechnicianStats(technicians, departments)

  const columns = createTechnicianColumns({
    onEdit: handleEdit,
    onDelete: setDeletingTechnician,
    onDemote: handleOpenDemoteDialog,
    onViewAssignments: handleViewAssignments,
  })

  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredTechnicians.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios Técnicos del Sistema
            </DialogTitle>
            <DialogDescription>
              Lista global de todos los técnicos — aquí puedes promover usuarios, editar datos o despromover.
              La asignación de técnicos a cada familia se hace en la sección de arriba.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Acción principal */}
            <div className="flex justify-end">
              <Button onClick={() => setShowUserSelection(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Promover Usuario a Técnico
              </Button>
            </div>

            {/* Stats */}
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

            {/* Tabla */}
            <DataTable
              title="Técnicos"
              description={`${filteredTechnicians.length} técnico(s) en el sistema`}
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
                title:
                  filters.search || filters.department !== 'all' || filters.status !== 'all'
                    ? 'No se encontraron técnicos'
                    : 'No hay técnicos disponibles',
                description:
                  filters.search || filters.department !== 'all' || filters.status !== 'all'
                    ? 'Intenta ajustar los filtros'
                    : 'Comienza promoviendo un usuario a técnico',
                action:
                  filters.search || filters.department !== 'all' || filters.status !== 'all' ? (
                    <Button variant="outline" onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  ) : (
                    <Button onClick={() => setShowUserSelection(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Promover Usuario
                    </Button>
                  ),
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-diálogos — fuera del Dialog principal para evitar anidamiento */}
      <UserSelectionDialog
        open={showUserSelection}
        onOpenChange={setShowUserSelection}
        onUserSelected={(user) => {
          handlePromoteUser(user)
          setShowUserSelection(false)
        }}
      />

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

      {demotingTechnician && (
        <DemoteTechnicianDialog
          open={!!demotingTechnician}
          onOpenChange={(v) => {
            if (!v) {
              setDemotingTechnician(null)
              setDemoteValidation(null)
            }
          }}
          technician={{
            id: demotingTechnician.id,
            name: demotingTechnician.name,
            email: demotingTechnician.email,
          }}
          onSuccess={reload}
        />
      )}

      <TechnicianAssignmentsModal
        isOpen={assignmentsModal.isOpen}
        onClose={() =>
          setAssignmentsModal({ isOpen: false, technicianId: '', technicianName: '' })
        }
        technicianId={assignmentsModal.technicianId}
        technicianName={assignmentsModal.technicianName}
      />
    </>
  )
}

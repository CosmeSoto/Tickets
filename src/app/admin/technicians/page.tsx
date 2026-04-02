'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

// Hooks y lógica de negocio
import { useTechnicianData } from '@/hooks/technicians/use-technician-data'
import { useTechnicianStats } from '@/components/admin/technicians/TechnicianManagement.module'

// Componentes de layout y UI
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
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

interface Family {
  id: string
  name: string
  code: string
  color?: string
  isActive: boolean
}

interface FamilyAssignment {
  id: string
  familyId: string
  isActive: boolean
  family: Family
}

function FamilyAssignmentPanel({
  technicianId,
  technicianName,
  open,
  onClose,
  onSuccess,
}: {
  technicianId: string
  technicianName: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [families, setFamilies] = useState<Family[]>([])
  const [assignments, setAssignments] = useState<FamilyAssignment[]>([])
  const [activeTicketsByFamily, setActiveTicketsByFamily] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !technicianId) return
    setLoading(true)
    Promise.all([
      fetch('/api/families?active=true').then(r => r.json()),
      fetch(`/api/technician-family-assignments?technicianId=${technicianId}`).then(r => r.json()),
    ])
      .then(([familiesData, assignmentsData]) => {
        if (familiesData.success) setFamilies(familiesData.data.filter((f: Family) => f.isActive))
        if (assignmentsData.success) setAssignments(assignmentsData.data || [])
        // Build active tickets map
        const ticketMap: Record<string, number> = {}
        ;(assignmentsData.data || []).forEach((a: any) => {
          ticketMap[a.familyId] = a.activeTickets ?? 0
        })
        setActiveTicketsByFamily(ticketMap)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, technicianId])

  const isAssigned = (familyId: string) =>
    assignments.some(a => a.familyId === familyId && a.isActive)

  const handleToggle = async (family: Family, checked: boolean) => {
    const activeTickets = activeTicketsByFamily[family.id] ?? 0
    if (!checked && activeTickets > 0) {
      const confirmed = window.confirm(
        `El técnico tiene ${activeTickets} ticket(s) activo(s) en la familia "${family.name}". ¿Deseas desasignar de todas formas?`
      )
      if (!confirmed) return
    }

    setSaving(true)
    try {
      if (checked) {
        const res = await fetch('/api/technician-family-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ technicianId, familyId: family.id }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || 'Error al asignar')
        toast({ title: `Asignado a "${family.name}"` })
      } else {
        const existing = assignments.find(a => a.familyId === family.id)
        if (!existing) return
        const res = await fetch(`/api/technician-family-assignments/${existing.id}?confirm=true`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || 'Error al desasignar')
        toast({ title: `Desasignado de "${family.name}"` })
      }
      // Reload assignments
      const r = await fetch(`/api/technician-family-assignments?technicianId=${technicianId}`)
      const d = await r.json()
      if (d.success) setAssignments(d.data || [])
      onSuccess()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center space-x-2'>
            <Layers className='h-5 w-5' />
            <span>Familias de {technicianName}</span>
          </DialogTitle>
          <DialogDescription>Asigna o desasigna familias para este técnico</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className='py-8 text-center text-muted-foreground'>Cargando...</div>
        ) : (
          <div className='space-y-3 max-h-96 overflow-y-auto'>
            {families.map(family => {
              const assigned = isAssigned(family.id)
              const activeTickets = activeTicketsByFamily[family.id] ?? 0
              return (
                <div key={family.id} className='flex items-center justify-between p-3 border rounded-lg'>
                  <div className='flex items-center space-x-3'>
                    <Checkbox
                      checked={assigned}
                      onCheckedChange={(checked) => handleToggle(family, !!checked)}
                      disabled={saving}
                    />
                    {family.color && (
                      <div className='w-3 h-3 rounded-full' style={{ backgroundColor: family.color }} />
                    )}
                    <div>
                      <p className='font-medium text-sm'>{family.name}</p>
                      <p className='text-xs text-muted-foreground'>{family.code}</p>
                    </div>
                  </div>
                  {assigned && activeTickets > 0 && (
                    <Badge variant='secondary' className='text-xs'>
                      {activeTickets} activos
                    </Badge>
                  )}
                </div>
              )
            })}
            {families.length === 0 && (
              <p className='text-center text-muted-foreground py-4'>No hay familias activas</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function TechniciansPage() {
  // Estado para el diálogo de selección de usuario
  const [showUserSelection, setShowUserSelection] = useState(false)
  const [familyPanelState, setFamilyPanelState] = useState<{
    open: boolean
    technicianId: string
    technicianName: string
  }>({ open: false, technicianId: '', technicianName: '' })

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
        <BackToTickets />
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
          rowActions={(technician: any) => (
            <Button
              variant='outline'
              size='sm'
              onClick={(e) => {
                e.stopPropagation()
                setFamilyPanelState({ open: true, technicianId: technician.id, technicianName: technician.name })
              }}
            >
              <Layers className='h-4 w-4 mr-1' />
              Familias
            </Button>
          )}
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

      {/* Panel de asignación de familias */}
      <FamilyAssignmentPanel
        open={familyPanelState.open}
        technicianId={familyPanelState.technicianId}
        technicianName={familyPanelState.technicianName}
        onClose={() => setFamilyPanelState({ open: false, technicianId: '', technicianName: '' })}
        onSuccess={reload}
      />
    </ModuleLayout>
  )
}

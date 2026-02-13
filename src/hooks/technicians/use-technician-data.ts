/**
 * Hook consolidado para gestión de datos de técnicos
 * Centraliza todo el estado y lógica de negocio
 */

'use client'

import { useState, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useModuleData } from '@/hooks/common/use-module-data'
import { useViewMode } from '@/hooks/common/use-view-mode'
import { usePagination } from '@/hooks/common/use-pagination'
import { useTechnicianFilters } from '@/hooks/common/use-technician-filters'
import { filterTechnicians } from '@/components/admin/technicians/TechnicianManagement.module'
import type { 
  Technician, 
  Department, 
  Category, 
  AssignmentsModal, 
  DemoteValidation 
} from '@/types/technicians'
import type { BaseUser } from '@/types/user'

export function useTechnicianData() {
  const { toast } = useToast()

  // Datos principales
  const {
    data: technicians,
    loading,
    error,
    reload
  } = useModuleData<Technician>({
    endpoint: '/api/users?role=TECHNICIAN',
    initialLoad: true
  })

  // Categorías disponibles
  const { data: availableCategories } = useModuleData<Category>({
    endpoint: '/api/categories?isActive=true',
    initialLoad: true
  })

  // Departamentos únicos
  const departments = useMemo(() => {
    const depts = technicians
      .map(t => t.department)
      .filter(Boolean) as Department[]
    
    const uniqueDepts = depts.filter((dept, index, self) =>
      index === self.findIndex(d => d.id === dept.id)
    )
    
    return uniqueDepts.sort((a, b) => a.name.localeCompare(b.name))
  }, [technicians])

  // Filtros
  const {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    activeFiltersCount,
    hasActiveFilters
  } = useTechnicianFilters()

  // Vista
  const { viewMode, setViewMode } = useViewMode('table', {
    storageKey: 'technicians-view-mode',
    availableModes: ['cards', 'table']
  })

  // Datos filtrados
  const filteredTechnicians = useMemo(() => {
    return filterTechnicians(technicians, debouncedFilters)
  }, [technicians, debouncedFilters])

  // Paginación
  const pagination = usePagination(filteredTechnicians, {
    pageSize: 20
  })

  // Estados de diálogos
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null)
  const [deletingTechnician, setDeletingTechnician] = useState<Technician | null>(null)
  const [demotingTechnician, setDemotingTechnician] = useState<Technician | null>(null)
  const [promotingUser, setPromotingUser] = useState<BaseUser | null>(null)
  const [demoteValidation, setDemoteValidation] = useState<DemoteValidation | null>(null)

  // Estado para modal de asignaciones
  const [assignmentsModal, setAssignmentsModal] = useState<AssignmentsModal>({
    isOpen: false,
    technicianId: '',
    technicianName: ''
  })

  // Handlers
  const handleEdit = (technician: Technician) => {
    setEditingTechnician(technician)
    setPromotingUser(null)
    setIsDialogOpen(true)
  }

  const handlePromoteUser = (user: BaseUser) => {
    setPromotingUser(user)
    setEditingTechnician(null)
    setIsDialogOpen(true)
  }

  const handleViewAssignments = (technician: Technician) => {
    setAssignmentsModal({
      isOpen: true,
      technicianId: technician.id,
      technicianName: technician.name
    })
  }

  const handleOpenDemoteDialog = (technician: Technician) => {
    setDemotingTechnician(technician)
    setDemoteValidation({
      canDemote: (technician._count?.assignedTickets || 0) === 0 && 
                 (technician._count?.technicianAssignments || 0) === 0,
      assignedTickets: technician._count?.assignedTickets || 0,
      activeAssignments: technician._count?.technicianAssignments || 0,
      reason: (technician._count?.assignedTickets || 0) > 0 
        ? `Tiene ${technician._count?.assignedTickets} ticket(s) asignado(s)`
        : (technician._count?.technicianAssignments || 0) > 0 
          ? `Tiene ${technician._count?.technicianAssignments} asignación(es) activa(s)`
          : undefined
    })
  }

  const handleDelete = async () => {
    if (!deletingTechnician) return
    
    try {
      const response = await fetch(`/api/users/${deletingTechnician.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        toast({
          title: 'Técnico eliminado',
          description: `${deletingTechnician.name} ha sido eliminado permanentemente.`,
          variant: 'default'
        })
        
        setDeletingTechnician(null)
        await reload()
      } else {
        toast({
          title: 'Error al eliminar técnico',
          description: result.error || 'No se pudo eliminar el técnico.',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('[CRITICAL] Error al eliminar técnico:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor.',
        variant: 'destructive'
      })
    }
  }

  const handleDemote = async () => {
    if (!demotingTechnician) return
    
    try {
      const response = await fetch(`/api/users/${demotingTechnician.id}/demote`, {
        method: 'POST',
        credentials: 'include',
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        toast({
          title: 'Técnico convertido a cliente',
          description: `${demotingTechnician.name} ha sido convertido a cliente exitosamente.`,
        })
        
        setDemotingTechnician(null)
        setDemoteValidation(null)
        await reload()
      } else {
        if (result.details) {
          const { reason, message, pendingTickets, activeAssignments } = result.details
          
          setDemoteValidation({
            canDemote: false,
            assignedTickets: pendingTickets || 0,
            activeAssignments: activeAssignments || 0,
            reason: message
          })
          
          toast({
            title: 'No se puede convertir a cliente',
            description: message,
            variant: 'destructive'
          })
        } else {
          toast({
            title: 'Error al convertir técnico',
            description: result.error || 'No se pudo convertir.',
            variant: 'destructive'
          })
        }
      }
    } catch (error) {
      console.error('[CRITICAL] Error al convertir técnico:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor.',
        variant: 'destructive'
      })
    }
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingTechnician(null)
    setPromotingUser(null)
  }

  const handleClearFilters = () => {
    clearFilters()
  }

  return {
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
    debouncedFilters,
    setFilter,
    clearFilters: handleClearFilters,
    activeFiltersCount,
    hasActiveFilters,

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
  }
}
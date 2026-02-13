/**
 * Módulo de lógica de negocio para gestión de técnicos
 * Centraliza cálculos, filtros y helpers reutilizables
 */

import { useMemo } from 'react'
import type { 
  Technician, 
  TechnicianStats, 
  TechnicianFilters, 
  Department 
} from '@/types/technicians'

/**
 * Hook para calcular estadísticas de técnicos
 */
export const useTechnicianStats = (
  technicians: Technician[], 
  departments: Department[]
): TechnicianStats => {
  return useMemo(() => {
    const total = technicians.length
    const active = technicians.filter(t => t.isActive).length
    const inactive = total - active
    const totalTickets = technicians.reduce((sum, t) => sum + (t._count?.assignedTickets || 0), 0)
    const totalAssignments = technicians.reduce((sum, t) => sum + (t._count?.technicianAssignments || 0), 0)
    const avgTicketsPerTechnician = active > 0 ? Math.round(totalTickets / active) : 0
    const avgAssignmentsPerTechnician = active > 0 ? Math.round(totalAssignments / active) : 0

    // Distribución por departamento
    const departmentDistribution = departments.map(dept => ({
      department: dept.name,
      count: technicians.filter(t => t.departmentId === dept.id).length,
      color: dept.color
    })).filter(d => d.count > 0)

    return {
      total,
      active,
      inactive,
      totalTickets,
      totalAssignments,
      departments: departments.length,
      avgTicketsPerTechnician,
      avgAssignmentsPerTechnician,
      departmentDistribution
    }
  }, [technicians, departments])
}

/**
 * Función para filtrar técnicos
 */
export const filterTechnicians = (
  technicians: Technician[], 
  filters: TechnicianFilters
): Technician[] => {
  return technicians.filter(tech => {
    // Filtro de búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        tech.name.toLowerCase().includes(searchLower) ||
        tech.email.toLowerCase().includes(searchLower) ||
        (tech.phone && tech.phone.includes(filters.search)) ||
        (tech.department?.name.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Filtro de departamento
    if (filters.department !== 'all') {
      if (filters.department === 'unassigned') {
        if (tech.departmentId) return false
      } else {
        if (tech.departmentId !== filters.department) return false
      }
    }

    // Filtro de estado
    if (filters.status !== 'all') {
      const isActive = filters.status === 'active'
      if (tech.isActive !== isActive) return false
    }

    return true
  })
}

/**
 * Helper para verificar si un técnico puede ser degradado
 */
export const canDemoteTechnician = (technician: Technician) => {
  const assignedTickets = technician._count?.assignedTickets || 0
  const activeAssignments = technician._count?.technicianAssignments || 0
  
  return {
    canDemote: assignedTickets === 0 && activeAssignments === 0,
    assignedTickets,
    activeAssignments,
    reason: assignedTickets > 0 
      ? `Tiene ${assignedTickets} ticket(s) asignado(s)`
      : activeAssignments > 0 
        ? `Tiene ${activeAssignments} asignación(es) de categoría activa(s)`
        : undefined
  }
}

/**
 * Helper para verificar si un técnico puede ser eliminado
 */
export const canDeleteTechnician = (technician: Technician) => {
  const assignedTickets = technician._count?.assignedTickets || 0
  const activeAssignments = technician._count?.technicianAssignments || 0
  
  return {
    canDelete: assignedTickets === 0 && activeAssignments === 0,
    assignedTickets,
    activeAssignments,
    reason: assignedTickets > 0 
      ? `No se puede eliminar: tiene ${assignedTickets} ticket(s) asignado(s)`
      : activeAssignments > 0 
        ? `No se puede eliminar: tiene ${activeAssignments} asignación(es) activa(s)`
        : undefined
  }
}

/**
 * Helper para formatear información del técnico
 */
export const formatTechnicianInfo = (technician: Technician) => {
  return {
    displayName: technician.name,
    displayEmail: technician.email,
    displayPhone: technician.phone || 'Sin teléfono',
    displayDepartment: technician.department?.name || 'Sin departamento',
    displayStatus: technician.isActive ? 'Activo' : 'Inactivo',
    displayTickets: technician._count?.assignedTickets || 0,
    displayAssignments: technician._count?.technicianAssignments || 0
  }
}

/**
 * Helper para validar datos del formulario
 */
export const validateTechnicianForm = (formData: any) => {
  const errors: Record<string, string> = {}

  // Validar nombre
  if (!formData.name?.trim()) {
    errors.name = 'El nombre es requerido'
  } else if (formData.name.trim().length < 2) {
    errors.name = 'El nombre debe tener al menos 2 caracteres'
  } else if (formData.name.trim().length > 100) {
    errors.name = 'El nombre no puede exceder 100 caracteres'
  }

  // Validar email
  if (!formData.email?.trim()) {
    errors.email = 'El email es requerido'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    errors.email = 'El email no es válido'
  }

  // Validar teléfono (opcional)
  if (formData.phone && formData.phone.trim()) {
    if (!/^[\d\s\-\+\(\)]+$/.test(formData.phone.trim())) {
      errors.phone = 'El teléfono solo puede contener números, espacios, guiones, paréntesis y el signo +'
    } else if (formData.phone.trim().length < 7) {
      errors.phone = 'El teléfono debe tener al menos 7 caracteres'
    }
  }

  // Validar asignaciones de categorías
  if (formData.assignedCategories && Array.isArray(formData.assignedCategories)) {
    const categoryIds = new Set()
    
    formData.assignedCategories.forEach((assignment: any, index: number) => {
      const prefix = `assignedCategories[${index}]`
      
      // Validar categoría seleccionada
      if (!assignment.categoryId) {
        errors[`${prefix}.categoryId`] = `Debe seleccionar una categoría para la asignación ${index + 1}`
      } else if (categoryIds.has(assignment.categoryId)) {
        errors[`${prefix}.categoryId`] = `La categoría ya está asignada en otra entrada`
      } else {
        categoryIds.add(assignment.categoryId)
      }
      
      // Validar prioridad
      if (typeof assignment.priority !== 'number' || assignment.priority < 1 || assignment.priority > 10) {
        errors[`${prefix}.priority`] = `La prioridad debe estar entre 1 y 10`
      }
      
      // Validar máximo de tickets (opcional)
      if (assignment.maxTickets !== undefined && assignment.maxTickets !== null) {
        if (typeof assignment.maxTickets !== 'number' || assignment.maxTickets < 1 || assignment.maxTickets > 1000) {
          errors[`${prefix}.maxTickets`] = `El máximo de tickets debe estar entre 1 y 1000`
        }
      }
    })
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}
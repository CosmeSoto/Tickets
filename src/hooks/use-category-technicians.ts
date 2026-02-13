'use client'

import { useCallback } from 'react'
import { FormData } from './use-categories'

export interface TechnicianAssignment {
  technicianId: string
  priority: number
  maxTickets?: number
  autoAssign: boolean
}

export interface Technician {
  id: string
  name: string
  email: string
  department?: {
    id: string
    name: string
  }
}

interface UseCategoryTechniciansProps {
  formData: FormData
  setFormData: (data: FormData) => void
  availableTechnicians: Technician[]
}

export function useCategoryTechnicians({
  formData,
  setFormData,
  availableTechnicians
}: UseCategoryTechniciansProps) {

  // Agregar técnico a la categoría
  const addTechnician = useCallback((technicianId: string) => {
    if (!formData.technician_assignments.find(t => t.technicianId === technicianId)) {
      const newPriority = Math.max(0, ...formData.technician_assignments.map(t => t.priority)) + 1
      
      setFormData({
        ...formData,
        technician_assignments: [
          ...formData.technician_assignments,
          {
            technicianId: technicianId,
            priority: newPriority,
            maxTickets: 10,
            autoAssign: true
          }
        ]
      })
    }
  }, [formData, setFormData])

  // Remover técnico de la categoría
  const removeTechnician = useCallback((technicianId: string) => {
    const updatedAssignments = formData.technician_assignments.filter(t => t.technicianId !== technicianId)
    
    // Reordenar prioridades para mantener secuencia
    const reorderedAssignments = updatedAssignments
      .sort((a, b) => a.priority - b.priority)
      .map((assignment, index) => ({
        ...assignment,
        priority: index + 1
      }))
    
    setFormData({
      ...formData,
      technician_assignments: reorderedAssignments
    })
  }, [formData, setFormData])

  // Actualizar prioridad de técnico
  const updateTechnicianPriority = useCallback((technicianId: string, newPriority: number) => {
    const assignments = [...formData.technician_assignments]
    const targetIndex = assignments.findIndex(t => t.technicianId === technicianId)
    
    if (targetIndex === -1) return
    
    const targetAssignment = assignments[targetIndex]
    const oldPriority = targetAssignment.priority
    
    // Actualizar prioridades de otros técnicos
    assignments.forEach(assignment => {
      if (assignment.technicianId === technicianId) {
        assignment.priority = newPriority
      } else if (oldPriority < newPriority) {
        // Moviendo hacia abajo: decrementar prioridades intermedias
        if (assignment.priority > oldPriority && assignment.priority <= newPriority) {
          assignment.priority -= 1
        }
      } else if (oldPriority > newPriority) {
        // Moviendo hacia arriba: incrementar prioridades intermedias
        if (assignment.priority >= newPriority && assignment.priority < oldPriority) {
          assignment.priority += 1
        }
      }
    })
    
    setFormData({
      ...formData,
      technician_assignments: assignments.sort((a, b) => a.priority - b.priority)
    })
  }, [formData, setFormData])

  // Actualizar máximo de tickets
  const updateTechnicianMaxTickets = useCallback((technicianId: string, maxTickets: number) => {
    setFormData({
      ...formData,
      technician_assignments: formData.technician_assignments.map(t =>
        t.technicianId === technicianId ? { ...t, maxTickets } : t
      )
    })
  }, [formData, setFormData])

  // Toggle auto-asignación
  const toggleTechnicianAutoAssign = useCallback((technicianId: string) => {
    setFormData({
      ...formData,
      technician_assignments: formData.technician_assignments.map(t =>
        t.technicianId === technicianId ? { ...t, autoAssign: !t.autoAssign } : t
      )
    })
  }, [formData, setFormData])

  // Mover técnico hacia arriba en prioridad
  const moveTechnicianUp = useCallback((technicianId: string) => {
    const assignment = formData.technician_assignments.find(t => t.technicianId === technicianId)
    if (assignment && assignment.priority > 1) {
      updateTechnicianPriority(technicianId, assignment.priority - 1)
    }
  }, [formData.technician_assignments, updateTechnicianPriority])

  // Mover técnico hacia abajo en prioridad
  const moveTechnicianDown = useCallback((technicianId: string) => {
    const assignment = formData.technician_assignments.find(t => t.technicianId === technicianId)
    const maxPriority = Math.max(...formData.technician_assignments.map(t => t.priority))
    
    if (assignment && assignment.priority < maxPriority) {
      updateTechnicianPriority(technicianId, assignment.priority + 1)
    }
  }, [formData.technician_assignments, updateTechnicianPriority])

  // Obtener técnicos disponibles (no asignados)
  const getAvailableTechnicians = useCallback(() => {
    const assignedIds = new Set(formData.technician_assignments.map(t => t.technicianId))
    return availableTechnicians.filter(tech => !assignedIds.has(tech.id))
  }, [availableTechnicians, formData.technician_assignments])

  // Obtener técnicos asignados con información completa
  const getAssignedTechnicians = useCallback(() => {
    return formData.technician_assignments
      .map(assignment => {
        const technician = availableTechnicians.find(t => t.id === assignment.technicianId)
        return technician ? {
          ...assignment,
          technician
        } : null
      })
      .filter(Boolean)
      .sort((a, b) => a!.priority - b!.priority)
  }, [formData.technician_assignments, availableTechnicians])

  // Validar asignaciones de técnicos
  const validateTechnicianAssignments = useCallback(() => {
    const errors: string[] = []
    
    // Verificar que todos los técnicos existen
    formData.technician_assignments.forEach(assignment => {
      const technician = availableTechnicians.find(t => t.id === assignment.technicianId)
      if (!technician) {
        errors.push(`Técnico con ID ${assignment.technicianId} no encontrado`)
      }
    })
    
    // Verificar prioridades únicas y secuenciales
    const priorities = formData.technician_assignments.map(t => t.priority).sort((a, b) => a - b)
    for (let i = 0; i < priorities.length; i++) {
      if (priorities[i] !== i + 1) {
        errors.push('Las prioridades deben ser secuenciales comenzando desde 1')
        break
      }
    }
    
    // Verificar límites de tickets
    formData.technician_assignments.forEach(assignment => {
      if (assignment.maxTickets && (assignment.maxTickets < 1 || assignment.maxTickets > 100)) {
        errors.push('El máximo de tickets debe estar entre 1 y 100')
      }
    })
    
    return errors
  }, [formData.technician_assignments, availableTechnicians])

  // Obtener estadísticas de asignaciones
  const getAssignmentStats = useCallback(() => {
    const total = formData.technician_assignments.length
    const autoAssignEnabled = formData.technician_assignments.filter(t => t.autoAssign).length
    const totalMaxTickets = formData.technician_assignments.reduce((sum, t) => sum + (t.maxTickets || 0), 0)
    const averageMaxTickets = total > 0 ? Math.round(totalMaxTickets / total) : 0
    
    return {
      total,
      autoAssignEnabled,
      totalMaxTickets,
      averageMaxTickets,
      hasAssignments: total > 0
    }
  }, [formData.technician_assignments])

  // Aplicar configuración por defecto a técnico
  const applyDefaultConfig = useCallback((technicianId: string) => {
    setFormData({
      ...formData,
      technician_assignments: formData.technician_assignments.map(t =>
        t.technicianId === technicianId 
          ? { ...t, maxTickets: 10, autoAssign: true }
          : t
      )
    })
  }, [formData, setFormData])

  // Limpiar todas las asignaciones
  const clearAllAssignments = useCallback(() => {
    setFormData({
      ...formData,
      technician_assignments: []
    })
  }, [formData, setFormData])

  // Obtener descripción del nivel para técnicos
  const getLevelDescription = useCallback((level: number): string => {
    switch (level) {
      case 1: return 'Técnicos generalistas - Manejan cualquier tipo de problema'
      case 2: return 'Técnicos especializados - Expertos en esta área específica'
      case 3: return 'Técnicos expertos - Conocimiento profundo en esta tecnología'
      case 4: return 'Técnicos súper especializados - Problemas muy específicos'
      default: return `Técnicos de nivel ${level}`
    }
  }, [])

  return {
    // Funciones principales
    addTechnician,
    removeTechnician,
    updateTechnicianPriority,
    updateTechnicianMaxTickets,
    toggleTechnicianAutoAssign,
    
    // Funciones de movimiento
    moveTechnicianUp,
    moveTechnicianDown,
    
    // Funciones de consulta
    getAvailableTechnicians,
    getAssignedTechnicians,
    validateTechnicianAssignments,
    getAssignmentStats,
    getLevelDescription,
    
    // Funciones de utilidad
    applyDefaultConfig,
    clearAllAssignments,
    
    // Estados derivados
    hasAssignments: formData.technician_assignments.length > 0,
    assignmentCount: formData.technician_assignments.length,
    availableCount: getAvailableTechnicians().length,
  }
}
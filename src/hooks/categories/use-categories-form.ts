/**
 * Hook para gestión de formularios de categorías
 * Responsabilidad: Manejar estado del formulario, validación y operaciones CRUD
 */

'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { CategoryData, FormData } from './types'

interface UseCategoriesFormOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useCategoriesForm(options: UseCategoriesFormOptions = {}) {
  const { onSuccess, onError } = options
  
  // Estados de formulario
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoryData | null>(null)
  const [formData, setFormData] = useState<FormData>({
    name: '',
    description: '',
    color: '#6B7280',
    parentId: null,
    departmentId: null,
    familyId: null,
    isActive: true,
    technician_assignments: [],
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const { toast } = useToast()
  
  // Validar formulario
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido'
    }
    
    if (formData.name.length > 100) {
      errors.name = 'El nombre no puede exceder 100 caracteres'
    }
    
    // Departamento es obligatorio
    if (!formData.departmentId) {
      errors.departmentId = 'El departamento es requerido'
    }
    
    // Validar color hexadecimal
    const colorRegex = /^#[0-9A-F]{6}$/i
    if (!colorRegex.test(formData.color)) {
      errors.color = 'El color debe ser un código hexadecimal válido (ej: #FF0000)'
    }
    
    // Validar asignaciones de técnicos
    if (formData.technician_assignments.length > 0) {
      formData.technician_assignments.forEach((assignment, index) => {
        if (!assignment.technicianId) {
          errors[`technician_${index}_id`] = 'Debe seleccionar un técnico'
        }
        if (assignment.priority < 1 || assignment.priority > 10) {
          errors[`technician_${index}_priority`] = 'La prioridad debe estar entre 1 y 10'
        }
        if (assignment.maxTickets && assignment.maxTickets < 1) {
          errors[`technician_${index}_maxTickets`] = 'El máximo de tickets debe ser mayor a 0'
        }
      })
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData])
  
  // Resetear formulario
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      color: '#6B7280',
      parentId: null,
      departmentId: null,
      familyId: null,
      isActive: true,
      technician_assignments: [],
    })
    setFormErrors({})
    setEditingCategory(null)
    setDeletingCategory(null)
  }, [])
  
  // Abrir diálogo para nueva categoría
  const handleNew = useCallback(() => {
    resetForm()
    setIsDialogOpen(true)
  }, [resetForm])
  
  // Abrir diálogo para editar
  const handleEdit = useCallback((category: CategoryData) => {
    setEditingCategory(category)
    const parentId = category.parentId || category.categories?.id || null
    setFormData({
      name: category.name,
      description: category.description || '',
      color: category.color,
      parentId: parentId,
      departmentId: category.departmentId || null,
      familyId: category.departments?.familyId ?? category.department?.familyId ?? null,
      isActive: category.isActive,
      technician_assignments: category.technician_assignments.map(ta => ({
        technicianId: ta.technicianId,
        priority: ta.priority,
        maxTickets: ta.maxTickets,
        autoAssign: ta.autoAssign,
      })),
    })
    setIsDialogOpen(true)
  }, [])
  
  // Calcular nivel basado en categoría padre
  const calculateLevel = useCallback((parentId: string | null, availableParents: CategoryData[]): number => {
    if (!parentId) return 1
    const parent = availableParents.find(p => p.id === parentId)
    return (parent?.level || 0) + 1
  }, [])

  // Enviar formulario
  const handleSubmit = useCallback(async (invalidateCache: () => void, reload: () => Promise<void>, availableParents: CategoryData[] = []) => {
    if (!validateForm()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor corrige los errores en el formulario antes de continuar',
        variant: 'destructive',
        duration: 4000,
      })
      return
    }
    
    setSubmitting(true)
    
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories'
      
      const method = editingCategory ? 'PUT' : 'POST'
      
      const { technician_assignments, familyId: _familyId, ...restFormData } = formData
      
      // Calcular nivel basado en categoría padre
      const level = calculateLevel(restFormData.parentId, availableParents)
      
      const apiData = {
        name: restFormData.name.trim(),
        description: restFormData.description?.trim() || '',
        color: restFormData.color,
        level,
        parentId: restFormData.parentId || undefined,
        departmentId: restFormData.departmentId || undefined,
        isActive: Boolean(restFormData.isActive),
        assignedTechnicians: technician_assignments.map(ta => ({
          id: ta.technicianId,
          priority: Number(ta.priority) || 1,
          maxTickets: ta.maxTickets ? Number(ta.maxTickets) : undefined,
          autoAssign: Boolean(ta.autoAssign),
        }))
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
        credentials: 'include',
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        const categoryName = formData.name
        toast({
          title: editingCategory ? 'Categoría actualizada exitosamente' : 'Categoría creada exitosamente',
          description: editingCategory
            ? `"${categoryName}" ha sido actualizada correctamente en el sistema`
            : `"${categoryName}" ha sido agregada al árbol de categorías`,
          duration: 4000,
        })
        
        setIsDialogOpen(false)
        resetForm()
        invalidateCache()
        await reload()
        onSuccess?.()
      } else {
        // Mostrar detalles específicos del error
        const errorDetails = data.details ? 
          data.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ') : 
          data.error || data.message || 'Error desconocido'
        
        throw new Error(errorDetails)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast({
        title: editingCategory ? 'Error al actualizar categoría' : 'Error al crear categoría',
        description: `No se pudo ${editingCategory ? 'actualizar' : 'crear'} la categoría. ${errorMessage}`,
        variant: 'destructive',
        duration: 5000,
      })
      onError?.(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }, [formData, editingCategory, validateForm, resetForm, toast, onSuccess, onError, calculateLevel])
  
  // Eliminar categoría
  const handleDelete = useCallback(async (invalidateCache: () => void, reload: () => Promise<void>) => {
    if (!deletingCategory) return
    
    setDeleting(true)
    const categoryName = deletingCategory.name
    
    try {
      const response = await fetch(`/api/categories/${deletingCategory.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          title: 'Categoría eliminada exitosamente',
          description: `"${categoryName}" ha sido eliminada permanentemente del sistema`,
          duration: 4000,
        })
        
        setDeletingCategory(null)
        invalidateCache()
        await reload()
        onSuccess?.()
      } else {
        throw new Error(data.message || 'Error al eliminar categoría')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      toast({
        title: 'Error al eliminar categoría',
        description: `No se pudo eliminar "${categoryName}". ${errorMessage}`,
        variant: 'destructive',
        duration: 5000,
      })
      onError?.(errorMessage)
    } finally {
      setDeleting(false)
    }
  }, [deletingCategory, toast, onSuccess, onError])
  
  return {
    // Estados
    isDialogOpen,
    editingCategory,
    deletingCategory,
    formData,
    formErrors,
    submitting,
    deleting,
    
    // Funciones
    handleNew,
    handleEdit,
    handleSubmit,
    handleDelete,
    resetForm,
    validateForm,
    calculateLevel,
    
    // Setters
    setIsDialogOpen,
    setDeletingCategory,
    setFormData,
    setFormErrors,
  }
}

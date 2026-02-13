/**
 * Hook para gestión de técnicos
 * Simplificado para usar constantes centralizadas y hooks unificados
 */

import { useState, useEffect, useMemo } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { BaseUser } from '@/types/user'

interface Technician {
  id: string
  name: string
  email: string
  phone?: string
  departmentId?: string
  isActive: boolean
  role: string
  createdAt: string
  canDelete?: boolean
  department?: {
    id: string
    name: string
    color: string
    description?: string
  }
  _count?: {
    assignedTickets: number
    technicianAssignments: number
  }
  technicianAssignments?: {
    id: string
    priority: number
    maxTickets?: number
    autoAssign: boolean
    category: {
      id: string
      name: string
      color: string
      level: number
      levelName: string
    }
  }[]
}

interface FormData {
  name: string
  email: string
  phone: string
  departmentId: string | null
  isActive: boolean
  assignedCategories: {
    categoryId: string
    priority: number
    maxTickets?: number
    autoAssign: boolean
  }[]
}

export function useTechnicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [availableCategories, setAvailableCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { success, error: showError } = useToast()

  const loadTechnicians = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/users?role=TECHNICIAN', {
        credentials: 'include',
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login?callbackUrl=' + encodeURIComponent(window.location.pathname)
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && Array.isArray(data.data)) {
        setTechnicians(data.data)
      } else {
        throw new Error('Formato de respuesta inválido')
      }
      
    } catch (error) {
      console.error('Error cargando técnicos:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setError(errorMessage)
      setTechnicians([])
      
      showError(
        'Error al cargar técnicos',
        `No se pudieron cargar los técnicos: ${errorMessage}`
      )
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableCategories = async () => {
    try {
      const response = await fetch('/api/categories?isActive=true')
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && Array.isArray(data.data)) {
          setAvailableCategories(data.data)
        }
      }
    } catch (error) {
      console.error('Error cargando categorías:', error)
    }
  }

  useEffect(() => {
    loadTechnicians()
    loadAvailableCategories()
  }, [])

  const departments = useMemo(() => {
    const depts = technicians
      .map(t => t.department)
      .filter(Boolean) as Array<{ id: string; name: string; color: string }>
    
    const uniqueDepts = depts.filter((dept, index, self) =>
      index === self.findIndex(d => d.id === dept.id)
    )
    
    return uniqueDepts.sort((a, b) => a.name.localeCompare(b.name))
  }, [technicians])

  const deleteTechnician = async (technician: Technician) => {
    try {
      const response = await fetch(`/api/users/${technician.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        await loadTechnicians()
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Error al eliminar técnico:', error)
      return { success: false, error: 'Error de conexión' }
    }
  }

  const demoteTechnician = async (technician: Technician) => {
    try {
      const response = await fetch(`/api/users/${technician.id}/demote`, {
        method: 'POST',
        credentials: 'include',
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        await loadTechnicians()
        return { success: true }
      } else {
        return { success: false, error: result.error, details: result.details }
      }
    } catch (error) {
      console.error('[CRITICAL] Error al convertir técnico:', error)
      return { success: false, error: 'Error de conexión' }
    }
  }

  const saveTechnician = async (
    formData: FormData,
    editingTechnician: Technician | null,
    promotingUser: BaseUser | null
  ) => {
    try {
      let url: string
      let method: string
      
      if (editingTechnician) {
        url = `/api/users/${editingTechnician.id}`
        method = 'PUT'
      } else if (promotingUser) {
        url = `/api/users/${promotingUser.id}`
        method = 'PUT'
      } else {
        throw new Error('Operación no válida')
      }
      
      const payload = {
        ...formData,
        role: 'TECHNICIAN',
      }
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      
      const result = await response.json()
      
      if (response.ok && result.success) {
        await loadTechnicians()
        return { success: true }
      } else {
        return { success: false, error: result.error, details: result.details }
      }
    } catch (error) {
      console.error('Error al guardar técnico:', error)
      return { success: false, error: 'Error de conexión' }
    }
  }

  return {
    technicians,
    availableCategories,
    loading,
    error,
    departments,
    loadTechnicians,
    deleteTechnician,
    demoteTechnician,
    saveTechnician,
  }
}

export type { Technician, FormData }

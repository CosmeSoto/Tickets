/**
 * Hook para gestión de usuarios - CARGA TODOS LOS DATOS UNA VEZ y filtra en memoria
 * Funciona exactamente como el módulo de técnicos (SIN useEffect con API calls)
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { useModuleData } from '@/hooks/common/use-module-data'
import { usePagination } from '@/hooks/common/use-pagination'
import { type UserRole } from '@/lib/constants/user-constants'

export interface UserData {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string | {
    id: string
    name: string
    color: string
    description?: string
  }
  phone?: string
  avatar?: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
  canDelete?: boolean
  _count: {
    tickets_tickets_createdByIdTousers: number
    tickets_tickets_assigneeIdTousers: number
  }
}

export interface UserFilters {
  search?: string
  role?: string
  isActive?: string
  departmentId?: string
  department?: string
}

export interface UserPaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface UserError {
  type: 'network' | 'permission' | 'validation' | 'server' | 'unknown'
  message: string
  code?: number
}

export interface UserStats {
  total: number
  active: number
  inactive: number
  admins: number
  technicians: number
  clients: number
}

interface UseUsersOptions {
  initialFilters?: UserFilters
  pageSize?: number
  enableCache?: boolean
}

interface UseUsersReturn {
  users: UserData[]
  loading: boolean
  error: UserError | null
  pagination: UserPaginationInfo
  filters: UserFilters
  stats: UserStats
  setFilters: (filters: Partial<UserFilters>) => void
  clearFilters: () => void
  refresh: () => void
  goToPage: (page: number) => void
  hasActiveFilters: boolean
  createUser: (userData: any) => Promise<boolean>
  updateUser: (userId: string, userData: any) => Promise<boolean>
  deleteUser: (userId: string) => Promise<boolean>
  toggleUserStatus: (userId: string, currentStatus: boolean) => Promise<boolean>
}

// Función para filtrar usuarios en memoria (como filterTechnicians)
function filterUsers(users: UserData[], filters: UserFilters, currentUserId?: string) {
  return users.map(user => ({
    ...user,
    canDelete: user.id !== currentUserId && 
              (user._count?.tickets_tickets_assigneeIdTousers || 0) === 0
  })).filter(user => {
    // Búsqueda
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      const matchesSearch = 
        user.name.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        (user.phone && user.phone.toLowerCase().includes(searchLower))
      
      if (!matchesSearch) return false
    }

    // Rol
    if (filters.role && filters.role !== 'all' && user.role !== filters.role) return false

    // Estado
    if (filters.isActive && filters.isActive !== 'all') {
      const isActive = filters.isActive === 'true'
      if (user.isActive !== isActive) return false
    }

    // Departamento
    const departmentId = filters.departmentId || filters.department
    if (departmentId && departmentId !== 'all') {
      const userDeptId = typeof user.department === 'object' ? user.department?.id : user.department
      if (userDeptId !== departmentId) return false
    }

    return true
  })
}

export function useUsers(options: UseUsersOptions = {}): UseUsersReturn {
  const {
    initialFilters = {},
    pageSize = 20
  } = options

  const { data: session } = useSession()
  const { toast } = useToast()

  // Estado de filtros (manejado localmente)
  const [filters, setFiltersState] = useState<UserFilters>(initialFilters)

  // Cargar TODOS los usuarios UNA VEZ (como técnicos)
  const {
    data: allUsers,
    loading,
    error: moduleError,
    reload
  } = useModuleData<UserData>({
    endpoint: '/api/users',
    initialLoad: true
  })

  // Filtrar en MEMORIA (como técnicos)
  const filteredUsers = useMemo(() => {
    return filterUsers(allUsers, filters, session?.user?.id)
  }, [allUsers, filters, session?.user?.id])

  // Paginación
  const pagination = usePagination(filteredUsers, {
    pageSize
  })

  // Estadísticas
  const stats = useMemo(() => {
    return {
      total: filteredUsers.length,
      active: filteredUsers.filter(u => u.isActive).length,
      inactive: filteredUsers.filter(u => !u.isActive).length,
      admins: filteredUsers.filter(u => u.role === 'ADMIN').length,
      technicians: filteredUsers.filter(u => u.role === 'TECHNICIAN').length,
      clients: filteredUsers.filter(u => u.role === 'CLIENT').length,
    }
  }, [filteredUsers])

  // Error tipado
  const error = useMemo((): UserError | null => {
    if (!moduleError) return null
    return {
      type: 'unknown',
      message: moduleError
    }
  }, [moduleError])

  // Función para crear usuario
  const createUser = async (userData: any): Promise<boolean> => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Éxito',
          description: 'Usuario creado correctamente'
        })
        await reload()
        return true
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo crear el usuario',
          variant: 'destructive'
        })
        return false
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
      return false
    }
  }

  // Función para actualizar usuario
  const updateUser = async (userId: string, userData: any): Promise<boolean> => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Éxito',
          description: 'Usuario actualizado correctamente'
        })
        await reload()
        return true
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo actualizar el usuario',
          variant: 'destructive'
        })
        return false
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
      return false
    }
  }

  // Función para eliminar usuario
  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Éxito',
          description: 'Usuario eliminado correctamente'
        })
        await reload()
        return true
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo eliminar el usuario',
          variant: 'destructive'
        })
        return false
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
      return false
    }
  }

  // Función para cambiar estado de usuario
  const toggleUserStatus = async (userId: string, currentStatus: boolean): Promise<boolean> => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !currentStatus }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        await reload()
        return true
      } else {
        toast({
          title: 'Error',
          description: result.error || 'No se pudo cambiar el estado del usuario',
          variant: 'destructive'
        })
        return false
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
      return false
    }
  }

  // Funciones de utilidad
  const setFilters = useCallback((newFilters: Partial<UserFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState({})
  }, [])

  const refresh = reload

  const goToPage = (page: number) => {
    if (page !== pagination.currentPage && page >= 1 && page <= pagination.totalPages) {
      pagination.goToPage(page)
    }
  }

  // Computed values
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some(value => 
      value && value.toString().trim() && value !== 'all'
    )
  }, [filters])

  // Paginación info
  const paginationInfo: UserPaginationInfo = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: filteredUsers.length,
    totalPages: pagination.totalPages
  }

  return {
    users: pagination.currentItems,
    loading,
    error,
    pagination: paginationInfo,
    filters,
    stats,
    setFilters,
    clearFilters,
    refresh,
    goToPage,
    hasActiveFilters,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus
  }
}

// Función para formatear tiempo relativo
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `${days} días`
  if (days < 365) return `${Math.floor(days / 30)} meses`
  return `${Math.floor(days / 365)} años`
}

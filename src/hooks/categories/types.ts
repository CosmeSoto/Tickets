/**
 * Tipos compartidos para el módulo de categorías
 */

export interface CategoryData {
  id: string
  name: string
  description?: string
  color: string
  level: number
  levelName: string
  isActive: boolean
  canDelete: boolean
  departmentId?: string
  department?: {
    id: string
    name: string
    color: string
    familyId?: string
    family?: { id: string; name: string; code: string; color?: string | null }
  }
  // Prisma relation name (plural)
  departments?: {
    id: string
    name: string
    color: string
    familyId?: string
    family?: { id: string; name: string; code: string; color?: string | null }
  }
  parentId?: string
  categories?: {
    id: string
    name: string
    color: string
    level: number
    parentId?: string
    categories?: any
  }
  other_categories: {
    id: string
    name: string
    color: string
    level: number
    isActive: boolean
  }[]
  _count: {
    tickets: number
    other_categories: number
    technician_assignments: number
  }
  technician_assignments: {
    id: string
    technicianId: string
    priority: number
    maxTickets?: number
    autoAssign: boolean
    users: {
      id: string
      name: string
      email: string
    }
  }[]
}

export interface FormData {
  name: string
  description: string
  color: string
  parentId: string | null
  departmentId: string | null
  familyId: string | null
  isActive: boolean
  technician_assignments: {
    technicianId: string
    priority: number
    maxTickets?: number
    autoAssign: boolean
  }[]
}

export interface UseCategoriesOptions {
  cacheTTL?: number
  enableCache?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  enablePagination?: boolean
  pageSize?: number
  enableMassActions?: boolean
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

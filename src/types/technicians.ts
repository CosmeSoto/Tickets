/**
 * Tipos centralizados para el módulo de técnicos
 */

export interface Department {
  id: string
  name: string
  color: string
  description?: string
  isActive: boolean
}

export interface Category {
  id: string
  name: string
  color: string
  level: number
  levelName: string
  description?: string
}

export interface TechnicianAssignment {
  id: string
  priority: number
  maxTickets?: number
  autoAssign: boolean
  category: Category
}

export interface Technician {
  id: string
  name: string
  email: string
  phone?: string
  departmentId?: string
  isActive: boolean
  role: string
  createdAt: string
  updatedAt: string
  canDelete?: boolean
  department?: Department
  _count?: {
    assignedTickets: number
    technicianAssignments: number
  }
  technicianAssignments?: TechnicianAssignment[]
}

export interface TechnicianFormData {
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

export interface TechnicianStats {
  total: number
  active: number
  inactive: number
  totalTickets: number
  totalAssignments: number
  departments: number
  avgTicketsPerTechnician: number
  avgAssignmentsPerTechnician: number
  departmentDistribution: Array<{
    department: string
    count: number
    color: string
  }>
}

export interface TechnicianFilters {
  search: string
  department: string
  status: string
}

export interface TechnicianPagination {
  page: number
  limit: number
  total: number
}

export interface AssignmentsModal {
  isOpen: boolean
  technicianId: string
  technicianName: string
}

export interface DemoteValidation {
  canDemote: boolean
  reason?: string
  assignedTickets: number
  activeAssignments: number
}
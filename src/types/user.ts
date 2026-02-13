/**
 * Tipos comunes para usuarios
 */

export interface UserCount {
  tickets_tickets_createdByIdTousers: number
  tickets_tickets_assigneeIdTousers: number
  technician_assignments?: number
}

export interface Department {
  id: string
  name: string
  color: string
  description?: string
}

export interface BaseUser {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  phone?: string
  departmentId?: string
  department?: string | Department
  isActive: boolean
  avatar?: string
  lastLogin?: string
  createdAt: string
  updatedAt?: string
  _count?: UserCount
}

export interface TechnicianAssignment {
  id: string
  priority: number
  maxTickets: number
  autoAssign: boolean
  category: {
    id: string
    name: string
    level: number
    color?: string
  }
}

export interface Technician extends BaseUser {
  role: 'TECHNICIAN'
  technician_assignments?: TechnicianAssignment[]
}

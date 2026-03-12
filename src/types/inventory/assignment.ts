import type { AssignmentType } from '@prisma/client'

// Assignment interface
export interface Assignment {
  id: string
  equipmentId: string
  receiverId: string
  delivererId: string
  assignmentType: AssignmentType
  startDate: Date
  endDate?: Date
  actualEndDate?: Date
  accessories: string[]
  observations?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  equipment?: any
  receiver?: any
  deliverer?: any
  deliveryAct?: any
  returnAct?: any
}

// Assignment form data
export interface AssignmentFormData {
  equipmentId: string
  receiverId: string
  assignmentType: AssignmentType
  startDate: Date | string
  endDate?: Date | string
  accessories: string[]
  observations?: string
}

// Assignment filters
export interface AssignmentFilters {
  equipmentId?: string
  receiverId?: string
  delivererId?: string
  assignmentType?: AssignmentType[]
  isActive?: boolean
  startDate?: Date
  endDate?: Date
}

// Assignment list response
export interface AssignmentListResponse {
  assignments: Assignment[]
  total: number
  page: number
  limit: number
}

// Assignment detail response
export interface AssignmentDetailResponse {
  assignment: Assignment
  equipment: any
  receiver: any
  deliverer: any
  deliveryAct?: any
  returnAct?: any
}

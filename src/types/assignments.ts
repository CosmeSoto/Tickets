/**
 * Centralized assignment type definitions for family assignments.
 * These interfaces are shared across family assignment components.
 */

export interface AssignedTechnician {
  id: string
  technicianId: string
  familyId: string
  isActive: boolean
  technician: {
    id: string
    name: string
    email: string
    role: string
    isActive: boolean
  }
}

export interface AssignedManager {
  id: string
  managerId: string
  familyId: string
  manager: {
    id: string
    name: string
    email: string
    role: string
    canManageInventory: boolean
    isActive: boolean
  }
}

export interface AssignedAdmin {
  id: string
  adminId: string
  familyId: string
  isActive: boolean
  admin: {
    id: string
    name: string
    email: string
    isSuperAdmin: boolean
  }
}

export interface AssignedClient {
  id: string
  clientId: string
  familyId: string
  isActive: boolean
  client: {
    id: string
    name: string
    email: string
    role: string
    isActive: boolean
  }
}

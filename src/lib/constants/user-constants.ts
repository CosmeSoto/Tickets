/**
 * Constantes centralizadas para el módulo de usuarios
 * Evita duplicación y asegura consistencia visual
 */

import { Shield, Wrench, UserCircle, LucideIcon } from 'lucide-react'

// ============================================================================
// DEFINICIONES DE ROLES
// ============================================================================

export const USER_ROLES = {
  ADMIN: 'ADMIN',
  TECHNICIAN: 'TECHNICIAN',
  CLIENT: 'CLIENT'
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

// ============================================================================
// ETIQUETAS DE ROLES
// ============================================================================

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente'
} as const

// ============================================================================
// COLORES DE ROLES (CONSISTENTES EN TODO EL SISTEMA)
// ============================================================================

export const USER_ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 border-purple-200',
  TECHNICIAN: 'bg-blue-100 text-blue-700 border-blue-200',
  CLIENT: 'bg-green-100 text-green-700 border-green-200'
} as const

// ============================================================================
// ICONOS DE ROLES (CONSISTENTES)
// ============================================================================

export const USER_ROLE_ICONS: Record<UserRole, LucideIcon> = {
  ADMIN: Shield,
  TECHNICIAN: Wrench, // Corrige inconsistencia UserPlus → Wrench
  CLIENT: UserCircle
} as const

// ============================================================================
// OPCIONES DE FILTRO DE ROLES
// ============================================================================

export const USER_ROLE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los roles' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: USER_ROLES.ADMIN, label: USER_ROLE_LABELS.ADMIN },
  { value: USER_ROLES.TECHNICIAN, label: USER_ROLE_LABELS.TECHNICIAN },
  { value: USER_ROLES.CLIENT, label: USER_ROLE_LABELS.CLIENT }
] as const

export type UserRoleFilterOption = typeof USER_ROLE_FILTER_OPTIONS[number]

// Alias para compatibilidad con filter-options.ts
export const USER_ROLE_OPTIONS = USER_ROLE_FILTER_OPTIONS

// ============================================================================
// OPCIONES DE FILTRO DE ESTADO
// ============================================================================

export const USER_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' }
] as const

export type UserStatusFilterOption = typeof USER_STATUS_FILTER_OPTIONS[number]

// Alias para compatibilidad con filter-options.ts
export const USER_STATUS_OPTIONS = USER_STATUS_FILTER_OPTIONS

// ============================================================================
// OPCIONES DE ROL PARA FORMULARIOS
// ============================================================================

export const USER_ROLE_FORM_OPTIONS = [
  {
    value: USER_ROLES.CLIENT,
    label: USER_ROLE_LABELS.CLIENT,
    color: USER_ROLE_COLORS.CLIENT,
    icon: USER_ROLE_ICONS.CLIENT
  },
  {
    value: USER_ROLES.TECHNICIAN,
    label: USER_ROLE_LABELS.TECHNICIAN,
    color: USER_ROLE_COLORS.TECHNICIAN,
    icon: USER_ROLE_ICONS.TECHNICIAN
  },
  {
    value: USER_ROLES.ADMIN,
    label: USER_ROLE_LABELS.ADMIN,
    color: USER_ROLE_COLORS.ADMIN,
    icon: USER_ROLE_ICONS.ADMIN
  }
] as const

export type UserRoleFormOption = typeof USER_ROLE_FORM_OPTIONS[number]

// ============================================================================
// CAMPOS DE BÚSQUEDA
// ============================================================================

export const USER_SEARCH_FIELDS = [
  'name',
  'email',
  'department.name',
  'phone'
] as const

// ============================================================================
// ESTADOS DE USUARIO
// ============================================================================

export const USER_STATUSES = {
  ACTIVE: true,
  INACTIVE: false
} as const

export type UserStatus = typeof USER_STATUSES[keyof typeof USER_STATUSES]

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Obtiene el label de un rol
 */
export function getUserRoleLabel(role: UserRole): string {
  return USER_ROLE_LABELS[role]
}

/**
 * Obtiene el color de un rol
 */
export function getUserRoleColor(role: UserRole): string {
  return USER_ROLE_COLORS[role]
}

/**
 * Obtiene el icono de un rol
 */
export function getUserRoleIcon(role: UserRole): LucideIcon {
  return USER_ROLE_ICONS[role]
}

/**
 * Valida si un valor es un rol válido
 */
export function isValidUserRole(value: any): value is UserRole {
  return Object.values(USER_ROLES).includes(value)
}

/**
 * Valida si un valor es un estado válido
 */
export function isValidUserStatus(value: any): value is UserStatus {
  return Object.values(USER_STATUSES).includes(value)
}
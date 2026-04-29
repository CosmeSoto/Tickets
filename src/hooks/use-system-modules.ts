/**
 * Hook to load the system modules catalog.
 * Used by the user edit modal to dynamically render module toggles.
 */

'use client'

import { useState, useEffect } from 'react'

export interface SystemModule {
  key: string
  name: string
  description?: string | null
  icon?: string | null
  isActive: boolean
  order: number
  defaultForAdmin: boolean
  defaultForTech: boolean
  defaultForClient: boolean
  requiresManager: boolean
  familyScoped: boolean
}

// Fallback in case the API is unavailable
const FALLBACK: SystemModule[] = [
  {
    key: 'tickets',
    name: 'Tickets de Soporte',
    description: 'Gestión de tickets de soporte técnico',
    icon: 'Ticket',
    isActive: true,
    order: 1,
    defaultForAdmin: true,
    defaultForTech: true,
    defaultForClient: true,
    requiresManager: false,
    familyScoped: true,
  },
  {
    key: 'inventory',
    name: 'Inventario',
    description: 'Gestión de activos, equipos y consumibles',
    icon: 'Package',
    isActive: true,
    order: 2,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: true,
    familyScoped: true,
  },
]

export function useSystemModules() {
  const [modules, setModules] = useState<SystemModule[]>(FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/system-modules')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setModules(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { modules, loading }
}

/**
 * Get the user-facing description for a module based on role
 */
export function getModuleRoleDescription(moduleKey: string, role: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    tickets: {
      TECHNICIAN: 'Ver y atender tickets asignados a sus familias',
      CLIENT: 'Crear y seguir sus propios tickets de soporte',
    },
    inventory: {
      TECHNICIAN: 'Ver y gestionar activos de sus familias asignadas',
      CLIENT: 'Ver sus equipos asignados y solicitar mantenimientos',
    },
  }
  return descriptions[moduleKey]?.[role] ?? 'Acceso al módulo'
}

/**
 * Get the module icon emoji for display
 */
export function getModuleEmoji(moduleKey: string): string {
  const emojis: Record<string, string> = {
    tickets: '🎫',
    inventory: '📦',
    contracts: '📄',
    reports: '📊',
    knowledge: '📚',
    hr: '👥',
    crm: '🤝',
  }
  return emojis[moduleKey] ?? '🔧'
}

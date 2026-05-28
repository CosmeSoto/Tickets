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
  {
    key: 'patrols',
    name: 'Rondas y Patrullajes',
    description: 'Ejecución y supervisión de rondas de seguridad',
    icon: 'Shield',
    isActive: true,
    order: 3,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: false,
    familyScoped: true,
  },
  {
    key: 'news',
    name: 'Noticias y Comunicados',
    description: 'Gestión de noticias y comunicados internos',
    icon: 'Newspaper',
    isActive: true,
    order: 4,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: false,
    familyScoped: false,
  },
  {
    key: 'forms',
    name: 'Documentos',
    description: 'Gestión de documentos descargables',
    icon: 'FileText',
    isActive: true,
    order: 5,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: true,
    familyScoped: false,
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
      ADMIN: 'Crear propios y de su personal, gestionar tickets de sus familias',
      TECHNICIAN: 'Crear sus tickets y atender los asignados por categoría',
      CLIENT: 'Crear y seguir sus propios tickets de soporte',
    },
    inventory: {
      ADMIN: 'Gestionar activos de inventario de sus familias asignadas',
      TECHNICIAN: 'Ver y gestionar activos de sus familias como gestor',
      CLIENT: 'Ver sus equipos asignados y solicitar mantenimientos',
    },
    patrols: {
      ADMIN: 'Ver reportes y supervisar rondas de sus familias',
      TECHNICIAN: 'Supervisar rondas y ejecutar patrullas asignadas',
      CLIENT: 'Ejecutar rondas de seguridad asignadas como agente',
    },
    news: {
      ADMIN: 'Ver noticias y comunicados del sistema',
      TECHNICIAN: 'Ver noticias y comunicados del sistema',
      CLIENT: 'Ver noticias y comunicados del sistema',
    },
    forms: {
      ADMIN: 'Gestionar formularios y documentos del sistema',
      TECHNICIAN: 'Ver y descargar formularios disponibles',
      CLIENT: 'Ver y descargar formularios disponibles',
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
    patrols: '🛡️',
    news: '📰',
    forms: '📋',
    contracts: '📄',
    reports: '📊',
    knowledge: '📚',
    hr: '👥',
    crm: '🤝',
  }
  return emojis[moduleKey] ?? '🔧'
}

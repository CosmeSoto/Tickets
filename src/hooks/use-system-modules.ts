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
    name: 'Noticias',
    description: 'Gestión de noticias y comunicados internos',
    icon: 'Newspaper',
    isActive: true,
    order: 4,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: false,
    familyScoped: true,
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
    familyScoped: true,
  },
  {
    key: 'credentials',
    name: 'Credenciales',
    description: 'Bóveda de credenciales por área',
    icon: 'KeyRound',
    isActive: true,
    order: 6,
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
      ADMIN: 'Gestiona en su familia nativa; ve y apoya en áreas adicionales',
      TECHNICIAN: 'Atiende tickets en su familia nativa; puede solicitar en otras áreas',
      CLIENT: 'Crear y seguir tickets en su área y áreas de servicio adicionales',
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
      ADMIN: 'Crear y publicar en áreas de contenido (compartidas con Documentos)',
      TECHNICIAN: 'Ver · con permiso de crear publica en áreas de contenido asignadas',
      CLIENT: 'Ver · con permiso de crear publica en su nativa + áreas de contenido',
    },
    forms: {
      ADMIN: 'Gestionar documentos en áreas de contenido (compartidas con Noticias)',
      TECHNICIAN: 'Ver · con permiso de crear publica en áreas de contenido asignadas',
      CLIENT: 'Ver · con permiso de crear publica en su nativa + áreas de contenido',
    },
    credentials: {
      ADMIN: 'Gestionar credenciales de sus áreas asignadas',
      TECHNICIAN: 'Ver y revelar credenciales · gestionar con permiso de gestor',
      CLIENT: 'Ver y revelar credenciales de sus áreas asignadas',
    },
  }
  return descriptions[moduleKey]?.[role] ?? 'Acceso al módulo'
}

/** Texto breve bajo el selector de familias adicionales (sin saturar la UI). */
export function getAdditionalFamilyHint(moduleKey: string, role: string): string | null {
  const hints: Record<string, Record<string, string>> = {
    tickets: {
      ADMIN: 'Visibilidad y apoyo. La gestión plena es en la familia nativa.',
      TECHNICIAN: 'Solo para solicitar soporte. Atiende tickets en su familia nativa.',
      CLIENT: 'Áreas donde puede solicitar servicios de soporte.',
    },
    patrols: {
      ADMIN: 'Instalaciones adicionales que puede supervisar.',
      TECHNICIAN: 'Instalaciones adicionales donde puede patrullar o supervisar.',
      CLIENT: 'Instalaciones adicionales asignadas como agente.',
    },
    inventory: {
      ADMIN: 'Áreas adicionales de gestión de activos (según permiso).',
      TECHNICIAN: 'Áreas donde puede solicitar o gestionar activos.',
      CLIENT: 'Áreas donde puede solicitar equipos o mantenimientos.',
    },
    news: {
      ADMIN: 'Áreas de contenido (mismas que Documentos).',
      TECHNICIAN: 'Áreas de contenido donde puede publicar (mismas que Documentos).',
      CLIENT: 'Áreas de contenido donde puede publicar (mismas que Documentos).',
    },
    forms: {
      ADMIN: 'Áreas de contenido (mismas que Noticias).',
      TECHNICIAN: 'Áreas de contenido donde puede publicar (mismas que Noticias).',
      CLIENT: 'Áreas de contenido donde puede publicar (mismas que Noticias).',
    },
    credentials: {
      ADMIN: 'Áreas adicionales de visibilidad de credenciales.',
      TECHNICIAN: 'Áreas donde puede ver o gestionar credenciales.',
      CLIENT: 'Áreas donde puede consultar credenciales.',
    },
  }
  return hints[moduleKey]?.[role] ?? null
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
    credentials: '🔐',
    contracts: '📄',
    reports: '📊',
    knowledge: '📚',
    hr: '👥',
    crm: '🤝',
  }
  return emojis[moduleKey] ?? '🔧'
}

'use client'

/**
 * Construye la navegación filtrada según rol, módulos activos y permisos.
 */

import { FileText } from 'lucide-react'
import { navigationByRole } from '@/components/layout/dashboard-nav-config'
import type { DashboardNavItem } from '@/components/layout/dashboard-nav-types'

export type RoleNavigationInput = {
  userRole: string
  isSuperAdmin: boolean
  canManageInventory: boolean
  canManageNews: boolean
  canManageForms: boolean
  hasTickets: boolean
  hasInventory: boolean
  hasPatrols: boolean
  hasNews: boolean
  hasForms: boolean
  hasCredentials: boolean
  canRequestAssets: boolean
  /** Tickets + canAccessKnowledge (Super Admin = true) */
  hasKnowledge: boolean
}

function isKnowledgeNavChild(child: { name: string; href: string }): boolean {
  return (
    child.name === 'Base de Conocimientos' ||
    child.href === '/knowledge' ||
    child.href === '/admin/knowledge' ||
    child.href === '/technician/knowledge' ||
    child.href.endsWith('/knowledge')
  )
}

function filterKnowledgeChildren(
  items: DashboardNavItem[],
  hasKnowledge: boolean
): DashboardNavItem[] {
  if (hasKnowledge) return items
  return items.map(item => {
    if (!item.children?.length) return item
    return {
      ...item,
      children: item.children.filter(c => !isKnowledgeNavChild(c)),
    }
  })
}

export function buildRoleNavigation({
  userRole,
  isSuperAdmin,
  canManageInventory,
  canManageNews,
  canManageForms,
  hasTickets,
  hasInventory,
  hasPatrols,
  hasNews,
  hasForms,
  hasCredentials,
  canRequestAssets,
  hasKnowledge,
}: RoleNavigationInput): DashboardNavItem[] {
  const navKey =
    userRole === 'TECHNICIAN' && canManageInventory
      ? 'TECHNICIAN_MANAGER'
      : userRole === 'CLIENT' && canManageInventory
        ? 'CLIENT_MANAGER'
        : userRole

  if (userRole === 'ADMIN') {
    const adminNav = navigationByRole['ADMIN'].filter(item => {
      if (item.href === '/admin/audit') return isSuperAdmin
      if (isSuperAdmin) return true
      if (item.href === '/admin/tickets' || item.name === 'Tickets') return hasTickets
      if (item.href === '/inventory' || item.name === 'Inventario') return hasInventory
      if (item.href === '/admin/patrols' || item.name === 'Rondas') return hasPatrols
      if (item.href === '/admin/news' || item.name === 'Noticias') return hasNews
      if (item.href === '/admin/forms' || item.name === 'Documentos') return hasForms
      if (item.href === '/credentials' || item.name === 'Credenciales') return hasCredentials
      return true
    })
    return filterKnowledgeChildren(adminNav, isSuperAdmin || hasKnowledge)
  }

  let navigation = (navigationByRole[navKey] || []).filter(item => {
    if (item.href === '/technician/tickets' || item.href === '/client/tickets') {
      return hasTickets
    }
    if (item.href === '/inventory') {
      return hasInventory || canRequestAssets
    }
    if (
      item.href === '/admin/patrols' ||
      item.href === '/patrol' ||
      item.name === 'Rondas' ||
      item.name === 'Mis Rondas'
    ) {
      return hasPatrols
    }
    if (item.href === '/admin/news' || item.name === 'Noticias') {
      if (userRole === 'CLIENT' || userRole === 'TECHNICIAN') {
        return hasNews && canManageNews
      }
      return hasNews
    }
    if (item.href === '/forms' || item.href === '/admin/forms' || item.name === 'Documentos') {
      return hasForms
    }
    if (item.href === '/credentials' || item.name === 'Credenciales') {
      return hasCredentials
    }
    return true
  })

  // Gestores de formularios: consola admin; resto: biblioteca de lectura
  navigation = navigation.map(item => {
    if (item.name !== 'Documentos' && item.href !== '/forms' && item.href !== '/admin/forms') {
      return item
    }
    return {
      ...item,
      href: canManageForms ? '/admin/forms' : '/forms',
    }
  })

  const assetRequestParents: Record<string, string> = {
    CLIENT: 'Mis Equipos',
    TECHNICIAN: 'Mis Equipos',
    CLIENT_MANAGER: 'Inventario',
    TECHNICIAN_MANAGER: 'Inventario',
  }
  const assetParentName = assetRequestParents[navKey]
  if (assetParentName && canRequestAssets) {
    navigation = navigation.map(item => {
      if (item.name !== assetParentName || !item.children) return item
      if (item.children.some(c => c.href === '/inventory/asset-requests')) return item
      const newChildren = [...item.children]
      const insertIndex = newChildren.findIndex(child => child.name === 'Mantenimientos')
      const position = insertIndex >= 0 ? insertIndex : newChildren.length
      newChildren.splice(position, 0, {
        name: 'Solicitudes de Compras',
        href: '/inventory/asset-requests',
        icon: FileText,
      })
      return { ...item, children: newChildren }
    })
  }

  return filterKnowledgeChildren(navigation, hasKnowledge)
}

export function roleHomeHref(userRole: string): string {
  const role = userRole.toLowerCase() === 'technician_manager' ? 'technician' : userRole.toLowerCase()
  return `/${role}`
}

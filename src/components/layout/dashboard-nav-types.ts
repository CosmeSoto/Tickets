import type { LucideIcon } from 'lucide-react'

export type DashboardNavItem = {
  name: string
  href: string
  icon: LucideIcon
  children?: DashboardNavItem[]
}

export const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

/** Ancho del rail colapsado (más cómodo que w-16) */
export const SIDEBAR_RAIL_WIDTH = 'lg:w-20'
export const SIDEBAR_RAIL_PAD = 'lg:pl-20'

/** Mapa de submenús abiertos (sessionStorage) — sobrevive remounts raros sin recargar la página */
export const SIDEBAR_OPEN_MENUS_KEY = 'sidebar-open-menus'

export const NAV_EASE = [0.25, 0.1, 0.25, 1] as const

export function readOpenMenus(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(SIDEBAR_OPEN_MENUS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function writeOpenMenu(href: string, open: boolean) {
  if (typeof window === 'undefined') return
  try {
    const map = readOpenMenus()
    if (open) map[href] = true
    else delete map[href]
    sessionStorage.setItem(SIDEBAR_OPEN_MENUS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

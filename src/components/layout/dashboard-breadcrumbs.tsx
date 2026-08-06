'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type NavNode = {
  name: string
  href: string
  children?: NavNode[]
}

function itemMatchesPath(href: string, pathname: string, hasChildren: boolean): boolean {
  if (hasChildren) {
    return pathname === href || pathname.startsWith(href + '/')
  }
  const segments = href.split('/').filter(Boolean).length
  if (segments <= 1) return pathname === href
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Recorre la nav jerárquica y devuelve el trail más profundo que coincide con la ruta.
 * Usa hijos completos (sin filtrar el child redundante del sidebar) para poder
 * resolver p. ej. Inventario → Activos en `/inventory`.
 */
export function findNavTrail(items: NavNode[], pathname: string): NavNode[] | null {
  for (const item of items) {
    const children = item.children
    const hasChildren = !!(children && children.length > 0)

    if (hasChildren) {
      const childTrail = findNavTrail(children!, pathname)
      if (childTrail) return [item, ...childTrail]
    }

    if (itemMatchesPath(item.href, pathname, hasChildren)) {
      return [item]
    }
  }
  return null
}

export function buildDashboardBreadcrumbs({
  pathname,
  navigation,
  homeHref,
  fallbackTitle,
}: {
  pathname: string | null
  navigation: NavNode[]
  homeHref: string
  fallbackTitle?: string
}): BreadcrumbItem[] {
  if (!pathname) {
    return fallbackTitle ? [{ label: fallbackTitle }] : []
  }

  const trail = findNavTrail(navigation, pathname)
  const crumbs: BreadcrumbItem[] = []

  const homeInTrail = trail?.[0]?.href === homeHref
  if (!homeInTrail && pathname !== homeHref) {
    crumbs.push({ label: 'Inicio', href: homeHref })
  }

  if (trail && trail.length > 0) {
    trail.forEach((node, index) => {
      const isLast = index === trail.length - 1
      crumbs.push({
        label: node.name,
        href: isLast ? undefined : node.href,
      })
    })
  } else if (fallbackTitle) {
    crumbs.push({ label: fallbackTitle })
  }

  return crumbs
}

interface DashboardBreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Breadcrumbs compactos para el header del dashboard (patrón estilo 21st / shadcn).
 */
export function DashboardBreadcrumbs({ items, className }: DashboardBreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label='Breadcrumb'
      className={cn('flex items-center gap-1 text-xs text-muted-foreground min-w-0', className)}
    >
      <ol className='flex items-center gap-1 min-w-0 flex-wrap'>
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          const isHome = index === 0 && item.label === 'Inicio'

          return (
            <li key={`${item.label}-${index}`} className='flex items-center gap-1 min-w-0'>
              {index > 0 && (
                <ChevronRight
                  className='h-3 w-3 flex-shrink-0 text-muted-foreground/50'
                  aria-hidden
                />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className='inline-flex items-center gap-1 truncate hover:text-foreground transition-colors'
                >
                  {isHome && <Home className='h-3 w-3 flex-shrink-0' aria-hidden />}
                  <span className='truncate'>{item.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 truncate',
                    isLast ? 'text-foreground/80 font-medium' : undefined
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {isHome && <Home className='h-3 w-3 flex-shrink-0' aria-hidden />}
                  <span className='truncate'>{item.label}</span>
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

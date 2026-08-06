/**
 * Utilidades para determinar el item activo del sidebar.
 * Evita que hubs como `/admin/settings` se marquen activos
 * cuando la ruta real es una config de módulo (`/admin/settings/tickets`, etc.).
 */

type NavNode = {
  href: string
  children?: NavNode[]
}

/** Recolecta hrefs de hojas (items sin hijos) de la nav. */
export function collectLeafHrefs(items: NavNode[]): string[] {
  const hrefs: string[] = []
  for (const item of items) {
    if (item.children && item.children.length > 0) {
      hrefs.push(...collectLeafHrefs(item.children))
    } else {
      hrefs.push(item.href)
    }
  }
  return hrefs
}

/**
 * ¿La hoja `href` debe considerarse activa para `pathname`?
 * - Match exacto → sí
 * - Raíz de grupo (1 segmento, ej. `/inventory`) → solo exacto
 * - Prefijo (`startsWith`) → sí, salvo que otra hoja más específica también coincida
 */
export function isLeafNavActive(
  href: string,
  pathname: string | null | undefined,
  allLeafHrefs: string[] = []
): boolean {
  if (!pathname) return false
  if (pathname === href) return true

  const segments = href.split('/').filter(Boolean).length
  if (segments <= 1) return false

  if (!pathname.startsWith(href + '/')) return false

  const hasMoreSpecificMatch = allLeafHrefs.some(other => {
    if (other === href) return false
    if (other.length <= href.length) return false
    return pathname === other || pathname.startsWith(other + '/')
  })

  return !hasMoreSpecificMatch
}

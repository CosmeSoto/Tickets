import { buildDashboardBreadcrumbs, findNavTrail } from '@/components/layout/dashboard-breadcrumbs'

const nav = [
  { name: 'Dashboard', href: '/admin' },
  {
    name: 'Tickets',
    href: '/admin/tickets',
    children: [
      { name: 'Todos los Tickets', href: '/admin/tickets' },
      { name: 'Reportes', href: '/admin/reports' },
      { name: 'Categorías', href: '/admin/categories' },
    ],
  },
  {
    name: 'Inventario',
    href: '/inventory',
    children: [
      { name: 'Activos', href: '/inventory' },
      { name: 'Mantenimientos', href: '/inventory/maintenance' },
    ],
  },
]

describe('findNavTrail', () => {
  it('resuelve el trail anidado más profundo', () => {
    const trail = findNavTrail(nav, '/admin/reports')
    expect(trail?.map(n => n.name)).toEqual(['Tickets', 'Reportes'])
  })

  it('usa match exacto en raíces de grupo (/inventory)', () => {
    const trail = findNavTrail(nav, '/inventory')
    expect(trail?.map(n => n.name)).toEqual(['Inventario', 'Activos'])
  })

  it('no marca Activos activo en /inventory/maintenance', () => {
    const trail = findNavTrail(nav, '/inventory/maintenance')
    expect(trail?.map(n => n.name)).toEqual(['Inventario', 'Mantenimientos'])
  })
})

describe('buildDashboardBreadcrumbs', () => {
  it('antepone Inicio cuando la ruta no es home', () => {
    const crumbs = buildDashboardBreadcrumbs({
      pathname: '/admin/reports',
      navigation: nav,
      homeHref: '/admin',
    })
    expect(crumbs.map(c => c.label)).toEqual(['Inicio', 'Tickets', 'Reportes'])
    expect(crumbs[0].href).toBe('/admin')
    expect(crumbs[crumbs.length - 1].href).toBeUndefined()
  })

  it('usa fallbackTitle si no hay match en nav', () => {
    const crumbs = buildDashboardBreadcrumbs({
      pathname: '/profile',
      navigation: nav,
      homeHref: '/admin',
      fallbackTitle: 'Mi Perfil',
    })
    expect(crumbs.map(c => c.label)).toEqual(['Inicio', 'Mi Perfil'])
  })
})

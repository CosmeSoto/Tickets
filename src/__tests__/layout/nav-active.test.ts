import { collectLeafHrefs, isLeafNavActive } from '@/components/layout/nav-active'

const nav = [
  { name: 'Dashboard', href: '/admin' },
  {
    name: 'Tickets',
    href: '/admin/tickets',
    children: [
      { name: 'Todos los Tickets', href: '/admin/tickets' },
      { name: 'Configuración', href: '/admin/settings/tickets' },
    ],
  },
  {
    name: 'Inventario',
    href: '/inventory',
    children: [
      { name: 'Activos', href: '/inventory' },
      { name: 'Configuración', href: '/admin/settings/inventory' },
    ],
  },
  {
    name: 'Rondas',
    href: '/admin/patrols',
    children: [{ name: 'Configuración', href: '/admin/settings/patrols' }],
  },
  { name: 'Configuración Sistema', href: '/admin/settings' },
]

const leafHrefs = collectLeafHrefs(nav)

describe('isLeafNavActive — configs de módulo vs sistema', () => {
  it('no marca Configuración Sistema en /admin/settings/tickets', () => {
    expect(isLeafNavActive('/admin/settings', '/admin/settings/tickets', leafHrefs)).toBe(false)
    expect(isLeafNavActive('/admin/settings/tickets', '/admin/settings/tickets', leafHrefs)).toBe(
      true
    )
  })

  it('no marca Configuración Sistema en /admin/settings/inventory', () => {
    expect(isLeafNavActive('/admin/settings', '/admin/settings/inventory', leafHrefs)).toBe(false)
    expect(
      isLeafNavActive('/admin/settings/inventory', '/admin/settings/inventory', leafHrefs)
    ).toBe(true)
  })

  it('no marca Configuración Sistema en /admin/settings/patrols', () => {
    expect(isLeafNavActive('/admin/settings', '/admin/settings/patrols', leafHrefs)).toBe(false)
    expect(isLeafNavActive('/admin/settings/patrols', '/admin/settings/patrols', leafHrefs)).toBe(
      true
    )
  })

  it('sí marca Configuración Sistema en /admin/settings exacto', () => {
    expect(isLeafNavActive('/admin/settings', '/admin/settings', leafHrefs)).toBe(true)
  })

  it('mantiene activo el listado en rutas de detalle (/admin/tickets/abc)', () => {
    expect(isLeafNavActive('/admin/tickets', '/admin/tickets/abc-123', leafHrefs)).toBe(true)
  })

  it('raíz de grupo /inventory solo con match exacto', () => {
    expect(isLeafNavActive('/inventory', '/inventory', leafHrefs)).toBe(true)
    expect(isLeafNavActive('/inventory', '/inventory/maintenance', leafHrefs)).toBe(false)
  })
})

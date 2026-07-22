/**
 * Mapa canónico departamento → familia (organigrama PSF — fuente de verdad).
 *
 * Familias (5):
 * 1. Administración — incluye TI/Comunicaciones
 * 2. Comercial
 * 3. Marketing
 * 4. Arquitectura
 * 5. Operaciones
 */

import type { OrganigramFamilyCode } from './family-map'

export type DepartmentSeedDef = {
  name: string
  description: string
  color: string
  order: number
  familyCode: OrganigramFamilyCode
}

/** Departamentos oficiales (exactamente el organigrama acordado) */
export const DEPARTMENT_SEEDS: DepartmentSeedDef[] = [
  // ── 1. ADMINISTRACIÓN ───────────────────────────────────────────────────
  {
    name: 'Administración',
    description: 'Dirección y gestión administrativa',
    color: '#3B82F6',
    order: 1,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Financiero',
    description: 'Gestión financiera',
    color: '#0EA5E9',
    order: 2,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Contabilidad',
    description: 'Contabilidad general',
    color: '#EF4444',
    order: 3,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Compras',
    description: 'Compras y adquisiciones',
    color: '#06B6D4',
    order: 4,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Recursos Humanos',
    description: 'Talento humano y servicios internos',
    color: '#8B5CF6',
    order: 5,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Mensajería',
    description: 'Mensajería y correspondencia interna',
    color: '#A855F7',
    order: 6,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Tecnologías de la Información',
    description: 'Coordinación TI, infraestructura y sistemas',
    color: '#10B981',
    order: 7,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Soporte Técnico',
    description: 'Soporte, mesa de ayuda y analistas TI',
    color: '#F59E0B',
    order: 8,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Seguridad Informática',
    description: 'Seguridad de la información',
    color: '#DC2626',
    order: 9,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Usuarios y Privilegios',
    description: 'Gestión de usuarios y accesos',
    color: '#6366F1',
    order: 10,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Telefonía',
    description: 'Telefonía y comunicaciones',
    color: '#0EA5E9',
    order: 11,
    familyCode: 'ADMINISTRATIVE',
  },
  // ── 2. COMERCIAL ────────────────────────────────────────────────────────
  {
    name: 'Comercial',
    description: 'Dirección comercial y ventas',
    color: '#F97316',
    order: 12,
    familyCode: 'COMMERCIAL',
  },
  // ── 3. MARKETING ────────────────────────────────────────────────────────
  {
    name: 'Marketing',
    description: 'Marketing general y producción',
    color: '#EC4899',
    order: 13,
    familyCode: 'MARKETING',
  },
  {
    name: 'Medios Digitales',
    description: 'Community manager, pauta y web',
    color: '#DB2777',
    order: 14,
    familyCode: 'MARKETING',
  },
  {
    name: 'Diseño',
    description: 'Diseño gráfico y visual',
    color: '#BE185D',
    order: 15,
    familyCode: 'MARKETING',
  },
  {
    name: 'Eventos',
    description: 'Producción y coordinación de eventos',
    color: '#F472B6',
    order: 16,
    familyCode: 'MARKETING',
  },
  {
    name: 'Servicio al Cliente',
    description: 'Atención al cliente, información y punto de canje',
    color: '#E879F9',
    order: 17,
    familyCode: 'MARKETING',
  },
  // ── 4. ARQUITECTURA ─────────────────────────────────────────────────────
  {
    name: 'Arquitectura',
    description: 'Dirección de arquitectura y diseño de espacios',
    color: '#6366F1',
    order: 18,
    familyCode: 'ARCHITECTURE',
  },
  // ── 5. OPERACIONES ──────────────────────────────────────────────────────
  {
    name: 'Parqueaderos',
    description: 'Operación y supervisión de parqueaderos',
    color: '#0D9488',
    order: 19,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Seguridad Física',
    description: 'Supervisión y agentes de seguridad',
    color: '#EF4444',
    order: 20,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'CCTV y Control de Accesos',
    description: 'Cámaras, control de acceso y alarmas',
    color: '#DC2626',
    order: 21,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Mantenimiento',
    description: 'Mantenimiento general (civil, eléctrico y mecánico)',
    color: '#059669',
    order: 22,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Seguridad y Salud Ocupacional',
    description: 'SSO, salud ocupacional y bienestar',
    color: '#14B8A6',
    order: 23,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Áreas Verdes',
    description: 'Jardinería y mantenimiento de áreas verdes',
    color: '#22C55E',
    order: 24,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Limpieza',
    description: 'Limpieza general de instalaciones',
    color: '#06B6D4',
    order: 25,
    familyCode: 'OPERATIONS',
  },
]

/**
 * Alias legacy → nombre canónico.
 * Clave: nombre exacto en BD; valor: nombre en DEPARTMENT_SEEDS.
 */
export const DEPARTMENT_NAME_ALIASES: Record<string, string> = {
  // Parqueaderos / arquitectura
  PARQUEADEROS: 'Parqueaderos',
  parqueaderos: 'Parqueaderos',
  PARQUEADERO: 'Parqueaderos',
  ARQUITECTURA: 'Arquitectura',
  // CCTV
  'CCTV y Control de Acceso': 'CCTV y Control de Accesos',
  'CCTV y Control de Accesos': 'CCTV y Control de Accesos',
  // Mantenimiento consolidado
  'Mantenimiento Civil': 'Mantenimiento',
  'Mantenimiento civil': 'Mantenimiento',
  'Mantenimiento Eléctrico': 'Mantenimiento',
  'Mantenimiento eléctrico': 'Mantenimiento',
  'Mantenimiento Mecánico': 'Mantenimiento',
  'Mantenimiento mecánico': 'Mantenimiento',
  'Mantenimiento mecanico': 'Mantenimiento',
  // Áreas verdes / SSO / seguridad
  'Areas Verdes': 'Áreas Verdes',
  'Áreas verdes': 'Áreas Verdes',
  'Seguridad fisica': 'Seguridad Física',
  'Seguridad física': 'Seguridad Física',
  'Seguridad y Salud Ocupacional SSO': 'Seguridad y Salud Ocupacional',
  SSO: 'Seguridad y Salud Ocupacional',
  // TI / admin
  'Tecnologías de la información': 'Tecnologías de la Información',
  'Seguridad Informatica': 'Seguridad Informática',
  'Servicio al cliente': 'Servicio al Cliente',
  contabilidad: 'Contabilidad',
  Contabilidad: 'Contabilidad',
  // Mensajería (departamento propio bajo Administración)
  Mensajeria: 'Mensajería',
  MENSAJERIA: 'Mensajería',
}

/** Familia por nombre exacto (incluye canónicos + alias) */
export function resolveDepartmentFamilyCode(deptName: string): OrganigramFamilyCode | null {
  const canonical = DEPARTMENT_NAME_ALIASES[deptName] ?? deptName
  const seed = DEPARTMENT_SEEDS.find(d => d.name === canonical)
  if (seed) return seed.familyCode

  const n = deptName.toLowerCase()
  if (n.includes('parqueadero')) return 'OPERATIONS'
  if (
    n.includes('mantenimiento') ||
    n.includes('limpieza') ||
    n.includes('seguridad física') ||
    n.includes('seguridad fisica') ||
    n.includes('cctv') ||
    n.includes('áreas verdes') ||
    n.includes('areas verdes') ||
    n.includes('sso') ||
    n.includes('salud ocupacional')
  )
    return 'OPERATIONS'
  if (n.includes('arquitect')) return 'ARCHITECTURE'
  if (
    n.includes('marketing') ||
    n.includes('diseño') ||
    n.includes('medios') ||
    n.includes('evento') ||
    n.includes('servicio al cliente')
  )
    return 'MARKETING'
  if (n.includes('comercial')) return 'COMMERCIAL'
  // TI y admin viven en ADMINISTRATIVE
  if (
    n.includes('tecnolog') ||
    n.includes('soporte') ||
    n.includes('telefon') ||
    n.includes('informát') ||
    n.includes('privilegio') ||
    n.includes('administ') ||
    n.includes('contab') ||
    n.includes('financ') ||
    n.includes('compra') ||
    n.includes('rrhh') ||
    n.includes('recursos humanos') ||
    n.includes('mensajer')
  )
    return 'ADMINISTRATIVE'

  return null
}

/**
 * Mapa canónico departamento → familia (organigrama PSF).
 * Usado por seed y ensure-departments.
 */

import type { OrganigramFamilyCode } from './family-map'

export type DepartmentSeedDef = {
  name: string
  description: string
  color: string
  order: number
  familyCode: OrganigramFamilyCode
}

/** Departamentos oficiales del organigrama */
export const DEPARTMENT_SEEDS: DepartmentSeedDef[] = [
  // ── GESTIÓN ADMINISTRATIVA ──────────────────────────────────────────────
  {
    name: 'Administración',
    description: 'Dirección financiera y administrativa',
    color: '#3B82F6',
    order: 1,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Contabilidad',
    description: 'Contabilidad general y finanzas',
    color: '#EF4444',
    order: 2,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Compras',
    description: 'Compras y adquisiciones',
    color: '#06B6D4',
    order: 3,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Recursos Humanos',
    description: 'Talento humano, recepción y servicios internos',
    color: '#8B5CF6',
    order: 4,
    familyCode: 'ADMINISTRATIVE',
  },
  {
    name: 'Mensajería',
    description: 'Mensajería y correspondencia interna',
    color: '#A855F7',
    order: 5,
    familyCode: 'ADMINISTRATIVE',
  },
  // ── COMERCIAL ───────────────────────────────────────────────────────────
  {
    name: 'Comercial',
    description: 'Dirección comercial y ventas',
    color: '#F97316',
    order: 6,
    familyCode: 'COMMERCIAL',
  },
  // ── MARKETING ───────────────────────────────────────────────────────────
  {
    name: 'Marketing',
    description: 'Marketing general, producción y eventos',
    color: '#EC4899',
    order: 7,
    familyCode: 'MARKETING',
  },
  {
    name: 'Medios Digitales',
    description: 'Community manager, pauta y web',
    color: '#DB2777',
    order: 8,
    familyCode: 'MARKETING',
  },
  {
    name: 'Diseño',
    description: 'Diseño gráfico y visual',
    color: '#BE185D',
    order: 9,
    familyCode: 'MARKETING',
  },
  {
    name: 'Servicio al Cliente',
    description: 'Atención al cliente, información y punto de canje',
    color: '#E879F9',
    order: 10,
    familyCode: 'MARKETING',
  },
  // ── ARQUITECTURA ────────────────────────────────────────────────────────
  {
    name: 'Arquitectura',
    description: 'Dirección de arquitectura y diseño de espacios',
    color: '#6366F1',
    order: 11,
    familyCode: 'ARCHITECTURE',
  },
  // ── OPERACIONES ─────────────────────────────────────────────────────────
  {
    name: 'Parqueaderos',
    description: 'Operación y supervisión de parqueaderos',
    color: '#0D9488',
    order: 12,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Seguridad Física',
    description: 'Supervisión y agentes de seguridad',
    color: '#EF4444',
    order: 13,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'CCTV y Control de Acceso',
    description: 'Cámaras, control de acceso y alarmas',
    color: '#DC2626',
    order: 14,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Mantenimiento Civil',
    description: 'Mantenimiento civil e infraestructura',
    color: '#10B981',
    order: 15,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Mantenimiento Eléctrico',
    description: 'Instalaciones eléctricas',
    color: '#F59E0B',
    order: 16,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Mantenimiento Mecánico',
    description: 'Equipos mecánicos e hidráulicos',
    color: '#84CC16',
    order: 17,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Limpieza',
    description: 'Limpieza general de instalaciones',
    color: '#06B6D4',
    order: 18,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Áreas Verdes',
    description: 'Jardinería y mantenimiento de áreas verdes',
    color: '#22C55E',
    order: 19,
    familyCode: 'OPERATIONS',
  },
  {
    name: 'Seguridad y Salud Ocupacional',
    description: 'SSO, salud ocupacional y bienestar',
    color: '#14B8A6',
    order: 20,
    familyCode: 'OPERATIONS',
  },
  /** Área de supervisión de mantenimiento (organigrama: Supervisor de Mantenimiento) */
  {
    name: 'Mantenimiento',
    description: 'Supervisión general de mantenimiento',
    color: '#059669',
    order: 21,
    familyCode: 'OPERATIONS',
  },
  // ── TECNOLOGÍA Y COMUNICACIONES ─────────────────────────────────────────
  {
    name: 'Tecnologías de la Información',
    description: 'Coordinación TI, infraestructura y sistemas',
    color: '#10B981',
    order: 22,
    familyCode: 'TECHNOLOGY',
  },
  {
    name: 'Soporte Técnico',
    description: 'Soporte, mesa de ayuda y analistas TI',
    color: '#F59E0B',
    order: 23,
    familyCode: 'TECHNOLOGY',
  },
  {
    name: 'Seguridad Informática',
    description: 'Seguridad de la información',
    color: '#DC2626',
    order: 24,
    familyCode: 'TECHNOLOGY',
  },
  {
    name: 'Usuarios y Privilegios',
    description: 'Gestión de usuarios y accesos',
    color: '#6366F1',
    order: 25,
    familyCode: 'TECHNOLOGY',
  },
  {
    name: 'Telefonía',
    description: 'Telefonía y comunicaciones',
    color: '#0EA5E9',
    order: 26,
    familyCode: 'TECHNOLOGY',
  },
]

/**
 * Alias legacy → nombre canónico (para renombrar/fusionar huérfanos).
 * Clave: nombre exacto en BD; valor: nombre canónico en DEPARTMENT_SEEDS.
 */
export const DEPARTMENT_NAME_ALIASES: Record<string, string> = {
  PARQUEADEROS: 'Parqueaderos',
  parqueaderos: 'Parqueaderos',
  PARQUEADERO: 'Parqueaderos',
  Arquitectura: 'Arquitectura',
  ARQUITECTURA: 'Arquitectura',
  'Mantenimiento civil': 'Mantenimiento Civil',
  'Mantenimiento eléctrico': 'Mantenimiento Eléctrico',
  'Mantenimiento mecanico': 'Mantenimiento Mecánico',
  'Mantenimiento mecánico': 'Mantenimiento Mecánico',
  'Seguridad fisica': 'Seguridad Física',
  'Seguridad física': 'Seguridad Física',
}

/** Familia por nombre exacto (incluye canónicos + alias no renombrables aún) */
export function resolveDepartmentFamilyCode(deptName: string): OrganigramFamilyCode | null {
  const canonical = DEPARTMENT_NAME_ALIASES[deptName] ?? deptName
  const seed = DEPARTMENT_SEEDS.find(d => d.name === canonical)
  if (seed) return seed.familyCode

  // Heurística por palabras clave (solo fallback)
  const n = deptName.toLowerCase()
  if (n.includes('parqueadero')) return 'OPERATIONS'
  if (n.includes('mantenimiento') || n.includes('limpieza') || n.includes('seguridad física'))
    return 'OPERATIONS'
  if (
    n.includes('cctv') ||
    n.includes('áreas verdes') ||
    n.includes('areas verdes') ||
    n.includes('sso')
  )
    return 'OPERATIONS'
  if (n.includes('arquitect')) return 'ARCHITECTURE'
  if (n.includes('marketing') || n.includes('diseño') || n.includes('medios')) return 'MARKETING'
  if (n.includes('comercial')) return 'COMMERCIAL'
  if (
    n.includes('tecnolog') ||
    n.includes('soporte') ||
    n.includes('telefon') ||
    n.includes('informát')
  )
    return 'TECHNOLOGY'
  if (
    n.includes('administ') ||
    n.includes('contab') ||
    n.includes('compra') ||
    n.includes('rrhh') ||
    n.includes('recursos humanos') ||
    n.includes('mensajer')
  )
    return 'ADMINISTRATIVE'

  return null
}

/**
 * Familias del organigrama PSF (5 áreas).
 * TI / Comunicaciones vive dentro de Administración (no hay familia TECHNOLOGY).
 */
export const ORGANIGRAM_FAMILIES = [
  {
    code: 'ADMINISTRATIVE',
    name: 'Administración',
    icon: 'Briefcase',
    color: '#6B7280',
    order: 1,
  },
  {
    code: 'COMMERCIAL',
    name: 'Comercial',
    icon: 'TrendingUp',
    color: '#F97316',
    order: 2,
  },
  {
    code: 'MARKETING',
    name: 'Marketing',
    icon: 'Megaphone',
    color: '#EC4899',
    order: 3,
  },
  {
    code: 'ARCHITECTURE',
    name: 'Arquitectura',
    icon: 'PenTool',
    color: '#6366F1',
    order: 4,
  },
  {
    code: 'OPERATIONS',
    name: 'Operaciones',
    icon: 'Building2',
    color: '#10B981',
    order: 5,
  },
] as const

export type OrganigramFamilyCode = (typeof ORGANIGRAM_FAMILIES)[number]['code']

/** Familia legacy absorbida por ADMINISTRATIVE (TI). */
export const LEGACY_TECHNOLOGY_FAMILY_CODE = 'TECHNOLOGY'

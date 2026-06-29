/**
 * Familias del organigrama PSF (6 áreas principales).
 */
export const ORGANIGRAM_FAMILIES = [
  {
    code: 'ADMINISTRATIVE',
    name: 'Gestión Administrativa',
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
  {
    code: 'TECHNOLOGY',
    name: 'Tecnología y Comunicaciones',
    icon: 'Monitor',
    color: '#3B82F6',
    order: 6,
  },
] as const

export type OrganigramFamilyCode = (typeof ORGANIGRAM_FAMILIES)[number]['code']

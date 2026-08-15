/**
 * Registry de módulos con acceso a áreas (familias).
 *
 * Extensible: para un módulo nuevo basta registrar aquí (y su card en Usuarios).
 * La columna `user_family_access.module` es String — no requiere migración de enum.
 *
 * Claves UI `news` / `forms` comparten el módulo de datos `content`.
 */

export type FamilyAccessCapability = {
  canConsume: boolean
  canOperate: boolean
  canView: boolean
}

export type FamilyAccessRole = 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

export type FamilyAccessModuleDefinition = {
  /** Clave persistida en user_family_access.module */
  key: string
  label: string
  description: string
  /** Defaults al asignar un área en la UI (por rol). */
  defaultsByRole: Record<FamilyAccessRole, FamilyAccessCapability>
}

/** Módulos built-in. Agregar aquí = listo para datos + API. */
export const FAMILY_ACCESS_MODULES: Record<string, FamilyAccessModuleDefinition> = {
  tickets: {
    key: 'tickets',
    label: 'Tickets',
    description: 'Áreas adicionales para solicitar / consumir tickets cross-área.',
    defaultsByRole: {
      ADMIN: { canConsume: true, canOperate: false, canView: false },
      TECHNICIAN: { canConsume: true, canOperate: false, canView: false },
      CLIENT: { canConsume: true, canOperate: false, canView: true },
    },
  },
  inventory: {
    key: 'inventory',
    label: 'Inventario',
    description: 'Áreas adicionales de gestión / visibilidad de inventario.',
    defaultsByRole: {
      ADMIN: { canConsume: false, canOperate: false, canView: true },
      TECHNICIAN: { canConsume: false, canOperate: true, canView: true },
      CLIENT: { canConsume: false, canOperate: true, canView: true },
    },
  },
  patrols: {
    key: 'patrols',
    label: 'Rondas',
    description: 'Áreas adicionales de operación / visibilidad de rondas.',
    defaultsByRole: {
      ADMIN: { canConsume: false, canOperate: false, canView: true },
      TECHNICIAN: { canConsume: false, canOperate: true, canView: true },
      CLIENT: { canConsume: false, canOperate: true, canView: true },
    },
  },
  content: {
    key: 'content',
    label: 'Documentos y Noticias',
    description: 'Áreas donde puede publicar / dirigir contenido (docs + noticias).',
    defaultsByRole: {
      ADMIN: { canConsume: false, canOperate: true, canView: true },
      TECHNICIAN: { canConsume: false, canOperate: true, canView: true },
      CLIENT: { canConsume: false, canOperate: true, canView: true },
    },
  },
  credentials: {
    key: 'credentials',
    label: 'Credenciales',
    description: 'Áreas adicionales de visibilidad / operación de credenciales.',
    defaultsByRole: {
      ADMIN: { canConsume: false, canOperate: false, canView: true },
      TECHNICIAN: { canConsume: false, canOperate: true, canView: true },
      CLIENT: { canConsume: false, canOperate: true, canView: true },
    },
  },
  processes: {
    key: 'processes',
    label: 'Procesos y procedimientos',
    description: 'Áreas adicionales para consultar o gestionar procesos internos.',
    defaultsByRole: {
      ADMIN: { canConsume: false, canOperate: true, canView: true },
      TECHNICIAN: { canConsume: false, canOperate: true, canView: true },
      CLIENT: { canConsume: false, canOperate: false, canView: true },
    },
  },
  access: {
    key: 'access',
    label: 'Accesos',
    description: 'Áreas donde puede verificar o gestionar pases QR de personal externo.',
    defaultsByRole: {
      ADMIN: { canConsume: false, canOperate: true, canView: true },
      TECHNICIAN: { canConsume: false, canOperate: false, canView: true },
      CLIENT: { canConsume: false, canOperate: false, canView: true },
    },
  },
}

export const BUILTIN_FAMILY_ACCESS_MODULE_KEYS = Object.keys(FAMILY_ACCESS_MODULES)

export function resolveFamilyAccessModuleKey(uiOrDataKey: string): string {
  if (uiOrDataKey === 'news' || uiOrDataKey === 'forms') return 'content'
  return uiOrDataKey
}

export function isKnownFamilyAccessModule(module: string): boolean {
  return module in FAMILY_ACCESS_MODULES
}

export function registerFamilyAccessModule(def: FamilyAccessModuleDefinition): void {
  FAMILY_ACCESS_MODULES[def.key] = def
}

export function getModuleDefaults(module: string, role: string): FamilyAccessCapability {
  const def = FAMILY_ACCESS_MODULES[module]
  const roleKey = (
    ['ADMIN', 'TECHNICIAN', 'CLIENT'].includes(role) ? role : 'CLIENT'
  ) as FamilyAccessRole

  if (def) return { ...def.defaultsByRole[roleKey] }
  return { canConsume: false, canOperate: true, canView: true }
}

export function listFamilyAccessModules(): FamilyAccessModuleDefinition[] {
  return Object.values(FAMILY_ACCESS_MODULES)
}

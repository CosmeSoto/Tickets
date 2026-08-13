import prisma from '@/lib/prisma'

export type MaintenanceModeConfig = {
  enabled: boolean
  message: string
  /** Si true, usuarios ADMIN/Super Admin pueden seguir usando el sistema */
  allowAdmins: boolean
}

const DEFAULT: MaintenanceModeConfig = {
  enabled: false,
  message:
    'El sistema está en mantenimiento programado. Vuelve a intentarlo más tarde o contacta al administrador.',
  allowAdmins: true,
}

export class MaintenanceModeService {
  private static cache: MaintenanceModeConfig | null = null
  private static cacheTime = 0
  private static CACHE_TTL = 60_000

  static async getConfig(): Promise<MaintenanceModeConfig> {
    const now = Date.now()
    if (this.cache && now - this.cacheTime < this.CACHE_TTL) {
      return this.cache
    }

    try {
      const rows = await prisma.system_settings.findMany({
        where: {
          key: { in: ['maintenanceMode', 'maintenanceMessage', 'maintenanceAllowAdmins'] },
        },
      })

      const map: Record<string, string> = {}
      rows.forEach(r => {
        map[r.key] = r.value
      })

      const config: MaintenanceModeConfig = {
        enabled: map.maintenanceMode === 'true',
        message: map.maintenanceMessage?.trim() || DEFAULT.message,
        allowAdmins: map.maintenanceAllowAdmins !== 'false',
      }

      this.cache = config
      this.cacheTime = now
      return config
    } catch (error) {
      console.error('[MAINTENANCE] Error leyendo configuración:', error)
      return DEFAULT
    }
  }

  static clearCache(): void {
    this.cache = null
    this.cacheTime = 0
  }

  /** Super Admin siempre puede acceder; admins si allowAdmins está activo */
  static canBypassMaintenance(user: {
    role?: string
    isSuperAdmin?: boolean
  } | null | undefined): boolean {
    if (!user) return false
    if (user.isSuperAdmin) return true
    if (user.role === 'ADMIN') return true
    return false
  }

  static async shouldBlockUser(user: {
    role?: string
    isSuperAdmin?: boolean
  } | null | undefined): Promise<{ block: boolean; config: MaintenanceModeConfig }> {
    const config = await this.getConfig()
    if (!config.enabled) return { block: false, config }

    if (config.allowAdmins && MaintenanceModeService.canBypassMaintenance(user)) {
      return { block: false, config }
    }

    if (user?.isSuperAdmin) return { block: false, config }

    return { block: true, config }
  }
}

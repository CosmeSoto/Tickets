/**
 * Servicio de Configuración de Seguridad
 * Obtiene y valida configuraciones de seguridad desde la base de datos
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface SecurityConfig {
  sessionTimeout: number // minutos
  maxLoginAttempts: number
  passwordMinLength: number
  requirePasswordChange: boolean
  passwordChangeIntervalDays: number // 0 = sin expiración automática
  maxFileSize: number // MB
  allowedFileTypes: string[]
}

export class SecurityConfigService {
  private static cache: SecurityConfig | null = null
  private static cacheTime: number = 0
  private static CACHE_TTL = 5 * 60 * 1000 // 5 minutos

  /**
   * Obtener configuración de seguridad desde la base de datos
   */
  static async getConfig(): Promise<SecurityConfig> {
    // Usar caché si está disponible y no ha expirado
    const now = Date.now()
    if (this.cache && now - this.cacheTime < this.CACHE_TTL) {
      return this.cache
    }

    try {
      // Obtener configuraciones desde la base de datos
      const configs = await prisma.system_settings.findMany({
        where: {
          key: {
            in: [
              'sessionTimeout',
              'maxLoginAttempts',
              'passwordMinLength',
              'requirePasswordChange',
              'passwordChangeIntervalDays',
              'maxFileSize',
              'allowedFileTypes',
            ],
          },
        },
      })

      // Convertir a objeto
      const configMap: Record<string, any> = {}
      configs.forEach(config => {
        if (config.key === 'allowedFileTypes') {
          configMap[config.key] = JSON.parse(config.value as string)
        } else if (config.key === 'requirePasswordChange') {
          configMap[config.key] = config.value === 'true'
        } else {
          configMap[config.key] = parseInt(config.value as string)
        }
      })

      // Valores por defecto si no existen en la BD
      const securityConfig: SecurityConfig = {
        sessionTimeout: configMap.sessionTimeout || 1440, // 24 horas
        maxLoginAttempts: configMap.maxLoginAttempts || 5,
        passwordMinLength: configMap.passwordMinLength || 8,
        requirePasswordChange: configMap.requirePasswordChange || false,
        passwordChangeIntervalDays: configMap.passwordChangeIntervalDays ?? 0,
        maxFileSize: configMap.maxFileSize || 10, // MB
        allowedFileTypes: configMap.allowedFileTypes || [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain',
        ],
      }

      // Actualizar caché
      this.cache = securityConfig
      this.cacheTime = now

      return securityConfig
    } catch (error) {
      console.error('[SECURITY CONFIG] Error obteniendo configuración:', error)

      // Retornar valores por defecto en caso de error
      return {
        sessionTimeout: 1440,
        maxLoginAttempts: 5,
        passwordMinLength: 8,
        requirePasswordChange: false,
        passwordChangeIntervalDays: 0,
        maxFileSize: 10,
        allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain'],
      }
    }
  }

  /**
   * Limpiar caché (útil después de actualizar configuración)
   */
  static clearCache(): void {
    this.cache = null
    this.cacheTime = 0
  }

  /**
   * Validar longitud de contraseña según configuración
   */
  static async validatePasswordLength(
    password: string
  ): Promise<{ valid: boolean; message?: string }> {
    const config = await this.getConfig()

    if (password.length < config.passwordMinLength) {
      return {
        valid: false,
        message: `La contraseña debe tener al menos ${config.passwordMinLength} caracteres`,
      }
    }

    return { valid: true }
  }

  /**
   * Validar tamaño de archivo según configuración
   */
  static async validateFileSize(
    fileSizeBytes: number
  ): Promise<{ valid: boolean; message?: string }> {
    const config = await this.getConfig()
    const maxSizeBytes = config.maxFileSize * 1024 * 1024 // Convertir MB a bytes

    if (fileSizeBytes > maxSizeBytes) {
      return {
        valid: false,
        message: `El archivo excede el tamaño máximo permitido de ${config.maxFileSize} MB`,
      }
    }

    return { valid: true }
  }

  /**
   * Validar tipo de archivo según configuración
   */
  static async validateFileType(mimeType: string): Promise<{ valid: boolean; message?: string }> {
    const config = await this.getConfig()

    if (!config.allowedFileTypes.includes(mimeType)) {
      return {
        valid: false,
        message: `Tipo de archivo no permitido. Tipos permitidos: ${config.allowedFileTypes.join(', ')}`,
      }
    }

    return { valid: true }
  }

  /**
   * Registrar intento de login fallido
   * Usa solo el email como clave (sin IP) para evitar problemas con Docker/proxies
   */
  static async recordFailedLogin(email: string, _ipAddress: string): Promise<void> {
    try {
      const config = await this.getConfig()
      const maxAttempts = config.maxLoginAttempts || 5
      const key = `failed_login:${email.toLowerCase()}`
      const now = Date.now()

      const record = await prisma.system_settings.findUnique({ where: { key } })

      if (record) {
        const data = JSON.parse(record.value as string)
        const previousAttempts = data.attempts || 0
        data.attempts = previousAttempts + 1
        data.lastAttempt = now
        await prisma.system_settings.update({
          where: { key },
          data: { value: JSON.stringify(data) },
        })

        if (previousAttempts < maxAttempts && data.attempts >= maxAttempts) {
          const { notifySuperAdminsSecurityAlert } = await import(
            '@/lib/notifications/security-telegram'
          )
          notifySuperAdminsSecurityAlert({
            title: 'Cuenta bloqueada por intentos fallidos',
            body: `Email: ${email}\nIntentos: ${data.attempts}/${maxAttempts}\nBloqueo temporal activo (15 min).`,
            link: '/admin/audit',
          }).catch(() => {})
        }
      } else {
        await prisma.system_settings.create({
          data: {
            id: randomUUID(),
            key,
            value: JSON.stringify({ attempts: 1, lastAttempt: now }),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      }
    } catch (error) {
      console.error('[SECURITY CONFIG] Error registrando intento fallido:', error)
    }
  }

  /**
   * Verificar si una cuenta está bloqueada por intentos fallidos
   * Usa solo el email como clave (sin IP)
   */
  static async isAccountLocked(
    email: string,
    _ipAddress: string
  ): Promise<{ locked: boolean; attemptsRemaining?: number }> {
    try {
      const config = await this.getConfig()
      const key = `failed_login:${email.toLowerCase()}`
      // 5 intentos es el estándar de seguridad (NIST SP 800-63B, PCI DSS)
      const maxAttempts = config.maxLoginAttempts || 5

      const record = await prisma.system_settings.findUnique({ where: { key } })

      if (!record) {
        return { locked: false, attemptsRemaining: maxAttempts }
      }

      const data = JSON.parse(record.value as string)
      const attempts = data.attempts || 0
      const lastAttempt = data.lastAttempt || 0
      const now = Date.now()

      // Resetear después de 15 minutos (reducido de 30)
      const LOCKOUT_DURATION = 15 * 60 * 1000
      if (now - lastAttempt > LOCKOUT_DURATION) {
        await prisma.system_settings.delete({ where: { key } }).catch(() => {})
        return { locked: false, attemptsRemaining: maxAttempts }
      }

      if (attempts >= maxAttempts) {
        return { locked: true, attemptsRemaining: 0 }
      }

      return { locked: false, attemptsRemaining: maxAttempts - attempts }
    } catch (error) {
      console.error('[SECURITY CONFIG] Error verificando bloqueo:', error)
      return { locked: false }
    }
  }

  /**
   * Limpiar intentos fallidos después de login exitoso
   */
  static async clearFailedLogins(email: string, _ipAddress: string): Promise<void> {
    try {
      const key = `failed_login:${email.toLowerCase()}`
      await prisma.system_settings.deleteMany({ where: { key } })
    } catch (error) {
      console.error('[SECURITY CONFIG] Error limpiando intentos fallidos:', error)
    }
  }

  /**
   * Desbloquear una cuenta manualmente (para uso desde panel de admin)
   */
  static async unlockAccount(email: string): Promise<void> {
    try {
      const key = `failed_login:${email.toLowerCase()}`
      await prisma.system_settings.deleteMany({ where: { key } })
    } catch (error) {
      console.error('[SECURITY CONFIG] Error desbloqueando cuenta:', error)
    }
  }
}

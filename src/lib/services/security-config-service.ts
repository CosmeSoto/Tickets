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
    if (this.cache && (now - this.cacheTime) < this.CACHE_TTL) {
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
              'maxFileSize',
              'allowedFileTypes'
            ]
          }
        }
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
          'text/plain'
        ]
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
        maxFileSize: 10,
        allowedFileTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/pdf',
          'text/plain'
        ]
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
  static async validatePasswordLength(password: string): Promise<{ valid: boolean; message?: string }> {
    const config = await this.getConfig()
    
    if (password.length < config.passwordMinLength) {
      return {
        valid: false,
        message: `La contraseña debe tener al menos ${config.passwordMinLength} caracteres`
      }
    }

    return { valid: true }
  }

  /**
   * Validar tamaño de archivo según configuración
   */
  static async validateFileSize(fileSizeBytes: number): Promise<{ valid: boolean; message?: string }> {
    const config = await this.getConfig()
    const maxSizeBytes = config.maxFileSize * 1024 * 1024 // Convertir MB a bytes

    if (fileSizeBytes > maxSizeBytes) {
      return {
        valid: false,
        message: `El archivo excede el tamaño máximo permitido de ${config.maxFileSize} MB`
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
        message: `Tipo de archivo no permitido. Tipos permitidos: ${config.allowedFileTypes.join(', ')}`
      }
    }

    return { valid: true }
  }

  /**
   * Registrar intento de login fallido
   */
  static async recordFailedLogin(email: string, ipAddress: string): Promise<void> {
    try {
      const key = `failed_login:${email}:${ipAddress}`
      const now = Date.now()

      // Buscar registro existente
      let record = await prisma.system_settings.findUnique({
        where: { key }
      })

      if (record) {
        // Incrementar contador
        const data = JSON.parse(record.value as string)
        data.attempts = (data.attempts || 0) + 1
        data.lastAttempt = now

        await prisma.system_settings.update({
          where: { key },
          data: { value: JSON.stringify(data) }
        })
      } else {
        // Crear nuevo registro
        await prisma.system_settings.create({
          data: {
            id: randomUUID(),
            key,
            value: JSON.stringify({
              attempts: 1,
              lastAttempt: now
            }),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      }
    } catch (error) {
      console.error('[SECURITY CONFIG] Error registrando intento fallido:', error)
    }
  }

  /**
   * Verificar si una cuenta está bloqueada por intentos fallidos
   */
  static async isAccountLocked(email: string, ipAddress: string): Promise<{ locked: boolean; attemptsRemaining?: number }> {
    try {
      const config = await this.getConfig()
      const key = `failed_login:${email}:${ipAddress}`

      const record = await prisma.system_settings.findUnique({
        where: { key }
      })

      if (!record) {
        return { locked: false, attemptsRemaining: config.maxLoginAttempts }
      }

      const data = JSON.parse(record.value as string)
      const attempts = data.attempts || 0
      const lastAttempt = data.lastAttempt || 0
      const now = Date.now()

      // Resetear después de 30 minutos
      const LOCKOUT_DURATION = 30 * 60 * 1000 // 30 minutos
      if (now - lastAttempt > LOCKOUT_DURATION) {
        // Limpiar registro
        await prisma.system_settings.delete({ where: { key } })
        return { locked: false, attemptsRemaining: config.maxLoginAttempts }
      }

      // Verificar si está bloqueado
      if (attempts >= config.maxLoginAttempts) {
        return { locked: true, attemptsRemaining: 0 }
      }

      return { 
        locked: false, 
        attemptsRemaining: config.maxLoginAttempts - attempts 
      }
    } catch (error) {
      console.error('[SECURITY CONFIG] Error verificando bloqueo:', error)
      return { locked: false }
    }
  }

  /**
   * Limpiar intentos fallidos después de login exitoso
   */
  static async clearFailedLogins(email: string, ipAddress: string): Promise<void> {
    try {
      const key = `failed_login:${email}:${ipAddress}`
      await prisma.system_settings.deleteMany({
        where: { key }
      })
    } catch (error) {
      console.error('[SECURITY CONFIG] Error limpiando intentos fallidos:', error)
    }
  }
}

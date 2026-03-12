import crypto from 'crypto'
import type { DigitalSignature } from '@/types/inventory/delivery-act'

/**
 * Servicio para gestión de firmas digitales
 * Genera hashes SHA-256 para verificación de autenticidad
 */
export class DigitalSignatureService {
  /**
   * Genera un hash SHA-256 para verificación de acta
   * El hash incluye información del acta, timestamp, IP y user agent
   */
  static generateVerificationHash(data: {
    actId: string
    folio: string
    receiverId: string
    delivererId: string
    timestamp: Date
    ipAddress: string
    userAgent: string
  }): string {
    const content = [
      data.actId,
      data.folio,
      data.receiverId,
      data.delivererId,
      data.timestamp.toISOString(),
      data.ipAddress,
      data.userAgent,
    ].join('|')

    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Verifica la autenticidad de un hash
   */
  static verifyHash(
    hash: string,
    data: {
      actId: string
      folio: string
      receiverId: string
      delivererId: string
      timestamp: Date
      ipAddress: string
      userAgent: string
    }
  ): boolean {
    const expectedHash = this.generateVerificationHash(data)
    return hash === expectedHash
  }

  /**
   * Genera un token único para aceptación de acta
   * Formato: base64url de 32 bytes aleatorios
   */
  static generateAcceptanceToken(): string {
    return crypto.randomBytes(32).toString('base64url')
  }

  /**
   * Crea una firma digital completa
   */
  static createDigitalSignature(
    actId: string,
    folio: string,
    receiverId: string,
    delivererId: string,
    ipAddress: string,
    userAgent: string
  ): DigitalSignature {
    const timestamp = new Date()
    
    const hash = this.generateVerificationHash({
      actId,
      folio,
      receiverId,
      delivererId,
      timestamp,
      ipAddress,
      userAgent,
    })

    return {
      timestamp,
      ipAddress,
      userAgent,
      hash,
    }
  }

  /**
   * Extrae la IP del request
   * Considera proxies y load balancers
   */
  static extractIpAddress(headers: Headers): string {
    // Intentar obtener IP real considerando proxies
    const forwardedFor = headers.get('x-forwarded-for')
    if (forwardedFor) {
      // x-forwarded-for puede contener múltiples IPs, tomar la primera
      return forwardedFor.split(',')[0].trim()
    }

    const realIp = headers.get('x-real-ip')
    if (realIp) {
      return realIp
    }

    // Fallback a IP genérica si no se puede determinar
    return 'unknown'
  }

  /**
   * Extrae el User Agent del request
   */
  static extractUserAgent(headers: Headers): string {
    return headers.get('user-agent') || 'unknown'
  }

  /**
   * Genera un hash corto para mostrar en UI (primeros 8 caracteres)
   */
  static getShortHash(hash: string): string {
    return hash.substring(0, 8).toUpperCase()
  }

  /**
   * Valida que un token de aceptación tenga el formato correcto
   */
  static isValidAcceptanceToken(token: string): boolean {
    // Token debe ser base64url de 32 bytes (43 caracteres)
    return /^[A-Za-z0-9_-]{43}$/.test(token)
  }
}

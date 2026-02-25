/**
 * Enriquecedor de Contexto para Auditoría
 * Agrega información adicional automáticamente a los logs de auditoría
 */

import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export interface EnrichedContext {
  // Trazabilidad
  sessionId?: string
  requestId: string
  correlationId?: string
  
  // Resultado
  result: 'SUCCESS' | 'ERROR' | 'PARTIAL'
  errorCode?: string
  errorMessage?: string
  duration?: number
  
  // Contexto técnico
  source: 'WEB' | 'API' | 'MOBILE' | 'SYSTEM'
  endpoint?: string
  method?: string
  statusCode?: number
  
  // Dispositivo
  deviceType: 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown'
  browser: string
  browserVersion?: string
  os: string
  osVersion?: string
  
  // Timestamp
  timestamp: string
}

export class AuditContextEnricher {
  
  /**
   * Detectar tipo de dispositivo desde User Agent
   */
  static detectDeviceType(userAgent: string): 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown' {
    if (!userAgent) return 'Unknown'
    
    const ua = userAgent.toLowerCase()
    
    // Tablets
    if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
      return 'Tablet'
    }
    
    // Mobile
    if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
      return 'Mobile'
    }
    
    // Desktop
    if (ua.includes('windows') || ua.includes('mac') || ua.includes('linux')) {
      return 'Desktop'
    }
    
    return 'Unknown'
  }
  
  /**
   * Detectar navegador y versión
   */
  static detectBrowser(userAgent: string): { name: string; version?: string } {
    if (!userAgent) return { name: 'Unknown' }
    
    const ua = userAgent
    
    // Edge
    if (ua.includes('Edg/')) {
      const match = ua.match(/Edg\/([\d.]+)/)
      return { name: 'Microsoft Edge', version: match ? match[1] : undefined }
    }
    
    // Chrome
    if (ua.includes('Chrome/')) {
      const match = ua.match(/Chrome\/([\d.]+)/)
      return { name: 'Google Chrome', version: match ? match[1] : undefined }
    }
    
    // Firefox
    if (ua.includes('Firefox/')) {
      const match = ua.match(/Firefox\/([\d.]+)/)
      return { name: 'Mozilla Firefox', version: match ? match[1] : undefined }
    }
    
    // Safari
    if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      const match = ua.match(/Version\/([\d.]+)/)
      return { name: 'Apple Safari', version: match ? match[1] : undefined }
    }
    
    // Opera
    if (ua.includes('Opera/') || ua.includes('OPR/')) {
      const match = ua.match(/(?:Opera|OPR)\/([\d.]+)/)
      return { name: 'Opera', version: match ? match[1] : undefined }
    }
    
    return { name: 'Unknown' }
  }
  
  /**
   * Detectar sistema operativo y versión
   */
  static detectOS(userAgent: string): { name: string; version?: string } {
    if (!userAgent) return { name: 'Unknown' }
    
    const ua = userAgent
    
    // Windows
    if (ua.includes('Windows NT 10.0')) return { name: 'Windows', version: '10/11' }
    if (ua.includes('Windows NT 6.3')) return { name: 'Windows', version: '8.1' }
    if (ua.includes('Windows NT 6.2')) return { name: 'Windows', version: '8' }
    if (ua.includes('Windows NT 6.1')) return { name: 'Windows', version: '7' }
    if (ua.includes('Windows')) return { name: 'Windows' }
    
    // macOS
    if (ua.includes('Mac OS X')) {
      const match = ua.match(/Mac OS X (\d+[._]\d+)/)
      return { 
        name: 'macOS', 
        version: match ? match[1].replace('_', '.') : undefined 
      }
    }
    
    // Linux
    if (ua.includes('Linux')) return { name: 'Linux' }
    
    // Android
    if (ua.includes('Android')) {
      const match = ua.match(/Android ([\d.]+)/)
      return { name: 'Android', version: match ? match[1] : undefined }
    }
    
    // iOS
    if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
      const match = ua.match(/OS ([\d_]+)/)
      return { 
        name: 'iOS', 
        version: match ? match[1].replace(/_/g, '.') : undefined 
      }
    }
    
    return { name: 'Unknown' }
  }
  
  /**
   * Detectar origen de la solicitud
   */
  static detectSource(request?: NextRequest): 'WEB' | 'API' | 'MOBILE' | 'SYSTEM' {
    if (!request) return 'SYSTEM'
    
    const userAgent = request.headers.get('user-agent') || ''
    const referer = request.headers.get('referer') || ''
    const contentType = request.headers.get('content-type') || ''
    
    // API si es JSON y no tiene referer
    if (contentType.includes('application/json') && !referer) {
      return 'API'
    }
    
    // Mobile si el user agent indica mobile
    if (userAgent.toLowerCase().includes('mobile')) {
      return 'MOBILE'
    }
    
    // Web por defecto
    return 'WEB'
  }
  
  /**
   * Enriquecer contexto completo
   */
  static enrichContext(
    request?: NextRequest,
    options?: {
      sessionId?: string
      correlationId?: string
      startTime?: number
      result?: 'SUCCESS' | 'ERROR' | 'PARTIAL'
      errorCode?: string
      errorMessage?: string
      statusCode?: number
    }
  ): EnrichedContext {
    const userAgent = request?.headers.get('user-agent') || ''
    const browser = this.detectBrowser(userAgent)
    const os = this.detectOS(userAgent)
    
    return {
      // Trazabilidad
      sessionId: options?.sessionId,
      requestId: randomUUID(),
      correlationId: options?.correlationId,
      
      // Resultado
      result: options?.result || 'SUCCESS',
      errorCode: options?.errorCode,
      errorMessage: options?.errorMessage,
      duration: options?.startTime ? Date.now() - options.startTime : undefined,
      
      // Contexto técnico
      source: this.detectSource(request),
      endpoint: request?.url,
      method: request?.method,
      statusCode: options?.statusCode || 200,
      
      // Dispositivo
      deviceType: this.detectDeviceType(userAgent),
      browser: browser.name,
      browserVersion: browser.version,
      os: os.name,
      osVersion: os.version,
      
      // Timestamp
      timestamp: new Date().toISOString()
    }
  }
  
  /**
   * Crear contexto para operaciones del sistema (sin request)
   */
  static createSystemContext(options?: {
    result?: 'SUCCESS' | 'ERROR' | 'PARTIAL'
    errorCode?: string
    errorMessage?: string
    duration?: number
  }): EnrichedContext {
    return {
      requestId: randomUUID(),
      result: options?.result || 'SUCCESS',
      errorCode: options?.errorCode,
      errorMessage: options?.errorMessage,
      duration: options?.duration,
      source: 'SYSTEM',
      deviceType: 'Unknown',
      browser: 'System',
      os: 'Server',
      timestamp: new Date().toISOString()
    }
  }
  
  /**
   * Generar ID de correlación para rastrear flujos completos
   */
  static generateCorrelationId(): string {
    return `corr-${randomUUID()}`
  }
  
  /**
   * Extraer session ID de la sesión de NextAuth
   */
  static extractSessionId(session: any): string | undefined {
    // NextAuth no expone session ID directamente, pero podemos usar el user ID + timestamp
    if (session?.user?.id) {
      return `sess-${session.user.id}-${Date.now()}`
    }
    return undefined
  }
}

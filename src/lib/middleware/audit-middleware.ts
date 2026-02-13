/**
 * Middleware de Auditoría Automática
 * Intercepta requests y responses para registrar automáticamente acciones de auditoría
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

interface AuditConfig {
  entityType: 'ticket' | 'user' | 'category' | 'department' | 'comment' | 'attachment' | 'system' | 'report' | 'settings' | 'technician' | 'assignment'
  action?: string
  extractEntityId?: (request: NextRequest, response?: NextResponse, body?: any) => string | undefined
  extractDetails?: (request: NextRequest, response?: NextResponse, body?: any) => Record<string, any>
  skipAudit?: (request: NextRequest) => boolean
}

/**
 * Configuración de auditoría por ruta
 */
const AUDIT_ROUTES: Record<string, AuditConfig> = {
  // Usuarios
  'POST /api/users': {
    entityType: 'user',
    action: AuditActionsComplete.USER_CREATED,
    extractEntityId: (req, res) => res?.headers.get('x-created-user-id') || undefined,
    extractDetails: (req, res, body) => ({
      method: req.method,
      url: req.url,
      userData: body || {}
    })
  },
  'PUT /api/users/[id]': {
    entityType: 'user',
    action: AuditActionsComplete.USER_UPDATED,
    extractEntityId: (req) => req.url.split('/').pop(),
    extractDetails: (req, res, body) => body || {}
  },
  'DELETE /api/users/[id]': {
    entityType: 'user',
    action: AuditActionsComplete.USER_DELETED,
    extractEntityId: (req) => req.url.split('/').pop()
  },

  // Categorías
  'POST /api/categories': {
    entityType: 'category',
    action: AuditActionsComplete.CATEGORY_CREATED,
    extractEntityId: (req, res) => res?.headers.get('x-created-category-id') || undefined,
    extractDetails: (req, res, body) => ({
      categoryName: body?.name,
      level: body?.level,
      departmentId: body?.departmentId
    })
  },
  'PUT /api/categories/[id]': {
    entityType: 'category',
    action: AuditActionsComplete.CATEGORY_UPDATED,
    extractEntityId: (req) => req.url.split('/').pop(),
    extractDetails: (req, res, body) => body || {}
  },
  'DELETE /api/categories/[id]': {
    entityType: 'category',
    action: AuditActionsComplete.CATEGORY_DELETED,
    extractEntityId: (req) => req.url.split('/').pop()
  },

  // Departamentos
  'POST /api/departments': {
    entityType: 'department',
    action: AuditActionsComplete.DEPARTMENT_CREATED,
    extractEntityId: (req, res) => res?.headers.get('x-created-department-id') || undefined,
    extractDetails: (req, res, body) => ({
      departmentName: body?.name,
      description: body?.description
    })
  },
  'PUT /api/departments/[id]': {
    entityType: 'department',
    action: AuditActionsComplete.DEPARTMENT_UPDATED,
    extractEntityId: (req) => req.url.split('/').pop(),
    extractDetails: (req, res, body) => body || {}
  },
  'DELETE /api/departments/[id]': {
    entityType: 'department',
    action: AuditActionsComplete.DEPARTMENT_DELETED,
    extractEntityId: (req) => req.url.split('/').pop()
  },

  // Tickets
  'POST /api/tickets': {
    entityType: 'ticket',
    action: AuditActionsComplete.TICKET_CREATED,
    extractEntityId: (req, res) => res?.headers.get('x-created-ticket-id') || undefined,
    extractDetails: (req, res, body) => ({
      title: body?.title,
      priority: body?.priority,
      categoryId: body?.categoryId
    })
  },
  'PUT /api/tickets/[id]': {
    entityType: 'ticket',
    action: AuditActionsComplete.TICKET_UPDATED,
    extractEntityId: (req) => req.url.split('/').pop(),
    extractDetails: (req, res, body) => body || {}
  },

  // Configuración del sistema
  'PUT /api/admin/settings': {
    entityType: 'system',
    action: AuditActionsComplete.SETTINGS_UPDATED,
    extractDetails: (req, res, body) => body || {}
  },
  'PUT /api/admin/oauth-config': {
    entityType: 'system',
    action: AuditActionsComplete.OAUTH_CONFIG_UPDATED,
    extractDetails: (req, res, body) => ({
      provider: body?.provider,
      enabled: body?.enabled
    })
  }
}

/**
 * Middleware de auditoría que se puede aplicar a cualquier endpoint
 */
export function withAudit(handler: Function, config?: Partial<AuditConfig>) {
  return async (request: NextRequest, context?: any) => {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return handler(request, context)
    }

    const method = request.method
    const pathname = new URL(request.url).pathname
    const routeKey = `${method} ${pathname}`
    
    // Buscar configuración de auditoría
    let auditConfig = AUDIT_ROUTES[routeKey] || config
    
    // Si no hay configuración, buscar por patrón
    if (!auditConfig) {
      for (const [pattern, conf] of Object.entries(AUDIT_ROUTES)) {
        if (matchRoute(pattern, routeKey)) {
          auditConfig = conf
          break
        }
      }
    }

    if (!auditConfig) {
      return handler(request, context)
    }

    // Verificar si se debe omitir la auditoría
    if (auditConfig.skipAudit && auditConfig.skipAudit(request)) {
      return handler(request, context)
    }

    let requestBody: any = null
    try {
      if (request.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        requestBody = await request.json()
        // Recrear el request con el body leído
        request = new NextRequest(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(requestBody)
        })
      }
    } catch (error) {
      // Si no se puede leer el body, continuar sin auditoría del body
    }

    // Ejecutar el handler original
    const response = await handler(request, context)

    // Registrar auditoría después de la ejecución exitosa
    if (response && response.status < 400) {
      try {
        const entityId = auditConfig.extractEntityId 
          ? auditConfig.extractEntityId(request, response, requestBody)
          : context?.params?.id

        const details = auditConfig.extractDetails 
          ? auditConfig.extractDetails(request, response, requestBody)
          : requestBody

        await AuditServiceComplete.log({
          action: auditConfig.action || `${auditConfig.entityType}_${method.toLowerCase()}`,
          entityType: auditConfig.entityType,
          entityId,
          userId: session.user.id,
          details: {
            ...details,
            method,
            pathname,
            userAgent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString()
          },
          ipAddress: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown'
        })
      } catch (auditError) {
        console.error('[AUDIT] Error logging audit entry:', auditError)
        // No fallar la request por errores de auditoría
      }
    }

    return response
  }
}

/**
 * Función helper para hacer match de rutas con parámetros
 */
function matchRoute(pattern: string, route: string): boolean {
  const patternParts = pattern.split(' ')
  const routeParts = route.split(' ')
  
  if (patternParts.length !== routeParts.length) return false
  if (patternParts[0] !== routeParts[0]) return false // Método debe coincidir exactamente
  
  const patternPath = patternParts[1].split('/')
  const routePath = routeParts[1].split('/')
  
  if (patternPath.length !== routePath.length) return false
  
  for (let i = 0; i < patternPath.length; i++) {
    const patternSegment = patternPath[i]
    const routeSegment = routePath[i]
    
    // Si es un parámetro dinámico [id], aceptar cualquier valor
    if (patternSegment.startsWith('[') && patternSegment.endsWith(']')) {
      continue
    }
    
    // Debe coincidir exactamente
    if (patternSegment !== routeSegment) {
      return false
    }
  }
  
  return true
}

/**
 * Decorator para aplicar auditoría automáticamente
 */
export function AuditLog(config: AuditConfig) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = withAudit(originalMethod, config)
    
    return descriptor
  }
}

/**
 * Helper para registrar auditoría manual en casos específicos
 */
export async function logAuditAction(
  action: string,
  entityType: AuditConfig['entityType'],
  entityId: string,
  userId: string,
  details?: Record<string, any>,
  request?: NextRequest
) {
  try {
    await AuditServiceComplete.log({
      action,
      entityType,
      entityId,
      userId,
      details,
      ipAddress: request?.headers.get('x-forwarded-for') || 
                 request?.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request?.headers.get('user-agent') || 'unknown'
    })
  } catch (error) {
    console.error('[AUDIT] Error logging manual audit action:', error)
  }
}
/**
 * SERVICIO DE VALIDACIÓN Y SANITIZACIÓN
 *
 * Proporciona funciones para validar y sanitizar entradas de usuario
 * protegiendo contra XSS, inyección SQL y otros ataques
 */

import DOMPurify from 'isomorphic-dompurify'
import { z } from 'zod'

// Configuración de DOMPurify para diferentes contextos
const PURIFY_CONFIG = {
  // Para contenido HTML completo (comentarios, descripciones)
  html: {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'ol',
      'ul',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: ['class'],
    KEEP_CONTENT: true,
  },
  // Para texto plano (títulos, nombres)
  text: {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  },
  // Para URLs y enlaces
  url: {
    ALLOWED_TAGS: ['a'],
    ALLOWED_ATTR: ['href', 'title', 'target'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp):\/\/|mailto:|tel:)/i,
  },
}

export class ValidationService {
  /**
   * Sanitiza contenido HTML eliminando elementos peligrosos
   */
  static sanitizeHtml(input: string, type: 'html' | 'text' | 'url' = 'html'): string {
    if (!input || typeof input !== 'string') {
      return ''
    }

    const config = PURIFY_CONFIG[type]
    return DOMPurify.sanitize(input.trim(), config)
  }

  /**
   * Sanitiza texto plano eliminando caracteres peligrosos
   */
  static sanitizeText(input: string): string {
    if (!input || typeof input !== 'string') {
      return ''
    }

    return input
      .trim()
      .replace(/[<>'"&]/g, '') // Eliminar caracteres HTML básicos
      .replace(/\x00/g, '') // Eliminar null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Eliminar caracteres de control
      .substring(0, 1000) // Limitar longitud
  }

  /**
   * Valida y sanitiza email
   */
  static sanitizeEmail(email: string): string {
    if (!email || typeof email !== 'string') {
      return ''
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const cleaned = email.toLowerCase().trim()

    return emailRegex.test(cleaned) ? cleaned : ''
  }

  /**
   * Valida y sanitiza URL
   */
  static sanitizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      return ''
    }

    try {
      const urlObj = new URL(url)

      // Solo permitir protocolos seguros
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(urlObj.protocol)) {
        return ''
      }

      return urlObj.toString()
    } catch {
      return ''
    }
  }

  /**
   * Valida nombre de archivo y extensión
   */
  static sanitizeFilename(filename: string): string {
    if (!filename || typeof filename !== 'string') {
      return ''
    }

    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Solo caracteres seguros
      .replace(/\.{2,}/g, '.') // Evitar múltiples puntos
      .replace(/^\./, '') // No empezar con punto
      .substring(0, 255) // Limitar longitud
  }

  /**
   * Valida tipo MIME de archivo
   */
  static validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
    if (!mimeType || typeof mimeType !== 'string') {
      return false
    }

    const normalizedType = mimeType.toLowerCase().trim()
    return allowedTypes.some(
      allowed => normalizedType === allowed || normalizedType.startsWith(allowed.replace('*', ''))
    )
  }

  /**
   * Valida tamaño de archivo
   */
  static validateFileSize(size: number, maxSizeBytes: number): boolean {
    return typeof size === 'number' && size > 0 && size <= maxSizeBytes
  }

  /**
   * Sanitiza objeto completo recursivamente
   */
  static sanitizeObject(obj: any, schema?: z.ZodSchema): any {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (typeof obj === 'string') {
      return this.sanitizeText(obj)
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, schema))
    }

    if (typeof obj === 'object') {
      const sanitized: any = {}

      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeText(key)
        sanitized[sanitizedKey] = this.sanitizeObject(value, schema)
      }

      // Si hay un schema de Zod, validar el objeto sanitizado
      if (schema) {
        try {
          return schema.parse(sanitized)
        } catch (error) {
          console.warn('Validación de schema falló:', error)
          return sanitized
        }
      }

      return sanitized
    }

    return obj
  }
}

// Schemas de validación comunes usando Zod
export const CommonSchemas = {
  // Validación de ticket
  ticket: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    categoryId: z.string().cuid(),
  }),

  // Validación de comentario
  comment: z.object({
    content: z.string().min(1).max(2000),
    isInternal: z.boolean().optional().default(false),
    ticketId: z.string().cuid(),
  }),

  // Validación de usuario
  user: z.object({
    name: z.string().min(1).max(100),
    email: z.string().email(),
    department: z.string().max(100).optional(),
    phone: z.string().max(20).optional(),
  }),

  // Validación de archivo
  file: z.object({
    filename: z.string().min(1).max(255),
    mimeType: z.string().min(1),
    size: z
      .number()
      .positive()
      .max(50 * 1024 * 1024), // 50MB máximo
  }),

  // Validación de paginación
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(10),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
}

// Tipos MIME permitidos por categoría
export const ALLOWED_MIME_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
  ],
  archives: ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'],
}

// Límites de tamaño por tipo de archivo
export const FILE_SIZE_LIMITS = {
  image: 5 * 1024 * 1024, // 5MB para imágenes
  document: 25 * 1024 * 1024, // 25MB para documentos
  archive: 50 * 1024 * 1024, // 50MB para archivos comprimidos
  default: 10 * 1024 * 1024, // 10MB por defecto
}

/**
 * Middleware de validación para rutas API
 */
export function createValidationMiddleware(schema: z.ZodSchema) {
  return (data: any) => {
    try {
      // Primero sanitizar los datos
      const sanitized = ValidationService.sanitizeObject(data)

      // Luego validar con el schema
      return schema.parse(sanitized)
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validación falló: ${error.errors.map(e => e.message).join(', ')}`)
      }
      throw error
    }
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * POST /api/analytics/category-selection
 * 
 * Registra eventos de interacción del usuario con el selector de categorías
 * Implementa validación, sanitización y rate limiting
 * 
 * Body:
 * - eventType: string (requerido) - Tipo de evento
 * - categoryId: string (opcional) - ID de categoría seleccionada
 * - searchQuery: string (opcional) - Término de búsqueda
 * - timeToSelect: number (opcional) - Tiempo en milisegundos
 * - metadata: object (opcional) - Datos adicionales
 */

// Tipos de eventos válidos
const VALID_EVENT_TYPES = [
  'search',
  'suggestion_click',
  'manual_select',
  'frequent_select',
  'category_change',
] as const;

type EventType = typeof VALID_EVENT_TYPES[number];

interface AnalyticsRequestBody {
  eventType: string;
  categoryId?: string;
  searchQuery?: string;
  timeToSelect?: number;
  metadata?: Record<string, any>;
}

/**
 * Sanitiza el query de búsqueda para evitar almacenar datos sensibles
 */
function sanitizeSearchQuery(query: string | undefined): string | null {
  if (!query) return null;
  
  // Limitar longitud
  const trimmed = query.trim().substring(0, 255);
  
  // Patrones de datos sensibles a eliminar
  const sensitivePatterns = [
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, // Teléfonos
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Tarjetas de crédito
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  ];
  
  let sanitized = trimmed;
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  
  return sanitized || null;
}

/**
 * Sanitiza metadata para evitar almacenar datos sensibles
 */
function sanitizeMetadata(metadata: Record<string, any> | undefined): Record<string, any> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  
  // Lista de claves sensibles que no deben almacenarse
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'ssn',
    'email',
    'phone',
  ];
  
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    // Omitir claves sensibles
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      continue;
    }
    
    // Limitar profundidad y tamaño
    if (typeof value === 'string') {
      sanitized[key] = value.substring(0, 500);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 10);
    } else if (typeof value === 'object' && value !== null) {
      // Solo un nivel de profundidad
      sanitized[key] = '[OBJECT]';
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      );
    }

    // Rate limiting: 100 eventos por minuto por usuario
    const rateLimitResult = checkRateLimit(
      `analytics:${session.user.id}`,
      100,
      60000
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Demasiadas solicitudes. Por favor, intenta más tarde.',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Limit': String(rateLimitResult.limit),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.reset),
          },
        }
      );
    }

    // Parse body
    let body: AnalyticsRequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { success: false, message: 'Cuerpo de solicitud inválido' },
        { status: 400 }
      );
    }

    // Validar eventType
    if (!body.eventType || typeof body.eventType !== 'string') {
      return NextResponse.json(
        { success: false, message: 'El campo eventType es requerido' },
        { status: 400 }
      );
    }

    if (!VALID_EVENT_TYPES.includes(body.eventType as EventType)) {
      return NextResponse.json(
        {
          success: false,
          message: `Tipo de evento inválido. Valores permitidos: ${VALID_EVENT_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validar categoryId si está presente
    if (body.categoryId !== undefined) {
      if (typeof body.categoryId !== 'string' || body.categoryId.trim() === '') {
        return NextResponse.json(
          { success: false, message: 'El campo categoryId debe ser un string válido' },
          { status: 400 }
        );
      }
    }

    // Validar timeToSelect si está presente
    if (body.timeToSelect !== undefined) {
      if (typeof body.timeToSelect !== 'number' || body.timeToSelect < 0) {
        return NextResponse.json(
          { success: false, message: 'El campo timeToSelect debe ser un número positivo' },
          { status: 400 }
        );
      }
    }

    // Sanitizar datos
    const sanitizedSearchQuery = sanitizeSearchQuery(body.searchQuery);
    const sanitizedMetadata = sanitizeMetadata(body.metadata);

    // Persistir evento
    await prisma.category_analytics.create({
      data: {
        eventType: body.eventType,
        clientId: session.user.id,
        categoryId: body.categoryId || null,
        searchQuery: sanitizedSearchQuery,
        timeToSelect: body.timeToSelect || null,
        metadata: sanitizedMetadata,
      },
    });

    return NextResponse.json(
      { success: true },
      {
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.reset),
        },
      }
    );
  } catch (error) {
    console.error('Error in category analytics API:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al registrar evento de analytics',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

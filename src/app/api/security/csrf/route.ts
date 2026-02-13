/**
 * ENDPOINT PARA OBTENER TOKEN CSRF
 *
 * Proporciona tokens CSRF para proteger formularios
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  SecurityMiddleware,
  createSecureApiRoute,
  SecurityConfigs,
} from '@/lib/security/middleware'

async function handler(request: NextRequest, context: any) {
  if (request.method === 'GET') {
    // Generar nuevo token CSRF
    const csrfToken = SecurityMiddleware.generateCsrfToken()

    return NextResponse.json({
      csrfToken,
      expiresIn: 3600, // 1 hora
      timestamp: new Date().toISOString(),
    })
  }

  return NextResponse.json({ error: 'Método no permitido' }, { status: 405 })
}

// Aplicar middleware de seguridad
export const GET = createSecureApiRoute(handler, SecurityConfigs.public)

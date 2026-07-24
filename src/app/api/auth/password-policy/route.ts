/**
 * GET /api/auth/password-policy
 * Endpoint público (sin autenticación) que expone únicamente la política de contraseñas
 * necesaria para que el formulario de registro pueda validar en el cliente.
 * No expone ningún dato sensible.
 */

import { NextResponse } from 'next/server'
import { SecurityConfigService } from '@/lib/services/security-config-service'

export async function GET() {
  try {
    const config = await SecurityConfigService.getConfig()
    return NextResponse.json(
      { minLength: config.passwordMinLength },
      {
        status: 200,
        headers: {
          // Cachear 5 minutos en el cliente — mismo TTL que el caché del servicio
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        },
      }
    )
  } catch {
    // Si falla, devolver el valor por defecto para no bloquear el registro
    return NextResponse.json({ minLength: 8 }, { status: 200 })
  }
}

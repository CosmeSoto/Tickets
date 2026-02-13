import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Endpoint personalizado de sesión para evitar errores de JSON vacío
 * Este endpoint siempre devuelve JSON válido
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Siempre devolver JSON válido, incluso si no hay sesión
    if (!session) {
      return NextResponse.json(null, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, must-revalidate',
        },
      })
    }

    return NextResponse.json(session, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[API-AUTH-SESSION] Error:', error)
    
    // En caso de error, devolver null en lugar de fallar
    return NextResponse.json(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, must-revalidate',
      },
    })
  }
}

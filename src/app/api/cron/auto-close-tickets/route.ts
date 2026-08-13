import { NextRequest, NextResponse } from 'next/server'
import { autoCloseResolvedTickets } from '@/lib/cron/auto-close-resolved-tickets'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

/**
 * Cron Job: Auto-cierre de tickets resueltos sin calificación
 * Ejecutar diariamente
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Iniciando auto-cierre de tickets resueltos...')

    const result = await autoCloseResolvedTickets()

    console.log('[CRON] Auto-cierre completado:', result)

    return NextResponse.json({
      success: true,
      message: `Auto-cierre completado: ${result.closed} cerrados, ${result.errors} errores`,
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error en auto-cierre:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error en auto-cierre de tickets',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

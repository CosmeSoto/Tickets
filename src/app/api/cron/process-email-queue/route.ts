/**
 * Cron Job: Procesar Cola de Emails
 * Este endpoint debe ser llamado periódicamente (cada 5 minutos) por un cron job
 * Ejemplo con Vercel Cron: https://vercel.com/docs/cron-jobs
 */

import { NextResponse } from 'next/server'
import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'
import { EmailService } from '@/lib/services/email/email-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  try {
    const unauthorized = verifyCronAuth(request)
    if (unauthorized) return unauthorized

    console.log('[CRON] Procesando cola de emails...')
    
    // Procesar cola
    const result = await EmailService.processQueue()
    
    console.log(`[CRON] Emails procesados: ${result.sent} enviados, ${result.failed} fallidos`)

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[CRON] Error procesando cola de emails:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      },
      { status: 500 }
    )
  }
}

// También permitir POST para testing manual
export async function POST(request: Request) {
  return GET(request)
}

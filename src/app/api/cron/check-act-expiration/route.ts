import { NextRequest, NextResponse } from 'next/server'
import { CheckActExpirationJob } from '@/lib/jobs/check-act-expiration.job'

/**
 * Endpoint para ejecutar el job de verificación de actas expiradas
 * Debe ser llamado diariamente por un cron job externo (ej: cron-job.org, Vercel Cron, etc.)
 * 
 * GET /api/cron/check-act-expiration
 * 
 * Seguridad: Verificar CRON_SECRET en headers para prevenir ejecuciones no autorizadas
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar token de seguridad para cron jobs
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }
    
    console.log('[CRON] Ejecutando check-act-expiration job...')
    
    // Ejecutar el job
    const result = await CheckActExpirationJob.run()
    
    return NextResponse.json({
      success: true,
      message: 'Job ejecutado exitosamente',
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando check-act-expiration job:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error ejecutando job',
        message: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

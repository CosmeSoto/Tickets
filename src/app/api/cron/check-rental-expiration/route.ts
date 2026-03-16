import { NextRequest, NextResponse } from 'next/server'
import { CheckRentalExpirationJob } from '@/lib/jobs/check-rental-expiration.job'

/**
 * Endpoint para ejecutar el job de verificación de contratos de renta próximos a expirar
 * Debe ser llamado diariamente por un cron job externo
 * 
 * GET /api/cron/check-rental-expiration
 * 
 * Seguridad: Verificar CRON_SECRET en headers
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar token de seguridad
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }
    
    console.log('[CRON] Ejecutando check-rental-expiration job...')
    
    // Ejecutar el job
    const result = await CheckRentalExpirationJob.run()
    
    return NextResponse.json({
      success: true,
      message: 'Job ejecutado exitosamente',
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando check-rental-expiration job:', error)
    
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

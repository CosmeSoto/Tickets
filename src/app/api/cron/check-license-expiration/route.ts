import { NextRequest, NextResponse } from 'next/server'
import { CheckLicenseExpirationJob } from '@/lib/jobs/check-license-expiration.job'

/**
 * Endpoint para ejecutar el job de verificación de licencias próximas a expirar
 * Debe ser llamado diariamente por un cron job externo
 * 
 * GET /api/cron/check-license-expiration
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
    
    console.log('[CRON] Ejecutando check-license-expiration job...')
    
    // Ejecutar el job
    const result = await CheckLicenseExpirationJob.run()
    
    return NextResponse.json({
      success: true,
      message: 'Job ejecutado exitosamente',
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[CRON] Error ejecutando check-license-expiration job:', error)
    
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

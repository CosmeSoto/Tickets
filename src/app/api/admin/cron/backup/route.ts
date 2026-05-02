import { NextRequest, NextResponse } from 'next/server'
import { runBackupScheduler } from '@/lib/cron/backup-scheduler'

/**
 * POST /api/admin/cron/backup
 *
 * Endpoint para disparar el backup automático programado.
 * Protegido con CRON_SECRET para evitar ejecuciones no autorizadas.
 *
 * Configuración recomendada (cron externo, cada hora):
 *   0 * * * * curl -X POST https://tu-dominio.com/api/admin/cron/backup \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * Con Vercel Cron (vercel.json):
 *   { "crons": [{ "path": "/api/admin/cron/backup", "schedule": "0 * * * *" }] }
 *
 * Variables de entorno requeridas:
 *   CRON_SECRET — string secreto para autenticar la llamada
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autorización
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      console.warn(
        '[CRON/BACKUP] CRON_SECRET no configurado — endpoint deshabilitado por seguridad'
      )
      return NextResponse.json({ error: 'Cron no configurado' }, { status: 503 })
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (token !== cronSecret) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Ejecutar el scheduler
    const result = await runBackupScheduler()

    return NextResponse.json({
      success: true,
      ran: result.ran,
      reason: result.reason,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[CRON/BACKUP] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Vercel Cron también puede usar GET
export async function GET(request: NextRequest) {
  return POST(request)
}

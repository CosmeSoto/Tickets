/**
 * POST /api/patrols/cron/reminders
 * Alias enfocado solo en recordatorios (misma lógica que GET /api/cron/patrol paso 1).
 * Preferir /api/cron/patrol para el mantenimiento completo.
 */
import { NextRequest, NextResponse } from 'next/server'
import { PatrolReminderService } from '@/lib/services/patrol-reminder.service'

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: 'Servicio no configurado' }, { status: 503 })
    }

    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const result = await PatrolReminderService.sendPendingReminders()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[patrol/cron/reminders] POST:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

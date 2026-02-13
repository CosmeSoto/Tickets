import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebhookService } from '@/lib/services/webhook-service'

/**
 * GET /api/admin/webhooks/stats
 * Obtener estadísticas de webhooks
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const webhookId = searchParams.get('webhookId') || undefined

    const stats = await WebhookService.getStats(webhookId)

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('[WEBHOOKS] Error obteniendo estadísticas:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener estadísticas',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

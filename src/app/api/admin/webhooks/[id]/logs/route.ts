import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebhookService } from '@/lib/services/webhook-service'

/**
 * GET /api/admin/webhooks/[id]/logs
 * Obtener logs de ejecución de un webhook
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const logs = await WebhookService.getLogs(id, limit)

    return NextResponse.json({
      success: true,
      data: logs
    })
  } catch (error) {
    console.error('[WEBHOOKS] Error obteniendo logs:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener logs',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

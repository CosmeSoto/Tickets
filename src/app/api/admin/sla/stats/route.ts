import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SLAService } from '@/lib/services/sla-service'

/**
 * GET /api/admin/sla/stats
 * Obtener estadísticas de cumplimiento SLA
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
    
    const filters: any = {}
    
    if (searchParams.get('startDate')) {
      filters.startDate = new Date(searchParams.get('startDate')!)
    }
    
    if (searchParams.get('endDate')) {
      filters.endDate = new Date(searchParams.get('endDate')!)
    }
    
    if (searchParams.get('categoryId')) {
      filters.categoryId = searchParams.get('categoryId')!
    }
    
    if (searchParams.get('priority')) {
      filters.priority = searchParams.get('priority')!
    }

    const stats = await SLAService.getStats(filters)

    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('[SLA] Error obteniendo estadísticas:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener estadísticas SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

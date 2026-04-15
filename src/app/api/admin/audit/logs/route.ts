import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN' || !(session.user as any).isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    const filters = {
      search: searchParams.get('search') || undefined,
      entityType: searchParams.get('entityType') === 'all' ? undefined : searchParams.get('entityType') || undefined,
      action: searchParams.get('action') || undefined,
      userId: searchParams.get('userId') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    }

    // Filtros de fecha
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const result = await AuditServiceComplete.getLogs({
      ...filters,
      startDate,
      action: filters.action ? filters.action : undefined
    })

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore
    })

  } catch (error) {
    console.error('[AUDIT API] Error fetching audit logs:', error)
    console.error('[AUDIT API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
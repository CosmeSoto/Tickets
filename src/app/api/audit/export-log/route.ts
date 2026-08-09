import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'

/**
 * POST /api/audit/export-log
 * Registra en el audit log la exportación de un reporte.
 * Requisitos: 6.6, 14.5, 14.7
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    }).catch(() => null)

    // Export-log de auditoría de sistema: Super Admin; reportes de inventario pueden ser admin
    // Si viene tab/familyId de inventario, permitir ADMIN; sin contexto sensible de audit UI, Super Admin
    const body = await request.json()
    const { action, format, familyId, tab } = body
    const isInventoryReport = typeof tab === 'string' && tab.length > 0

    if (!isInventoryReport) {
      const isSuper =
        (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true ||
        viewer?.isSuperAdmin === true
      if (!isSuper) {
        return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
      }
    }

    await AuditServiceComplete.log({
      action: action ?? 'REPORT_EXPORTED',
      entityType: 'report',
      userId: session.user.id,
      details: {
        format: format ?? 'csv',
        familyId: familyId ?? 'all',
        tab: tab ?? 'unknown',
        exportedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[POST /api/audit/export-log]', error)
    // Non-critical — return success anyway to not block the export
    return NextResponse.json({ success: true })
  }
}

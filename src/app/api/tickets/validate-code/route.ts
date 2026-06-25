import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TicketCodeService } from '@/lib/services/ticket-code.service'

// GET /api/tickets/validate-code?code=TI-2026-0001&familyId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const familyId = searchParams.get('familyId')

    if (!code || !familyId) {
      return NextResponse.json(
        { success: false, message: 'Los parámetros "code" y "familyId" son requeridos' },
        { status: 400 }
      )
    }

    const requesterIsSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    if (!requesterIsSuperAdmin) {
      const { adminCanOperateTicketFamily } = await import('@/lib/auth/family-scope')
      const allowed = await adminCanOperateTicketFamily(session.user.id, familyId, false)
      if (!allowed) {
        return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
      }
    }

    const result = await TicketCodeService.validateManualCode(code, familyId)

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[GET /api/tickets/validate-code]', error)
    return NextResponse.json(
      { success: false, message: 'Error al validar código' },
      { status: 500 }
    )
  }
}

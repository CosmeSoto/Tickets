import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TicketFamilyConfigService } from '@/lib/services/ticket-family-config.service'
import { invalidateCache } from '@/lib/api-cache'
import {
  canReadModuleFamilyConfig,
  canWriteModuleFamilyConfig,
  sanitizeTicketConfigBody,
} from '@/lib/auth/module-config-access'

// GET /api/families/[id]/ticket-config
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id: familyId } = await params
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    const canRead = await canReadModuleFamilyConfig(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      familyId,
      'tickets'
    )
    if (!canRead) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para ver esta configuración' },
        { status: 403 }
      )
    }

    const config = await TicketFamilyConfigService.getByFamilyId(familyId)

    if (!config) {
      return NextResponse.json(
        { success: false, message: 'Configuración de tickets no encontrada para esta familia' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('[GET /api/families/[id]/ticket-config]', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener configuración de tickets' },
      { status: 500 }
    )
  }
}

// PUT /api/families/[id]/ticket-config
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id: familyId } = await params
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    const canWrite = await canWriteModuleFamilyConfig(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      familyId,
      'tickets'
    )
    if (!canWrite) {
      return NextResponse.json(
        {
          success: false,
          message: 'No tienes permiso para modificar la configuración de tickets de esta familia',
        },
        { status: 403 }
      )
    }

    const rawBody = await request.json()
    const body = sanitizeTicketConfigBody(rawBody as Record<string, unknown>, isSuperAdmin)

    const updated = await TicketFamilyConfigService.update(familyId, body, session.user.id)

    try {
      await Promise.all([invalidateCache('user:modules:*'), invalidateCache('dashboard:*')])
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Configuración de tickets actualizada exitosamente',
    })
  } catch (error) {
    console.error('[PUT /api/families/[id]/ticket-config]', error)
    return NextResponse.json(
      { success: false, message: 'Error al actualizar configuración de tickets' },
      { status: 500 }
    )
  }
}

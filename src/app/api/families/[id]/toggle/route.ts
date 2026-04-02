import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FamilyService } from '@/lib/services/family.service'

// POST /api/families/[id]/toggle — Activa o desactiva la familia
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const updated = await FamilyService.toggleActive(id)

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Familia "${updated.name}" ${updated.isActive ? 'activada' : 'desactivada'} exitosamente`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al cambiar estado'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

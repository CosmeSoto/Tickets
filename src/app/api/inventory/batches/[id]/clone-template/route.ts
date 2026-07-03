import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { canAccessInventory } from '@/lib/navigation/role-home-path'

/**
 * GET /api/inventory/batches/[id]/clone-template
 * Devuelve plantilla para crear un lote similar.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!canAccessInventory(session.user)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { id } = await params

  try {
    const template = await BatchService.buildCloneTemplate(id)
    return NextResponse.json(template)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener plantilla'
    return NextResponse.json({ error: message }, { status: 404 })
  }
}

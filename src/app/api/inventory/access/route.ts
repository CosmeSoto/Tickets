import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'

/**
 * GET /api/inventory/access
 * Verifica si el usuario actual puede gestionar el inventario
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ canManage: false }, { status: 401 })
  }

  const canManage = await canManageInventory(session.user.id, session.user.role)
  return NextResponse.json({ canManage })
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAutoAssignmentEnabled, getMaxTicketsPerUser } from '@/lib/settings/runtime-settings'

/**
 * Config pública de tickets para la UI (staff autenticado).
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'TECHNICIAN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const [autoAssignmentEnabled, maxTicketsPerUser] = await Promise.all([
    getAutoAssignmentEnabled(),
    getMaxTicketsPerUser(),
  ])

  return NextResponse.json(
    { autoAssignmentEnabled, maxTicketsPerUser },
    { headers: { 'Cache-Control': 'private, max-age=60' } }
  )
}

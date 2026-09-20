/**
 * GET /api/admin/planner/groups
 * Lista los grupos de Microsoft 365 (no de seguridad) de los que la cuenta
 * conectada es miembro — para elegir en qué grupo vive el Plan de Planner.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertCanManagePlanner } from '@/lib/planner/access'
import { PlannerGraphService } from '@/lib/services/planner-graph-service'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManagePlanner(session.user.id, session.user.role)
  if (denied) return denied

  try {
    const accessToken = await PlannerGraphService.getAccessToken()
    const groups = await PlannerGraphService.listGroups(accessToken)
    return NextResponse.json({ groups })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error listando grupos de Microsoft 365' },
      { status: 502 }
    )
  }
}

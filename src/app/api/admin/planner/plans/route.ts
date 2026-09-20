/**
 * GET /api/admin/planner/plans?groupId=...
 * Lista los planes de Planner del grupo elegido.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertCanManagePlanner } from '@/lib/planner/access'
import { PlannerGraphService } from '@/lib/services/planner-graph-service'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManagePlanner(session.user.id, session.user.role)
  if (denied) return denied

  const groupId = request.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'Falta groupId' }, { status: 400 })

  try {
    const accessToken = await PlannerGraphService.getAccessToken()
    const plans = await PlannerGraphService.listPlans(accessToken, groupId)
    return NextResponse.json({ plans })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error listando planes de Planner' },
      { status: 502 }
    )
  }
}

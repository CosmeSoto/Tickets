import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'
import { assertCanManagePlanner } from '@/lib/planner/access'
import { getPlannerModuleSettings, setPlannerModuleSettings } from '@/lib/planner/settings'

const schema = z.object({
  enabled: z.boolean().optional(),
  groupId: z.string().trim().optional(),
  planId: z.string().trim().optional(),
  syncDirection: z.enum(['outbound', 'bidirectional']).optional(),
})

function canWriteSettings(session: { user?: { role?: string; isSuperAdmin?: boolean } } | null) {
  return session?.user?.role === 'ADMIN' && session.user.isSuperAdmin === true
}

/** Gestores del módulo leen la configuración; solo Super Admin la escribe (misma
 * política que /api/admin/processes/settings — la conexión OAuth es global). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManagePlanner(session.user.id, session.user.role)
  if (denied) return denied

  const settings = await getPlannerModuleSettings()
  const tokenSetting = await prisma.system_settings.findUnique({
    where: { key: 'plannerMicrosoftRefreshToken' },
  })

  return NextResponse.json({
    settings,
    connected: !!tokenSetting?.value,
    canWrite: canWriteSettings(session),
  })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canWriteSettings(session)) {
    return NextResponse.json(
      { error: 'Solo Super Admin puede configurar la sincronización con Planner.' },
      { status: 403 }
    )
  }
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Configuración inválida.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  await setPlannerModuleSettings(parsed.data)
  await invalidateCache('admin:settings')

  const settings = await getPlannerModuleSettings()
  return NextResponse.json({ success: true, settings })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'
import { randomUUID } from 'crypto'
import { assertCanManageProcesses } from '@/lib/processes/access'
import { getProcessModuleSettings } from '@/lib/processes/settings'

const schema = z.object({
  macroPrefix: z.string().trim().min(1).max(12),
  processPrefix: z.string().trim().min(1).max(12),
  procedurePrefix: z.string().trim().min(1).max(12),
  defaultReviewMonths: z.number().int().min(1).max(60),
  requireExternalDpdForCritical: z.boolean(),
})

function canWriteSettings(session: { user?: { role?: string; isSuperAdmin?: boolean } } | null) {
  return session?.user?.role === 'ADMIN' && session.user.isSuperAdmin === true
}

/** Gestores leen defaults (p. ej. meses de revisión); solo Super Admin escribe. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const settings = await getProcessModuleSettings()
  return NextResponse.json({ settings, canWrite: canWriteSettings(session) })
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!canWriteSettings(session)) {
    return NextResponse.json(
      { error: 'Solo Super Admin puede configurar Procesos.' },
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
  await prisma.$transaction(
    Object.entries(parsed.data).map(([key, value]) =>
      prisma.system_settings.upsert({
        where: { key: `processes.${key}` },
        update: { value: String(value), updatedAt: new Date() },
        create: {
          id: randomUUID(),
          key: `processes.${key}`,
          value: String(value),
          description: 'Configuración del módulo Procesos y Procedimientos',
          updatedAt: new Date(),
        },
      })
    )
  )
  await invalidateCache('admin:settings')
  return NextResponse.json({ success: true, settings: parsed.data })
}

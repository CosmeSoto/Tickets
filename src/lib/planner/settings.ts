import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export const PLANNER_SETTINGS_DEFAULTS = {
  enabled: false,
  groupId: '',
  planId: '',
  /** Fase 1 = solo app→Planner. Se deja el campo listo para la Fase 2 (bidireccional). */
  syncDirection: 'outbound' as 'outbound' | 'bidirectional',
} as const

export type PlannerModuleSettings = {
  enabled: boolean
  groupId: string
  planId: string
  syncDirection: 'outbound' | 'bidirectional'
}

export async function getPlannerModuleSettings(): Promise<PlannerModuleSettings> {
  const keys = ['enabled', 'groupId', 'planId', 'syncDirection'].map(key => `planner.${key}`)
  const rows = await prisma.system_settings.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  })

  const values: PlannerModuleSettings = { ...PLANNER_SETTINGS_DEFAULTS }
  for (const row of rows) {
    const key = row.key.replace('planner.', '') as keyof PlannerModuleSettings
    if (key === 'enabled') values.enabled = row.value === 'true'
    else if (key === 'groupId' || key === 'planId') values[key] = row.value
    else if (key === 'syncDirection') {
      values.syncDirection = row.value === 'bidirectional' ? 'bidirectional' : 'outbound'
    }
  }
  return values
}

export async function setPlannerModuleSettings(
  patch: Partial<PlannerModuleSettings>
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.system_settings.upsert({
        where: { key: `planner.${key}` },
        update: { value: String(value), updatedAt: new Date() },
        create: {
          id: randomUUID(),
          key: `planner.${key}`,
          value: String(value),
          description: 'Configuración del módulo de Tareas / Microsoft Planner',
          updatedAt: new Date(),
        },
      })
    )
  )
}

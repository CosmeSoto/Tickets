import prisma from '@/lib/prisma'

export const PROCESS_SETTINGS_DEFAULTS = {
  macroPrefix: 'MP',
  processPrefix: 'PR',
  procedurePrefix: 'FO',
  defaultReviewMonths: 12,
  requireExternalDpdForCritical: false,
} as const

export type ProcessModuleSettings = {
  macroPrefix: string
  processPrefix: string
  procedurePrefix: string
  defaultReviewMonths: number
  requireExternalDpdForCritical: boolean
}

export async function getProcessModuleSettings(): Promise<ProcessModuleSettings> {
  const keys = Object.keys(PROCESS_SETTINGS_DEFAULTS).map(key => `processes.${key}`)
  const rows = await prisma.system_settings.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true },
  })

  const values: ProcessModuleSettings = { ...PROCESS_SETTINGS_DEFAULTS }
  for (const row of rows) {
    const key = row.key.replace('processes.', '') as keyof ProcessModuleSettings
    if (key === 'defaultReviewMonths') {
      values.defaultReviewMonths =
        Number(row.value) || PROCESS_SETTINGS_DEFAULTS.defaultReviewMonths
    } else if (key === 'requireExternalDpdForCritical') {
      values.requireExternalDpdForCritical = row.value === 'true'
    } else if (key === 'macroPrefix' || key === 'processPrefix' || key === 'procedurePrefix') {
      values[key] = row.value
    }
  }
  return values
}

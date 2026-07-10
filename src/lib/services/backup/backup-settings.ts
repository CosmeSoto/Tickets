import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export const BACKUP_ALLOW_RESTORE_KEY = 'backupAllowRestore'
export const BACKUP_HIDDEN_PGBR_LABELS_KEY = 'backupHiddenPgBackRestLabels'

/** Restauración pgBackRest habilitada desde Admin → Backups → Config (system_settings). */
export async function isPgBackRestRestoreAllowed(): Promise<boolean> {
  const setting = await prisma.system_settings.findUnique({
    where: { key: BACKUP_ALLOW_RESTORE_KEY },
  })

  return setting?.value === 'true'
}

export async function getHiddenPgBackRestLabels(): Promise<Set<string>> {
  const setting = await prisma.system_settings.findUnique({
    where: { key: BACKUP_HIDDEN_PGBR_LABELS_KEY },
  })

  if (!setting?.value) return new Set()

  try {
    const parsed = JSON.parse(setting.value)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((label): label is string => typeof label === 'string'))
  } catch {
    return new Set()
  }
}

export async function hidePgBackRestLabel(label: string): Promise<void> {
  if (!label.trim()) return

  const hidden = await getHiddenPgBackRestLabels()
  hidden.add(label)

  await prisma.system_settings.upsert({
    where: { key: BACKUP_HIDDEN_PGBR_LABELS_KEY },
    update: { value: JSON.stringify([...hidden]), updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: BACKUP_HIDDEN_PGBR_LABELS_KEY,
      value: JSON.stringify([label]),
      description: 'Etiquetas pgBackRest ocultas del historial UI',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

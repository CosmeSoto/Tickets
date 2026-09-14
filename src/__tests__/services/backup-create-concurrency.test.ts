/**
 * BackupService.createBackup — guard de concurrencia
 *
 * Ni el POST manual (`POST /api/admin/backups`) ni el cron
 * (`BackupScheduler.run`) verificaban si ya había un backup `in_progress`
 * antes de disparar uno nuevo. Un doble clic del mismo Super Admin, o el cron
 * solapándose con un backup manual en curso, lanzaban dos
 * `pg_dump`/exportaciones en paralelo. Fix: `createBackup` reconcilia
 * primero los registros `in_progress` obsoletos (evita un deadlock
 * permanente por un proceso caído a medias) y luego bloquea con un mensaje
 * claro si sigue habiendo uno genuinamente en curso.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    backups: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/services/backup/backup-cleanup', () => ({
  reconcileStaleBackupRecords: jest.fn().mockResolvedValue({ fixed: 0, removed: 0 }),
  cleanOldBackups: jest.fn().mockResolvedValue(undefined),
}))

import prisma from '@/lib/prisma'
import { reconcileStaleBackupRecords } from '@/lib/services/backup/backup-cleanup'
import { createBackup } from '@/lib/services/backup/backup-create'

describe('createBackup — guard de concurrencia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: si ya hay un backup in_progress, rechaza antes de tocar nada más', async () => {
    ;(prisma.backups.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-in-progress' })

    await expect(createBackup('manual', { mode: 'module', module: 'tickets' })).rejects.toThrow(
      'Ya hay un backup en curso'
    )

    expect(reconcileStaleBackupRecords).toHaveBeenCalledTimes(1)
  })

  it('reconcilia registros obsoletos ANTES de chequear (un in_progress muerto no bloquea para siempre)', async () => {
    ;(prisma.backups.findFirst as jest.Mock).mockResolvedValue(null)

    // Sin `module`, la validación específica de modo 'module' es lo próximo
    // que corre tras pasar el guard — confirma que el guard no bloqueó.
    await expect(createBackup('manual', { mode: 'module' })).rejects.toThrow(
      'Debe indicar un módulo válido'
    )

    expect(reconcileStaleBackupRecords).toHaveBeenCalledTimes(1)
    const reconcileOrder = (reconcileStaleBackupRecords as jest.Mock).mock.invocationCallOrder[0]
    const findFirstOrder = (prisma.backups.findFirst as jest.Mock).mock.invocationCallOrder[0]
    expect(reconcileOrder).toBeLessThan(findFirstOrder)
  })
})

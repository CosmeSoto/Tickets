import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'
import { isBackupModuleId } from '@/lib/services/backup-modules'
import type { RestoreMode } from '@/lib/services/backup/backup-restore'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const backupId = (await params).id

    if (!backupId) {
      return NextResponse.json({ error: 'ID de backup requerido' }, { status: 400 })
    }

    // Leer el body para obtener los módulos opcionales y el modo de restauración
    let restoreModules: string[] | undefined
    let mode: RestoreMode = 'replace'
    let pitrTarget: string | undefined

    try {
      const body = await request.json()

      // Soportar array de módulos (nuevo) o módulo único (legacy)
      if (Array.isArray(body.modules) && body.modules.length > 0) {
        const validModules = body.modules.filter(
          (m: unknown) => typeof m === 'string' && isBackupModuleId(m)
        )
        if (validModules.length > 0) {
          restoreModules = validModules
        }
      } else if (body.module && isBackupModuleId(body.module)) {
        restoreModules = [body.module]
      }

      // Modo de restauración: 'replace' (por defecto) o 'merge'
      if (body.mode === 'merge') {
        mode = 'merge'
      }

      pitrTarget = typeof body.pitrTarget === 'string' ? body.pitrTarget : undefined
    } catch {
      // Body vacío — restauración completa
    }

    await BackupService.restoreBackup(backupId, restoreModules, mode, { pitrTarget })

    const scopeLabel = restoreModules ? `módulo(s): ${restoreModules.join(', ')}` : 'completa'
    const modeLabel = mode === 'merge' ? ' (modo fusión)' : ''
    return NextResponse.json({
      success: true,
      message: `Restauración ${scopeLabel}${modeLabel} completada correctamente`,
    })
  } catch (error) {
    console.error('Error restoring backup:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al restaurar backup'

    const isRestoreDisabled =
      errorMessage.includes('Restauración pgBackRest deshabilitada') ||
      errorMessage.includes('Restauración bloqueada')

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: isRestoreDisabled ? 403 : 500 }
    )
  }
}

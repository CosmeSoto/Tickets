import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'
import { isBackupModuleId } from '@/lib/services/backup-modules'

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

    // Leer el body para obtener los módulos opcionales
    let restoreModules: string[] | undefined
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
    } catch {
      // Body vacío o no JSON — restauración completa
    }

    // Ejecutar restauración
    await BackupService.restoreBackup(backupId, restoreModules)

    const scopeLabel = restoreModules ? `módulo(s): ${restoreModules.join(', ')}` : 'completa'
    return NextResponse.json({
      success: true,
      message: `Restauración ${scopeLabel} completada correctamente`,
    })
  } catch (error) {
    console.error('Error restoring backup:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Error desconocido al restaurar backup'

    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

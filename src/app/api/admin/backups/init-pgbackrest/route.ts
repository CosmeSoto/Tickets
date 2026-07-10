import { NextResponse } from 'next/server'
import { getBackupWorkerHealth, initPgBackRestWorker } from '@/lib/services/backup/backup-engine'
import { requireBackupSuperAdmin } from '../_auth'

export async function POST() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const before = await getBackupWorkerHealth()
    if (before.status === 'healthy' && before.stanzaOk) {
      return NextResponse.json({
        success: true,
        alreadyInitialized: true,
        health: before,
      })
    }

    const result = await initPgBackRestWorker()

    let after = await getBackupWorkerHealth()
    if (result.success && !after.stanzaOk) {
      for (let i = 0; i < 18; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        after = await getBackupWorkerHealth()
        if (after.stanzaOk) break
      }
    }

    let message: string
    if (after.stanzaOk) {
      message = result.needsPostgresRestart
        ? 'Bootstrap completado — pulsa Inicializar de nuevo en unos segundos'
        : 'pgBackRest inicializado correctamente'
    } else if (result.needsPostgresRestart) {
      message = 'Bootstrap parcial — espera 30 s y pulsa Inicializar de nuevo'
    } else {
      message = 'Inicialización incompleta — revisa logs del backup-worker'
    }

    return NextResponse.json({
      success: result.success,
      needsPostgresRestart: result.needsPostgresRestart,
      stanzaOk: after.stanzaOk,
      health: after,
      message,
    })
  } catch (error) {
    console.error('Error al inicializar pgBackRest:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error al inicializar pgBackRest',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const health = await getBackupWorkerHealth()
    return NextResponse.json({ health })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al consultar pgBackRest' },
      { status: 500 }
    )
  }
}

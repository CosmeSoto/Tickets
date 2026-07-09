import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getBackupWorkerHealth, initPgBackRestWorker } from '@/lib/services/backup/backup-engine'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const before = await getBackupWorkerHealth()
    if (before.status === 'healthy' && before.stanzaOk) {
      return NextResponse.json({
        success: true,
        alreadyInitialized: true,
        health: before,
      })
    }

    const result = await initPgBackRestWorker()
    const after = await getBackupWorkerHealth()

    return NextResponse.json({
      success: result.success,
      stanzaOk: after.stanzaOk,
      health: after,
      message: after.stanzaOk
        ? 'pgBackRest inicializado correctamente'
        : 'Inicialización incompleta — revisa logs del backup-worker',
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
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const health = await getBackupWorkerHealth()
    return NextResponse.json({ health })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al consultar pgBackRest' },
      { status: 500 }
    )
  }
}

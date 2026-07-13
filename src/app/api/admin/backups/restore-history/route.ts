import { NextResponse } from 'next/server'
import { getPgBackRestRestoreStatus } from '@/lib/services/backup/backup-engine'
import {
  getBackupOperationsHistory,
  mergeWorkerJobIntoHistory,
} from '@/lib/services/backup/backup-restore-events'
import { requireBackupSuperAdmin } from '../_auth'

export async function GET() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const [operations, workerStatus] = await Promise.all([
      getBackupOperationsHistory(20),
      getPgBackRestRestoreStatus().catch(() => ({
        job: {
          status: 'idle' as const,
          message: null,
          label: null,
          startedAt: null,
          finishedAt: null,
        },
      })),
    ])

    const history = mergeWorkerJobIntoHistory(operations, workerStatus.job)

    return NextResponse.json({
      history,
      operations: history,
      activeJob: workerStatus.job.status === 'running' ? workerStatus.job : null,
    })
  } catch (error) {
    console.error('Error fetching backup operations history:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo consultar el historial de operaciones de backup',
      },
      { status: 500 }
    )
  }
}

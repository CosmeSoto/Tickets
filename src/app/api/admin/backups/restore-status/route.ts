import { NextResponse } from 'next/server'
import { getPgBackRestRestoreStatus } from '@/lib/services/backup/backup-engine'
import { syncPgBackRestRestoreAudit } from '@/lib/services/backup/backup-restore-events'
import { requireBackupSuperAdmin } from '../_auth'

export async function GET() {
  try {
    const { session, errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const status = await getPgBackRestRestoreStatus()
    const auditResult = await syncPgBackRestRestoreAudit(status.job, {
      userId: session?.user?.id,
      userEmail: session?.user?.email ?? null,
    })
    return NextResponse.json({ ...status, auditSynced: auditResult })
  } catch (error) {
    console.error('Error fetching restore status:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'No se pudo consultar el estado de restauración',
      },
      { status: 500 }
    )
  }
}

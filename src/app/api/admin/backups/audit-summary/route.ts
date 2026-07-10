import { NextResponse } from 'next/server'
import { buildBackupAuditSummary } from '@/lib/services/backup/backup-audit'
import { requireBackupSuperAdmin } from '../_auth'

export async function GET() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const summary = await buildBackupAuditSummary()
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[BACKUP AUDIT]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar resumen de auditoría' },
      { status: 500 }
    )
  }
}

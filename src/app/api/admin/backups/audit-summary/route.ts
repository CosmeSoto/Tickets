import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildBackupAuditSummary } from '@/lib/services/backup/backup-audit'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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

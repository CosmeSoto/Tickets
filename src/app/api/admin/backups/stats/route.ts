import { NextResponse } from 'next/server'
import { BackupService } from '@/lib/services/backup-service'
import { requireBackupSuperAdmin } from '../_auth'

export async function GET() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const stats = await BackupService.getBackupStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error al obtener estadísticas de backup:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const stats = await BackupService.getBackupStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error al obtener estadísticas de backup:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

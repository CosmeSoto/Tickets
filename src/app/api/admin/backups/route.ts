import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const backups = await BackupService.listBackups()
    return NextResponse.json(backups)
  } catch (error) {
    console.error('Error al obtener backups:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { type = 'manual' } = body

    const backup = await BackupService.createBackup(type)
    return NextResponse.json(backup)
  } catch (error) {
    console.error('Error al crear backup:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear backup' },
      { status: 500 }
    )
  }
}

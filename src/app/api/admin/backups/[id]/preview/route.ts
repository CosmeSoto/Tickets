import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const backupId = (await params).id

    if (!backupId) {
      return NextResponse.json({ error: 'ID de backup requerido' }, { status: 400 })
    }

    const preview = await BackupService.getBackupPreview(backupId)

    return NextResponse.json({
      success: true,
      data: preview,
    })
  } catch (error) {
    console.error('Error generating backup preview:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al generar preview del backup',
      },
      { status: 500 }
    )
  }
}

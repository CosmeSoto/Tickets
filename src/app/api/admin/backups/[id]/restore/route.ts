import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const backupId = (await params).id
    
    if (!backupId) {
      return NextResponse.json({ error: 'ID de backup requerido' }, { status: 400 })
    }

    // Ejecutar restauración usando el BackupService
    await BackupService.restoreBackup(backupId)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Backup restaurado correctamente' 
    })
    
  } catch (error) {
    console.error('Error restoring backup:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al restaurar backup'
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
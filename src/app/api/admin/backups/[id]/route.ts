import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'
import prisma from '@/lib/prisma'

export async function GET(
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

    const backup = await prisma.backups.findUnique({
      where: { id: backupId },
    })

    if (!backup) {
      return NextResponse.json({ error: 'Backup no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ 
      success: true, 
      data: backup 
    })
  } catch (error) {
    console.error('Error al obtener backup:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error al obtener backup',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Verificar si el backup existe antes de intentar eliminarlo
    const existingBackup = await prisma.backups.findUnique({
      where: { id: backupId },
    })

    if (!existingBackup) {
      // Si el backup no existe, retornar éxito (idempotente)
      return NextResponse.json({ 
        success: true, 
        message: 'Backup ya fue eliminado previamente',
        alreadyDeleted: true
      })
    }

    await BackupService.deleteBackup(backupId)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Backup eliminado correctamente' 
    })
  } catch (error) {
    console.error('Error al eliminar backup:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido al eliminar backup'
    
    // Si el error es que el backup no existe, tratarlo como éxito
    if (errorMessage.includes('no encontrado') || errorMessage.includes('not found')) {
      return NextResponse.json({ 
        success: true, 
        message: 'Backup ya fue eliminado previamente',
        alreadyDeleted: true
      })
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

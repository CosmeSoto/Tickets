import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BackupService } from '@/lib/services/backup-service'

export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 })
    }

    const allowedExtensions = ['.sql', '.sql.gz', '.json', '.json.gz', '.enc']
    const filename = file.name.toLowerCase()
    const isValidExtension = allowedExtensions.some(ext => filename.endsWith(ext))

    if (!isValidExtension) {
      return NextResponse.json(
        {
          error:
            'Formato de archivo no válido. Use .sql, .sql.gz, .json, .json.gz o .enc (cifrado)',
        },
        { status: 400 }
      )
    }

    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 500MB' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const backup = await BackupService.importBackupFromFile(buffer, file.name)

    return NextResponse.json(backup)
  } catch (error) {
    console.error('Error al importar backup:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

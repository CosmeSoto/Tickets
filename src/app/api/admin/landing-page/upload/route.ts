import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const superCheck = await (await import('@/lib/auth/require-super-admin')).requireSuperAdmin(session)
    if (!superCheck.ok) {
      return NextResponse.json({ error: superCheck.error }, { status: superCheck.status })
    }

    // Obtener configuración del sistema
    const maxFileSizeSetting = await prisma.system_settings.findFirst({
      where: { key: 'maxFileSize' },
    })
    const maxFileSize = maxFileSizeSetting ? parseInt(maxFileSizeSetting.value) : 10 // Default 10MB

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string // 'logo-light', 'logo-dark', 'hero-bg'

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo JPG, PNG, WebP y SVG' },
        { status: 400 }
      )
    }

    // Validar tamaño usando configuración del sistema
    const maxSizeBytes = maxFileSize * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `Archivo muy grande. Máximo ${maxFileSize}MB` },
        { status: 400 }
      )
    }

    // Crear directorio si no existe
    const uploadDir = getUploadDir('landing')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generar nombre único
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `${type}-${timestamp}.${extension}`
    const filepath = getUploadDir('landing', filename)

    // Guardar archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Retornar URL pública — servida via /api/uploads/
    const publicUrl = `/api/uploads/landing/${filename}`

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { writeFile, unlink } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session) {
      return NextResponse.json({ 
        success: false,
        error: 'No autorizado' 
      }, { status: 401 })
    }

    // Solo el propio usuario o un admin puede cambiar el avatar
    if (session.user.id !== id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        success: false,
        error: 'No tienes permisos para realizar esta acción' 
      }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json({ 
        success: false,
        error: 'No se proporcionó ningún archivo' 
      }, { status: 400 })
    }

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ 
        success: false,
        error: 'El archivo debe ser una imagen válida (JPG, PNG, GIF, WebP)' 
      }, { status: 400 })
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false,
        error: 'La imagen debe ser menor a 5MB' 
      }, { status: 400 })
    }

    // Verificar que el usuario existe
    const user = await prisma.users.findUnique({
      where: { id }
    })

    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Usuario no encontrado' 
      }, { status: 404 })
    }

    // Crear directorio de avatares si no existe
    const uploadsDir = getUploadDir('avatars')
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true })
    }

    // Generar nombre único para el archivo
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()?.toLowerCase()
    const filename = `${id}-${timestamp}.${extension}`
    const filepath = getUploadDir('avatars', filename)

    // Eliminar avatar anterior si existe
    if (user.avatar) {
      // avatar es /uploads/avatars/... → extraer relativo
      const relative = user.avatar.replace(/^\/uploads\//, '')
      const oldAvatarPath = getUploadDir(relative)
      try {
        if (existsSync(oldAvatarPath)) {
          await unlink(oldAvatarPath)
        }
      } catch {
        // ignorar
      }
    }

    // Guardar el nuevo archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Actualizar la base de datos
    const avatarUrl = `/uploads/avatars/${filename}`
    const updatedUser = await prisma.users.update({
      where: { id },
      data: { 
        avatar: avatarUrl,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      data: {
        avatarUrl,
        user: updatedUser
      }
    })

  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor al subir el avatar'
    }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const { id } = await params

    if (!session) {
      return NextResponse.json({ 
        success: false,
        error: 'No autorizado' 
      }, { status: 401 })
    }

    // Solo el propio usuario o un admin puede eliminar el avatar
    if (session.user.id !== id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ 
        success: false,
        error: 'No tienes permisos para realizar esta acción' 
      }, { status: 403 })
    }

    // Verificar que el usuario existe
    const user = await prisma.users.findUnique({
      where: { id }
    })

    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Usuario no encontrado' 
      }, { status: 404 })
    }

    // Eliminar archivo del servidor si existe
    if (user.avatar) {
      const relative = user.avatar.replace(/^\/uploads\//, '')
      const avatarPath = getUploadDir(relative)
      try {
        if (existsSync(avatarPath)) {
          await unlink(avatarPath)
        }
      } catch {
        // ignorar
      }
    }

    // Actualizar la base de datos
    const updatedUser = await prisma.users.update({
      where: { id },
      data: { 
        avatar: null,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Avatar eliminado exitosamente',
      data: {
        user: updatedUser
      }
    })

  } catch (error) {
    console.error('Error deleting avatar:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno del servidor al eliminar el avatar'
    }, { status: 500 })
  }
}

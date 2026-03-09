import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface UploadFileData {
  file: File
  ticketId: string
  uploadedBy: string
}

export interface FileValidationResult {
  isValid: boolean
  error?: string
}

export class FileService {
  private static readonly UPLOAD_DIR = join(process.cwd(), 'uploads')
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  private static readonly ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]

  static async validateFile(file: File): Promise<FileValidationResult> {
    // Validar tamaño
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        isValid: false,
        error: `El archivo es muy grande. Máximo permitido: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      }
    }

    // Validar tipo MIME
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error:
          'Tipo de archivo no permitido. Tipos permitidos: imágenes, PDF, documentos de Office, texto plano',
      }
    }

    // Validar nombre del archivo
    if (file.name.length > 255) {
      return {
        isValid: false,
        error: 'El nombre del archivo es muy largo',
      }
    }

    return { isValid: true }
  }

  static async uploadFile(data: UploadFileData) {
    const { file, ticketId, uploadedBy } = data

    // Validar archivo
    const validation = await this.validateFile(file)
    if (!validation.isValid) {
      throw new Error(validation.error)
    }

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
    })

    if (!ticket) {
      throw new Error('Ticket no encontrado')
    }

    // Generar nombre único para el archivo
    const fileExtension = file.name.split('.').pop()
    const uniqueFilename = `${randomUUID()}.${fileExtension}`
    const filePath = join(this.UPLOAD_DIR, uniqueFilename)

    try {
      // Crear directorio si no existe
      await mkdir(this.UPLOAD_DIR, { recursive: true })

      // Guardar archivo
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Guardar información en base de datos
      const attachment = await prisma.attachments.create({
        data: {
          id: randomUUID(),
          filename: uniqueFilename,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          path: filePath,
          ticketId,
          uploadedBy,
          createdAt: new Date(),
        },
      })

      // Crear entrada en el historial
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'file_uploaded',
          comment: `Archivo subido: ${file.name}`,
          ticketId,
          userId: uploadedBy,
          createdAt: new Date()
        },
      })

      return attachment
    } catch (error) {
      console.error('[CRITICAL] Error al subir archivo:', error)
      throw new Error('Error al guardar el archivo')
    }
  }

  static async getFilesByTicket(ticketId: string) {
    const attachments = await prisma.attachments.findMany({
      where: { ticketId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        path: true,
        ticketId: true,
        uploadedBy: true,
        createdAt: true,
        users: {
          select: { 
            id: true, 
            name: true, 
            role: true 
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Formatear respuesta para mantener compatibilidad con el frontend
    return attachments.map(attachment => ({
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      path: attachment.path,
      ticketId: attachment.ticketId,
      uploadedBy: attachment.uploadedBy,
      createdAt: attachment.createdAt,
      uploader: attachment.users || { 
        id: attachment.uploadedBy, 
        name: 'Usuario desconocido', 
        role: 'CLIENT' 
      },
    }))
  }

  static async deleteFile(fileId: string, userId: string) {
    const attachment = await prisma.attachments.findUnique({
      where: { id: fileId },
      include: { tickets: true },
    })

    if (!attachment) {
      throw new Error('Archivo no encontrado')
    }

    try {
      // Eliminar archivo físico
      const fs = require('fs').promises
      await fs.unlink(attachment.path)
    } catch (error) {
      console.warn('No se pudo eliminar el archivo físico:', error)
    }

    // Eliminar registro de base de datos
    await prisma.attachments.delete({
      where: { id: fileId },
    })

    // Crear entrada en el historial
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        action: 'file_deleted',
        comment: `Archivo eliminado: ${attachment.originalName}`,
        ticketId: attachment.ticketId,
        userId,
        createdAt: new Date()
      },
    })

    return { success: true }
  }

  static async downloadFile(fileId: string) {
    const attachment = await prisma.attachments.findUnique({
      where: { id: fileId },
    })

    if (!attachment) {
      throw new Error('Archivo no encontrado')
    }

    return {
      path: attachment.path,
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
    }
  }

  static async getFile(fileId: string) {
    const attachment = await prisma.attachments.findUnique({
      where: { id: fileId },
    })

    if (!attachment) {
      throw new Error('Archivo no encontrado')
    }

    try {
      const fs = require('fs').promises
      const buffer = await fs.readFile(attachment.path)
      
      return {
        buffer,
        filename: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size
      }
    } catch (error) {
      console.error('Error al leer archivo:', error)
      throw new Error('No se pudo leer el archivo')
    }
  }

  static getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊'
    if (mimeType.startsWith('text/')) return '📄'
    return '📎'
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

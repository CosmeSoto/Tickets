/**
 * FileService — Servicio centralizado de gestión de archivos adjuntos
 *
 * Estrategia de almacenamiento:
 *   uploads/
 *     tickets/
 *       {ticketId}/
 *         {uuid}.{ext}          ← archivos de tickets
 *     equipment/
 *       {equipmentId}/
 *         {uuid}.{ext}          ← adjuntos de equipos
 *     avatars/
 *       {uuid}.{ext}            ← avatares de usuarios
 *     landing/
 *       {uuid}.{ext}            ← imágenes de la página pública
 *     delivery-acts/            ← PDFs de actas de entrega
 *     return-acts/              ← PDFs de actas de devolución
 *
 * Compresión automática de imágenes:
 *   - JPEG/JPG: recomprimido a calidad 82, máx 1920px ancho
 *   - PNG: convertido a WebP calidad 85, máx 1920px ancho
 *   - WebP: recomprimido a calidad 85, máx 1920px ancho
 *   - GIF, PDF, Office: sin compresión (se guardan tal cual)
 *
 * Cuotas:
 *   - Máx 10MB por archivo (antes de compresión)
 *   - Máx 10 archivos por ticket
 *   - Máx 50MB de almacenamiento total por ticket
 */

import prisma from '@/lib/prisma'
import { writeFile, mkdir, unlink, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { getUploadDir } from '@/lib/upload-path'

// ─── Constantes ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024   // 10 MB por archivo
const MAX_FILES_PER_TICKET = 10                 // máx archivos por ticket
const MAX_STORAGE_PER_TICKET = 50 * 1024 * 1024 // 50 MB total por ticket
const IMAGE_MAX_WIDTH = 1920                    // px — ancho máximo tras compresión
const IMAGE_JPEG_QUALITY = 82                   // calidad JPEG (0-100)
const IMAGE_WEBP_QUALITY = 85                   // calidad WebP (0-100)

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface UploadFileData {
  file: File
  ticketId: string
  uploadedBy: string
  skipHistory?: boolean
}

export interface FileValidationResult {
  isValid: boolean
  error?: string
}

export interface UploadStats {
  originalSize: number
  finalSize: number
  compressed: boolean
  savedBytes: number
  savedPercent: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Comprime una imagen usando sharp si está disponible.
 * Devuelve el buffer comprimido y la extensión final.
 */
async function compressImage(
  buffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<{ buffer: Buffer; ext: string; compressed: boolean }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = require('sharp') as typeof import('sharp')

    let pipeline = sharp(buffer).resize({
      width: IMAGE_MAX_WIDTH,
      withoutEnlargement: true, // no ampliar imágenes pequeñas
    })

    let ext: string
    if (mimeType === 'image/png') {
      // PNG → WebP (mejor compresión, soporte universal moderno)
      pipeline = pipeline.webp({ quality: IMAGE_WEBP_QUALITY })
      ext = 'webp'
    } else if (mimeType === 'image/webp') {
      pipeline = pipeline.webp({ quality: IMAGE_WEBP_QUALITY })
      ext = 'webp'
    } else {
      // JPEG / JPG
      pipeline = pipeline.jpeg({ quality: IMAGE_JPEG_QUALITY, progressive: true })
      ext = 'jpg'
    }

    const compressed = await pipeline.toBuffer()
    return { buffer: compressed, ext, compressed: true }
  } catch {
    // Si sharp falla (ej: GIF animado), guardar original
    const ext = originalName.split('.').pop()?.toLowerCase() || 'bin'
    return { buffer, ext, compressed: false }
  }
}

// ─── FileService ───────────────────────────────────────────────────────────────

export class FileService {
  // ── Validación ──────────────────────────────────────────────────────────────

  static async validateFile(file: File): Promise<FileValidationResult> {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        isValid: false,
        error: `El archivo supera el límite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      }
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: 'Tipo de archivo no permitido. Se aceptan: imágenes, PDF, documentos Office y texto plano',
      }
    }

    if (file.name.length > 255) {
      return { isValid: false, error: 'El nombre del archivo es demasiado largo' }
    }

    return { isValid: true }
  }

  // ── Cuotas por ticket ────────────────────────────────────────────────────────

  static async checkTicketQuota(ticketId: string): Promise<{ ok: boolean; error?: string }> {
    const existing = await prisma.attachments.findMany({
      where: { ticketId },
      select: { size: true },
    })

    if (existing.length >= MAX_FILES_PER_TICKET) {
      return {
        ok: false,
        error: `El ticket ya tiene ${MAX_FILES_PER_TICKET} archivos adjuntos (límite máximo)`,
      }
    }

    const totalSize = existing.reduce((sum, a) => sum + a.size, 0)
    if (totalSize >= MAX_STORAGE_PER_TICKET) {
      const usedMB = (totalSize / (1024 * 1024)).toFixed(1)
      return {
        ok: false,
        error: `El ticket ha alcanzado el límite de almacenamiento (${usedMB}MB / ${MAX_STORAGE_PER_TICKET / (1024 * 1024)}MB)`,
      }
    }

    return { ok: true }
  }

  // ── Upload principal ─────────────────────────────────────────────────────────

  static async uploadFile(data: UploadFileData) {
    const { file, ticketId, uploadedBy, skipHistory = false } = data

    // 1. Validar archivo
    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    // 2. Verificar cuota del ticket
    const quota = await this.checkTicketQuota(ticketId)
    if (!quota.ok) throw new Error(quota.error)

    // 3. Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({ where: { id: ticketId } })
    if (!ticket) throw new Error('Ticket no encontrado')

    // 4. Leer buffer original
    const originalBuffer = Buffer.from(await file.arrayBuffer())
    const originalSize = originalBuffer.length

    // 5. Comprimir si es imagen comprimible
    let finalBuffer = originalBuffer
    let finalExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
    let compressed = false

    if (IMAGE_TYPES.has(file.type)) {
      const result = await compressImage(originalBuffer, file.type, file.name)
      finalBuffer = result.buffer
      finalExt = result.ext
      compressed = result.compressed
    }

    // 6. Organizar en subdirectorio por ticket
    const uploadDir = getUploadDir('tickets', ticketId)
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

    const uniqueFilename = `${randomUUID()}.${finalExt}`
    const filePath = getUploadDir('tickets', ticketId, uniqueFilename)

    // 7. Guardar en disco
    await writeFile(filePath, finalBuffer)

    // 8. Registrar en BD con tamaño final (post-compresión)
    const attachment = await prisma.attachments.create({
      data: {
        id: randomUUID(),
        filename: uniqueFilename,
        originalName: file.name,
        mimeType: compressed ? (finalExt === 'webp' ? 'image/webp' : 'image/jpeg') : file.type,
        size: finalBuffer.length,
        path: filePath,
        ticketId,
        uploadedBy,
        createdAt: new Date(),
      },
    })

    // 9. Historial
    if (!skipHistory) {
      const savedPercent = compressed
        ? Math.round((1 - finalBuffer.length / originalSize) * 100)
        : 0

      const comment = compressed && savedPercent > 5
        ? `Archivo subido: ${file.name} (comprimido ${savedPercent}%, ${FileService.formatFileSize(originalSize)} → ${FileService.formatFileSize(finalBuffer.length)})`
        : `Archivo subido: ${file.name}`

      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'file_uploaded',
          comment,
          newValue: attachment.id,
          ticketId,
          userId: uploadedBy,
          createdAt: new Date(),
        },
      })
    }

    return attachment
  }

  // ── Carga masiva ─────────────────────────────────────────────────────────────

  /**
   * Sube múltiples archivos en paralelo (máx 3 simultáneos para no saturar el servidor).
   * Devuelve resultados individuales — los errores no detienen los demás.
   */
  static async uploadMultiple(
    files: File[],
    ticketId: string,
    uploadedBy: string
  ): Promise<Array<{ file: string; success: boolean; error?: string; attachment?: any }>> {
    const CONCURRENCY = 3
    const results: Array<{ file: string; success: boolean; error?: string; attachment?: any }> = []

    // Procesar en lotes de CONCURRENCY
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.allSettled(
        batch.map((file) =>
          this.uploadFile({ file, ticketId, uploadedBy, skipHistory: false })
        )
      )

      for (let j = 0; j < batch.length; j++) {
        const result = batchResults[j]
        if (result.status === 'fulfilled') {
          results.push({ file: batch[j].name, success: true, attachment: result.value })
        } else {
          results.push({
            file: batch[j].name,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Error desconocido',
          })
        }
      }
    }

    return results
  }

  // ── Consultas ────────────────────────────────────────────────────────────────

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
        users: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      path: a.path,
      ticketId: a.ticketId,
      uploadedBy: a.uploadedBy,
      createdAt: a.createdAt,
      uploader: a.users || { id: a.uploadedBy, name: 'Usuario desconocido', role: 'CLIENT' },
    }))
  }

  /** Estadísticas de uso de almacenamiento de un ticket */
  static async getTicketStorageStats(ticketId: string) {
    const attachments = await prisma.attachments.findMany({
      where: { ticketId },
      select: { size: true },
    })

    const usedBytes = attachments.reduce((sum, a) => sum + a.size, 0)
    return {
      fileCount: attachments.length,
      usedBytes,
      usedMB: parseFloat((usedBytes / (1024 * 1024)).toFixed(2)),
      maxFiles: MAX_FILES_PER_TICKET,
      maxBytes: MAX_STORAGE_PER_TICKET,
      maxMB: MAX_STORAGE_PER_TICKET / (1024 * 1024),
      percentUsed: Math.round((usedBytes / MAX_STORAGE_PER_TICKET) * 100),
    }
  }

  // ── Eliminación ──────────────────────────────────────────────────────────────

  static async deleteFile(fileId: string, userId: string) {
    const attachment = await prisma.attachments.findUnique({
      where: { id: fileId },
      include: { tickets: true },
    })

    if (!attachment) throw new Error('Archivo no encontrado')

    // Eliminar archivo físico
    try {
      if (existsSync(attachment.path)) await unlink(attachment.path)
    } catch {
      console.warn('[FileService] No se pudo eliminar el archivo físico:', attachment.path)
    }

    // Eliminar registro BD
    await prisma.attachments.delete({ where: { id: fileId } })

    // Historial
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        action: 'file_deleted',
        comment: `Archivo eliminado: ${attachment.originalName}`,
        ticketId: attachment.ticketId,
        userId,
        createdAt: new Date(),
      },
    })

    return { success: true }
  }

  // ── Descarga / lectura ───────────────────────────────────────────────────────

  static async downloadFile(fileId: string) {
    const attachment = await prisma.attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')
    return { path: attachment.path, filename: attachment.originalName, mimeType: attachment.mimeType }
  }

  static async getFile(fileId: string) {
    const attachment = await prisma.attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')

    const buffer = await readFile(attachment.path)
    return { buffer, filename: attachment.originalName, mimeType: attachment.mimeType, size: attachment.size }
  }

  // ── Utilidades ───────────────────────────────────────────────────────────────

  static getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType === 'application/pdf') return '📄'
    if (mimeType.includes('word')) return '📝'
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊'
    if (mimeType.startsWith('text/')) return '📄'
    return '📎'
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  /** Constantes expuestas para uso en frontend */
  static readonly LIMITS = {
    maxFileSizeMB: MAX_FILE_SIZE_BYTES / (1024 * 1024),
    maxFilesPerTicket: MAX_FILES_PER_TICKET,
    maxStoragePerTicketMB: MAX_STORAGE_PER_TICKET / (1024 * 1024),
    allowedTypes: ALLOWED_TYPES,
  }
}

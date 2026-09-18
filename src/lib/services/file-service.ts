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
 *     news/
 *       {newsId}/
 *         {uuid}.{ext}          ← archivos de noticias
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
import { CloudStorageService } from '@/lib/services/cloud-storage-service'
import {
  EXT_BY_MIME,
  resolveSafeUploadMime,
  sanitizeOriginalFilename,
  type SafeUploadMime,
} from '@/lib/files/upload-file-type'

// ─── Constantes ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB por archivo
const MAX_FILES_PER_TICKET = 10 // máx archivos por ticket
const MAX_STORAGE_PER_TICKET = 50 * 1024 * 1024 // 50 MB total por ticket
const IMAGE_MAX_WIDTH = 1920 // px — ancho máximo tras compresión
const IMAGE_JPEG_QUALITY = 82 // calidad JPEG (0-100)
const IMAGE_WEBP_QUALITY = 85 // calidad WebP (0-100)

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

export interface UploadNewsFileData {
  file: File
  newsId: string
  uploadedBy: string
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
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
    const { SecurityConfigService } = await import('@/lib/services/security-config-service')
    const sizeCheck = await SecurityConfigService.validateFileSize(file.size)
    if (!sizeCheck.valid) {
      return { isValid: false, error: sizeCheck.message }
    }

    const typeCheck = await SecurityConfigService.validateFileType(file.type)
    if (!typeCheck.valid) {
      return { isValid: false, error: typeCheck.message ?? 'Tipo de archivo no permitido' }
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

  /**
   * Escribe los bytes ya validados/comprimidos en el destino activo (disco
   * local o nube) y arma el objeto listo para `prisma.<tabla>.create`. Único
   * lugar donde se decide "local vs nube" — todos los módulos con adjuntos
   * pasan por acá, así la lógica de branching no queda copiada por módulo.
   * Nunca cae a disco en silencio si el admin configuró la nube y esta
   * quedó inválida — `getActiveProvider` lanza en ese caso.
   */
  private static async storeAttachmentBytes(
    buffer: Buffer,
    mime: SafeUploadMime,
    originalFileName: string,
    module: string,
    entityId: string
  ) {
    const originalName = sanitizeOriginalFilename(originalFileName)
    const activeProvider = await CloudStorageService.getActiveProvider()

    if (activeProvider === 'local') {
      const uploadDir = getUploadDir(module, entityId)
      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

      // La extensión en disco SIEMPRE sale del mime final, nunca del nombre del cliente.
      const uniqueFilename = `${randomUUID()}.${EXT_BY_MIME[mime]}`
      const filePath = getUploadDir(module, entityId, uniqueFilename)
      await writeFile(filePath, buffer)

      return {
        filename: uniqueFilename,
        originalName,
        mimeType: mime as string,
        size: buffer.length,
        path: filePath,
        storageProvider: 'local' as const,
        externalId: null,
        externalUrl: null,
      }
    }

    // Nube: nunca toca disco. Nombre legible (con prefijo corto para evitar
    // colisiones entre revisiones del mismo archivo en la misma carpeta).
    const cloudFilename = `${randomUUID().slice(0, 8)}-${originalName}`
    const uploaded = await CloudStorageService.uploadAttachment(
      buffer,
      cloudFilename,
      mime,
      module,
      entityId,
      activeProvider
    )

    return {
      filename: cloudFilename,
      originalName,
      mimeType: mime as string,
      size: buffer.length,
      path: null,
      storageProvider: activeProvider,
      externalId: uploaded.externalId,
      externalUrl: uploaded.externalUrl ?? null,
    }
  }

  // ── Upload principal ─────────────────────────────────────────────────────────

  static async uploadFile(data: UploadFileData) {
    const { file, ticketId, uploadedBy, skipHistory = false } = data

    // 1. Validar tamaño y el tipo DECLARADO por el cliente (política
    // configurable del admin — allowedFileTypes). No es la única defensa: el
    // contenido real se verifica en el paso 4 (mismo pipeline ya aplicado a
    // Noticias/Documentos — este método se había quedado con el viejo).
    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    // 2. Verificar cuota del ticket
    const quota = await this.checkTicketQuota(ticketId)
    if (!quota.ok) throw new Error(quota.error)

    // 3. Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({ where: { id: ticketId } })
    if (!ticket) throw new Error('Ticket no encontrado')

    // 4. Leer el contenido real y cruzarlo con el tipo declarado. `file.type`
    // lo pone el cliente en el multipart y es trivialmente falsificable — un
    // `evil.html` declarado `application/pdf` pasaba antes la validación de
    // arriba sin problema. resolveSafeUploadMime mira los magic bytes.
    const originalBuffer = Buffer.from(await file.arrayBuffer()) as Buffer
    const originalSize = originalBuffer.length
    const safeMime = resolveSafeUploadMime(originalBuffer, file.type)
    if (!safeMime) {
      throw new Error(
        'El contenido del archivo no coincide con su tipo. Verifica que no esté corrupto o renombrado.'
      )
    }

    // 5. Comprimir si es imagen comprimible — según el mime DETECTADO, no el declarado.
    let finalBuffer = originalBuffer
    let finalMime: SafeUploadMime = safeMime
    let compressed = false

    if (IMAGE_TYPES.has(safeMime)) {
      const result = await compressImage(originalBuffer, safeMime, file.name)
      finalBuffer = result.buffer
      finalMime = result.ext === 'webp' ? 'image/webp' : 'image/jpeg'
      compressed = result.compressed
    }

    // 6. Guardar el archivo — disco local o nube, según el destino activo.
    const stored = await this.storeAttachmentBytes(
      finalBuffer,
      finalMime,
      file.name,
      'tickets',
      ticketId
    )

    // 7. Registrar en BD con tamaño final (post-compresión)
    const attachment = await prisma.attachments.create({
      data: {
        id: randomUUID(),
        ...stored,
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

      const comment =
        compressed && savedPercent > 5
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

  /**
   * Sube un adjunto desde datos base64 (p. ej. foto de incidencia de patrulla).
   */
  static async uploadBase64Attachment(params: {
    ticketId: string
    uploadedBy: string
    base64: string
    mimeType: string
    originalName: string
    skipHistory?: boolean
  }) {
    const raw = params.base64.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(raw, 'base64') as Buffer

    const { SecurityConfigService } = await import('@/lib/services/security-config-service')
    const sizeCheck = await SecurityConfigService.validateFileSize(buffer.length)
    if (!sizeCheck.valid) throw new Error(sizeCheck.message)

    const typeCheck = await SecurityConfigService.validateFileType(params.mimeType)
    if (!typeCheck.valid) throw new Error(typeCheck.message ?? 'Tipo de archivo no permitido')

    const quota = await this.checkTicketQuota(params.ticketId)
    if (!quota.ok) throw new Error(quota.error)

    const ticket = await prisma.tickets.findUnique({ where: { id: params.ticketId } })
    if (!ticket) throw new Error('Ticket no encontrado')

    // params.mimeType llega del cliente (creación de ticket con evidencia de
    // patrulla) tan falsificable como el `file.type` de un multipart normal
    // — mismo cruce con los magic bytes que en uploadFile.
    const safeMime = resolveSafeUploadMime(buffer, params.mimeType)
    if (!safeMime) {
      throw new Error(
        'El contenido del archivo no coincide con su tipo. Verifica que no esté corrupto o renombrado.'
      )
    }

    let finalBuffer = buffer
    let finalMime: SafeUploadMime = safeMime

    if (IMAGE_TYPES.has(safeMime)) {
      const result = await compressImage(buffer, safeMime, params.originalName)
      finalBuffer = result.buffer
      finalMime = result.ext === 'webp' ? 'image/webp' : 'image/jpeg'
    }

    const stored = await this.storeAttachmentBytes(
      finalBuffer,
      finalMime,
      params.originalName,
      'tickets',
      params.ticketId
    )

    const attachment = await prisma.attachments.create({
      data: {
        id: randomUUID(),
        ...stored,
        ticketId: params.ticketId,
        uploadedBy: params.uploadedBy,
        createdAt: new Date(),
      },
    })

    if (!params.skipHistory) {
      await prisma.ticket_history.create({
        data: {
          id: randomUUID(),
          action: 'file_uploaded',
          comment: `Evidencia de patrulla: ${params.originalName}`,
          newValue: attachment.id,
          ticketId: params.ticketId,
          userId: params.uploadedBy,
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
        batch.map(file => this.uploadFile({ file, ticketId, uploadedBy, skipHistory: false }))
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
    // Sin `path` en el select ni en la respuesta: es la ruta absoluta del
    // archivo en el servidor — no debería exponerse al frontend, y menos
    // combinada con el nombre de archivo predecible del disco.
    const attachments = await prisma.attachments.findMany({
      where: { ticketId },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        size: true,
        ticketId: true,
        uploadedBy: true,
        createdAt: true,
        users: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return attachments.map(a => ({
      id: a.id,
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
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

    await this.deleteAttachmentFiles([attachment])

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

  /**
   * Lee los bytes de un adjunto sin importar dónde vive — disco local o nube
   * (Google Drive/OneDrive). `null` significa "no disponible ahora mismo"
   * (borrado del disco, o borrado/movido directamente en la nube por fuera
   * de la app) — el caller debe responder 404, nunca lanzar un 500 crudo.
   * Única fuente de verdad para esto — reusada también por
   * `src/lib/forms/serve-form-attachment.ts`.
   */
  static async readAttachmentBytes(attachment: {
    path: string | null
    storageProvider?: string | null
    externalId?: string | null
  }): Promise<Buffer | null> {
    if (!attachment.storageProvider || attachment.storageProvider === 'local') {
      if (!attachment.path || !existsSync(attachment.path)) return null
      return readFile(attachment.path)
    }

    if (
      (attachment.storageProvider === 'google-drive' ||
        attachment.storageProvider === 'onedrive') &&
      attachment.externalId
    ) {
      const result = await CloudStorageService.downloadAttachment(
        attachment.storageProvider,
        attachment.externalId
      )
      return result?.buffer ?? null
    }

    return null
  }

  static async downloadFile(fileId: string) {
    const attachment = await prisma.attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')

    const buffer = await this.readAttachmentBytes(attachment)
    if (!buffer) throw new Error('Archivo no disponible')

    return {
      buffer,
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
    }
  }

  static async getFile(fileId: string) {
    const attachment = await prisma.attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')

    const buffer = await this.readAttachmentBytes(attachment)
    if (!buffer) throw new Error('Archivo no disponible')

    return {
      buffer,
      filename: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    }
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

  // ── Métodos para Noticias ──────────────────────────────────────────────────────

  static async uploadNewsFile(data: UploadNewsFileData) {
    const { file, newsId, uploadedBy } = data

    // 1. Validar tamaño y el tipo DECLARADO por el cliente (política
    // configurable del admin — allowedFileTypes). No es la única defensa:
    // el contenido real se verifica en el paso 3.
    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    // 2. Verificar que la noticia existe
    const news = await prisma.news.findUnique({ where: { id: newsId } })
    if (!news) throw new Error('Noticia no encontrada')

    // 3. Leer el contenido real y cruzarlo con el tipo declarado. `file.type`
    // lo pone el cliente en el multipart y es trivialmente falsificable — un
    // `evil.html` declarado `application/pdf` pasaba antes la validación de
    // arriba sin problema. resolveSafeUploadMime mira los magic bytes.
    const originalBuffer = Buffer.from(await file.arrayBuffer()) as Buffer
    const safeMime = resolveSafeUploadMime(originalBuffer, file.type)
    if (!safeMime) {
      throw new Error(
        'El contenido del archivo no coincide con su tipo. Verifica que no esté corrupto o renombrado.'
      )
    }

    // 4. Comprimir si es imagen comprimible — según el mime DETECTADO, no el declarado.
    let finalBuffer = originalBuffer
    let finalMime: SafeUploadMime = safeMime

    if (IMAGE_TYPES.has(safeMime)) {
      const result = await compressImage(originalBuffer, safeMime, file.name)
      finalBuffer = result.buffer
      // Solo se usa para decidir jpeg vs webp — la extensión en disco nunca
      // sale de `result.ext` (que en el catch de compressImage cae de vuelta
      // al nombre del cliente): siempre de EXT_BY_MIME más abajo.
      finalMime = result.ext === 'webp' ? 'image/webp' : 'image/jpeg'
    }

    // 5. Guardar el archivo — disco local o nube, según el destino activo.
    const stored = await this.storeAttachmentBytes(
      finalBuffer,
      finalMime,
      file.name,
      'news',
      newsId
    )

    // 6. Registrar en BD
    const attachment = await prisma.news_attachments.create({
      data: {
        id: randomUUID(),
        ...stored,
        newsId,
        uploadedById: uploadedBy,
        createdAt: new Date(),
      },
    })

    return attachment
  }

  static async getFilesByNews(newsId: string) {
    const attachments = await prisma.news_attachments.findMany({
      where: { newsId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return attachments
  }

  static async deleteNewsFile(fileId: string, userId: string) {
    const attachment = await prisma.news_attachments.findUnique({
      where: { id: fileId },
    })

    if (!attachment) throw new Error('Archivo no encontrado')

    await this.deleteAttachmentFiles([attachment])

    // Eliminar registro BD
    await prisma.news_attachments.delete({ where: { id: fileId } })

    return { success: true }
  }

  // ── Métodos para Formularios/Documentos ──────────────────────────────────────

  /**
   * Valida y procesa el archivo (magic bytes, compresión, escritura a
   * disco) SIN tocar la base de datos — separado de `uploadFormFile` para
   * que el caller pueda envolver la parte de BD (borrar adjunto viejo +
   * crear el nuevo + actualizar `forms`) en una única `$transaction`, sin
   * mantener una conexión abierta durante la lectura/compresión del
   * archivo.
   */
  static async prepareFormFileUpload(file: File, formId: string) {
    // 1. Validar tamaño y el tipo DECLARADO por el cliente (política
    // configurable del admin — allowedFileTypes). No es la única defensa:
    // el contenido real se verifica en el paso 2 (mismo pipeline que
    // uploadNewsFile — antes este método se quedó con la validación vieja).
    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    // 2. Leer el contenido real y cruzarlo con el tipo declarado. `file.type`
    // lo pone el cliente en el multipart y es trivialmente falsificable — un
    // `evil.html` declarado `application/pdf` pasaba antes la validación de
    // arriba sin problema. resolveSafeUploadMime mira los magic bytes.
    const originalBuffer = Buffer.from(await file.arrayBuffer()) as Buffer
    const safeMime = resolveSafeUploadMime(originalBuffer, file.type)
    if (!safeMime) {
      throw new Error(
        'El contenido del archivo no coincide con su tipo. Verifica que no esté corrupto o renombrado.'
      )
    }

    // 3. Comprimir si es imagen comprimible — según el mime DETECTADO, no el declarado.
    let finalBuffer = originalBuffer
    let finalMime: SafeUploadMime = safeMime

    if (IMAGE_TYPES.has(safeMime)) {
      const result = await compressImage(originalBuffer, safeMime, file.name)
      finalBuffer = result.buffer
      finalMime = result.ext === 'webp' ? 'image/webp' : 'image/jpeg'
    }

    return this.storeAttachmentBytes(finalBuffer, finalMime, file.name, 'forms', formId)
  }

  /**
   * Registra un link que el usuario pegó a mano (Drive/OneDrive/SharePoint,
   * vía `MediaUrlInput`) como un adjunto real — antes ese link vivía suelto
   * como string en `forms.fileUrl`, sin fila en `form_attachments`: sin
   * historial de quién lo pegó ni protección si algo más adelante
   * sobreescribía `fileUrl` sin querer. La app no sube ni administra este
   * archivo, solo guarda la referencia.
   */
  static prepareExternalLinkAttachment(url: string) {
    const trimmed = url.trim()
    return {
      filename: trimmed,
      originalName: trimmed,
      mimeType: 'text/uri-list',
      size: 0,
      path: null,
      storageProvider: 'external-link' as const,
      externalId: null,
      externalUrl: trimmed,
    }
  }

  static async uploadFormFile(data: { file: File; formId: string; uploadedById: string }) {
    const { file, formId, uploadedById } = data

    const form = await prisma.forms.findUnique({ where: { id: formId } })
    if (!form) throw new Error('Documento no encontrado')

    const prepared = await this.prepareFormFileUpload(file, formId)

    return prisma.form_attachments.create({
      data: {
        id: randomUUID(),
        ...prepared,
        formId,
        uploadedById,
        createdAt: new Date(),
      },
    })
  }

  /** Borra archivos físicos del disco, best-effort — no forma parte de la integridad de datos. */
  static async deletePhysicalFiles(paths: string[]) {
    for (const path of paths) {
      try {
        if (existsSync(path)) await unlink(path)
      } catch {
        console.warn('[FileService] No se pudo eliminar el archivo físico:', path)
      }
    }
  }

  /**
   * Igual que `deletePhysicalFiles` pero consciente de `storageProvider` —
   * un adjunto en la nube no tiene nada que borrar en disco, y uno
   * "external-link" (el usuario solo pegó un link) no le pertenece a la app
   * borrar en absoluto. Best-effort en los tres casos.
   */
  static async deleteAttachmentFiles(
    attachments: { path: string | null; storageProvider: string; externalId: string | null }[]
  ) {
    for (const attachment of attachments) {
      if (attachment.storageProvider === 'local') {
        if (attachment.path) await this.deletePhysicalFiles([attachment.path])
      } else if (
        (attachment.storageProvider === 'google-drive' ||
          attachment.storageProvider === 'onedrive') &&
        attachment.externalId
      ) {
        await CloudStorageService.deleteAttachment(
          attachment.storageProvider,
          attachment.externalId
        )
      }
    }
  }

  static async getFilesByForm(formId: string) {
    return prisma.form_attachments.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async deleteFormFile(fileId: string) {
    const attachment = await prisma.form_attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')
    await this.deleteAttachmentFiles([attachment])
    await prisma.form_attachments.delete({ where: { id: fileId } })
    return { success: true }
  }

  // ── Métodos para Procesos y Procedimientos ─────────────────────────────────

  static async uploadProcessFile(data: { file: File; processId: string; uploadedById: string }) {
    const { file, processId, uploadedById } = data
    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    const process = await prisma.processes.findUnique({ where: { id: processId } })
    if (!process) throw new Error('Proceso no encontrado')

    // Cruza el contenido real (magic bytes) con el tipo declarado — este
    // método confiaba en `file.type` tal cual (falsificable) y en la
    // extensión del nombre del cliente; mismo fix ya aplicado a
    // tickets/noticias/documentos.
    const originalBuffer = Buffer.from(await file.arrayBuffer()) as Buffer
    const safeMime = resolveSafeUploadMime(originalBuffer, file.type)
    if (!safeMime) {
      throw new Error(
        'El contenido del archivo no coincide con su tipo. Verifica que no esté corrupto o renombrado.'
      )
    }

    let finalBuffer = originalBuffer
    let finalMime: SafeUploadMime = safeMime

    if (IMAGE_TYPES.has(safeMime)) {
      const result = await compressImage(originalBuffer, safeMime, file.name)
      finalBuffer = result.buffer
      finalMime = result.ext === 'webp' ? 'image/webp' : 'image/jpeg'
    }

    const stored = await this.storeAttachmentBytes(
      finalBuffer,
      finalMime,
      file.name,
      'processes',
      processId
    )

    return prisma.process_attachments.create({
      data: {
        id: randomUUID(),
        ...stored,
        processId,
        uploadedById,
        createdAt: new Date(),
      },
    })
  }

  static async getFilesByProcess(processId: string) {
    return prisma.process_attachments.findMany({
      where: { processId },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async deleteProcessFile(fileId: string) {
    const attachment = await prisma.process_attachments.findUnique({
      where: { id: fileId },
    })
    if (!attachment) throw new Error('Archivo no encontrado')
    await this.deleteAttachmentFiles([attachment])
    await prisma.process_attachments.delete({ where: { id: fileId } })
    return { success: true }
  }

  // ── Métodos para Inventario (Equipos, Licencias, Contratos) ────────────────

  /**
   * Antes cada ruta (`equipment/[id]/attachments`, `licenses/[id]/attachments`,
   * `contracts/[id]/attachments`) escribía a disco inline, copiada entre las
   * tres y desincronizada entre sí (contratos ni siquiera usaba
   * `getUploadDir` — tenía su propia constante `UPLOAD_DIR`). Consolidarlas
   * acá es lo que permite ramificar disco/nube en un solo lugar en vez de
   * tres, igual que ya se hizo con tickets/noticias/documentos/procesos.
   */
  static async uploadEquipmentFile(data: { file: File; equipmentId: string; uploadedBy: string }) {
    const { file, equipmentId, uploadedBy } = data

    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    const originalBuffer = Buffer.from(await file.arrayBuffer()) as Buffer
    const safeMime = resolveSafeUploadMime(originalBuffer, file.type)
    if (!safeMime) {
      throw new Error('El contenido del archivo no corresponde a un tipo permitido')
    }

    const stored = await this.storeAttachmentBytes(
      originalBuffer,
      safeMime,
      file.name,
      'equipment',
      equipmentId
    )

    return prisma.equipment_attachments.create({
      data: { id: randomUUID(), ...stored, equipmentId, uploadedBy, createdAt: new Date() },
      include: { uploader: { select: { id: true, name: true } } },
    })
  }

  static async deleteEquipmentFile(fileId: string) {
    const attachment = await prisma.equipment_attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')
    await this.deleteAttachmentFiles([attachment])
    await prisma.equipment_attachments.delete({ where: { id: fileId } })
    return { success: true }
  }

  static async uploadLicenseFile(data: { file: File; licenseId: string; uploadedBy: string }) {
    const { file, licenseId, uploadedBy } = data

    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    // Cruza el contenido real (magic bytes) con el tipo declarado — este
    // método confiaba en `file.type`/la extensión del nombre del cliente tal
    // cual (falsificable); mismo fix ya aplicado al resto de los módulos.
    const originalBuffer = Buffer.from(await file.arrayBuffer()) as Buffer
    const safeMime = resolveSafeUploadMime(originalBuffer, file.type)
    if (!safeMime) {
      throw new Error('El contenido del archivo no corresponde a un tipo permitido')
    }

    const stored = await this.storeAttachmentBytes(
      originalBuffer,
      safeMime,
      file.name,
      'licenses',
      licenseId
    )

    return prisma.license_attachments.create({
      data: { id: randomUUID(), ...stored, licenseId, uploadedBy, createdAt: new Date() },
      include: { uploader: { select: { id: true, name: true } } },
    })
  }

  static async deleteLicenseFile(fileId: string) {
    const attachment = await prisma.license_attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')
    await this.deleteAttachmentFiles([attachment])
    await prisma.license_attachments.delete({ where: { id: fileId } })
    return { success: true }
  }

  static async uploadContractFile(data: { file: File; contractId: string; uploadedBy: string }) {
    const { file, contractId, uploadedBy } = data

    const validation = await this.validateFile(file)
    if (!validation.isValid) throw new Error(validation.error)

    const originalBuffer = Buffer.from(await file.arrayBuffer()) as Buffer
    const safeMime = resolveSafeUploadMime(originalBuffer, file.type)
    if (!safeMime) {
      throw new Error('El contenido del archivo no corresponde a un tipo permitido')
    }

    const stored = await this.storeAttachmentBytes(
      originalBuffer,
      safeMime,
      file.name,
      'contracts',
      contractId
    )

    return prisma.contract_attachments.create({
      data: { id: randomUUID(), ...stored, contractId, uploadedBy, createdAt: new Date() },
    })
  }

  static async deleteContractFile(fileId: string) {
    const attachment = await prisma.contract_attachments.findUnique({ where: { id: fileId } })
    if (!attachment) throw new Error('Archivo no encontrado')
    await this.deleteAttachmentFiles([attachment])
    await prisma.contract_attachments.delete({ where: { id: fileId } })
    return { success: true }
  }

  /** Constantes expuestas para uso en frontend */
  static readonly LIMITS = {
    maxFileSizeMB: MAX_FILE_SIZE_BYTES / (1024 * 1024),
    maxFilesPerTicket: MAX_FILES_PER_TICKET,
    maxStoragePerTicketMB: MAX_STORAGE_PER_TICKET / (1024 * 1024),
    allowedTypes: ALLOWED_TYPES,
  }
}

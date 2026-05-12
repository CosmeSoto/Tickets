/**
 * Servicio de gestión de fotos de patrulla.
 *
 * Responsabilidades:
 * - Guardar fotos (base64) en disco con compresión server-side via sharp
 * - Registrar metadata en patrol_photos
 * - Job de retención: eliminar archivos más antiguos que photoRetentionDays
 */

import { writeFile, unlink, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { getUploadDir } from '@/lib/upload-path'

export class PatrolPhotoService {
  // ── Guardar foto ────────────────────────────────────────────────────────────

  /**
   * Guarda una foto de patrulla en disco y registra su metadata en la BD.
   * Aplica compresión server-side con sharp si está disponible.
   *
   * @param base64Data  - Foto en base64 (con o sin prefijo data:image/...)
   * @param checkInId   - ID del check-in asociado (null para fotos de inicio/fin)
   * @param patrolId    - ID de la patrulla (para fotos de inicio/fin)
   * @param capturedAt  - Timestamp de captura del dispositivo
   * @returns Registro patrol_photos creado
   */
  static async savePhoto(
    base64Data: string,
    checkInId: string | null,
    patrolId: string | null,
    capturedAt: Date
  ) {
    // Extraer datos del base64 (remover prefijo data:image/...;base64, si existe)
    const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/)
    const mimeType = matches ? matches[1] : 'image/jpeg'
    const rawBase64 = matches ? matches[2] : base64Data

    let buffer: Buffer = Buffer.from(rawBase64, 'base64')

    // Intentar compresión con sharp (disponible en el servidor)
    buffer = await this.compressWithSharp(buffer, mimeType)

    // Construir ruta de destino: patrol-photos/YYYY/MM/
    const now = new Date()
    const year = now.getFullYear().toString()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const subDir = join('patrol-photos', year, month)
    const uploadDir = getUploadDir(subDir)

    // Crear directorio si no existe
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Nombre de archivo único
    const ext = mimeType === 'image/png' ? '.png' : '.jpg'
    const filename = `${randomUUID()}${ext}`
    const filePath = join(uploadDir, filename)

    await writeFile(filePath, buffer)

    // Ruta relativa para almacenar en BD
    const relativePath = join(subDir, filename)

    // Registrar en BD
    const photo = await prisma.patrol_photos.create({
      data: {
        checkInId,
        patrolId,
        path: relativePath,
        size: buffer.length,
        mimeType,
        capturedAt,
      },
    })

    return photo
  }

  // ── Compresión server-side ──────────────────────────────────────────────────

  /**
   * Comprime una imagen usando sharp si está disponible.
   * Fallback: retorna el buffer original sin modificar.
   */
  private static async compressWithSharp(buffer: Buffer, mimeType: string): Promise<Buffer> {
    try {
      // Importación dinámica para no fallar si sharp no está instalado
      const sharp = (await import('sharp')).default

      // Obtener configuración de la primera familia disponible como referencia
      // (en producción se pasaría la config específica de la familia)
      const DEFAULT_MAX_WIDTH = 1280
      const DEFAULT_QUALITY = 82

      const image = sharp(buffer).resize(DEFAULT_MAX_WIDTH, undefined, {
        withoutEnlargement: true,
        fit: 'inside',
      })

      if (mimeType === 'image/png') {
        return image.png({ quality: DEFAULT_QUALITY }).toBuffer() as Promise<Buffer>
      }

      return image.jpeg({ quality: DEFAULT_QUALITY }).toBuffer() as Promise<Buffer>
    } catch {
      // sharp no disponible o error de procesamiento — usar buffer original
      return buffer
    }
  }

  // ── Job de retención ────────────────────────────────────────────────────────

  /**
   * Elimina archivos de fotos más antiguos que photoRetentionDays por familia.
   * Preserva el registro en BD con deletedAt seteado.
   *
   * Diseñado para ejecutarse como cron job nocturno.
   */
  static async runRetentionJob(): Promise<{ deleted: number; errors: number }> {
    let deleted = 0
    let errors = 0

    // Obtener todas las configuraciones de familia con patrols habilitados
    const familyConfigs = await prisma.patrol_family_config.findMany({
      where: { patrolsEnabled: true },
      select: {
        familyId: true,
        photoRetentionDays: true,
      },
    })

    for (const config of familyConfigs) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - config.photoRetentionDays)

      // Buscar fotos de esta familia que superen el período de retención
      // y que aún no hayan sido eliminadas
      const expiredPhotos = await prisma.patrol_photos.findMany({
        where: {
          deletedAt: null,
          capturedAt: { lt: cutoffDate },
          OR: [
            {
              checkIn: {
                patrol: { familyId: config.familyId },
              },
            },
            {
              patrolStart: {
                some: { familyId: config.familyId },
              },
            },
            {
              patrolEnd: {
                some: { familyId: config.familyId },
              },
            },
          ],
        },
        select: { id: true, path: true },
      })

      for (const photo of expiredPhotos) {
        try {
          const fullPath = getUploadDir(photo.path)

          // Eliminar archivo físico si existe
          if (existsSync(fullPath)) {
            await unlink(fullPath)
          }

          // Marcar como eliminado en BD (preservar metadata)
          await prisma.patrol_photos.update({
            where: { id: photo.id },
            data: { deletedAt: new Date() },
          })

          deleted++
        } catch (err) {
          console.error(`[PatrolPhotoService] Error eliminando foto ${photo.id}:`, err)
          errors++
        }
      }
    }

    console.log(
      `[PatrolPhotoService] Retención completada: ${deleted} eliminadas, ${errors} errores`
    )
    return { deleted, errors }
  }
}

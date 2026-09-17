import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'
import prisma from '@/lib/prisma'
import DOMPurify from 'isomorphic-dompurify'
import {
  resolveSafeUploadMime,
  EXT_BY_MIME,
  type SafeUploadMime,
} from '@/lib/files/upload-file-type'

/**
 * `type` decide el nombre de archivo en disco (`${type}-${timestamp}.ext`,
 * vía `getUploadDir` -> `path.join`). Antes venía sin validar directo del
 * formulario: un `type` como `../../../../tmp/x` escribía fuera de
 * `uploads/landing` (path traversal / escritura arbitraria). Debe ser
 * siempre uno de estos valores fijos.
 */
const ALLOWED_TYPES = new Set(['logo-light', 'logo-dark', 'hero-bg', 'favicon'])

const ALLOWED_IMAGE_MIMES: ReadonlySet<SafeUploadMime> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

const SVG_ROOT_PATTERN = /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const superCheck = await (
      await import('@/lib/auth/require-super-admin')
    ).requireSuperAdmin(session)
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

    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json(
        { error: 'Tipo de imagen inválido. Debe ser logo-light, logo-dark, hero-bg o favicon' },
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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Validar contenido REAL — nunca el Content-Type declarado por el
    // cliente. SVG es un caso especial: es texto, no tiene magic bytes, y
    // puede traer <script>/on* — se sanea con DOMPurify antes de guardarlo.
    let finalBuffer: Buffer
    let extension: string
    let responseType: string

    if (file.type === 'image/svg+xml') {
      const raw = buffer.toString('utf8')
      if (!SVG_ROOT_PATTERN.test(raw)) {
        return NextResponse.json({ error: 'El archivo no es un SVG válido' }, { status: 400 })
      }
      const sanitized = DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } })
      if (!sanitized.trim()) {
        return NextResponse.json({ error: 'El archivo no es un SVG válido' }, { status: 400 })
      }
      finalBuffer = Buffer.from(sanitized, 'utf8')
      extension = 'svg'
      responseType = 'image/svg+xml'
    } else {
      const detectedMime = resolveSafeUploadMime(buffer, file.type)
      if (!detectedMime || !ALLOWED_IMAGE_MIMES.has(detectedMime)) {
        return NextResponse.json(
          { error: 'El archivo no es una imagen válida (JPG, PNG, WebP o SVG)' },
          { status: 400 }
        )
      }
      finalBuffer = buffer
      extension = EXT_BY_MIME[detectedMime]
      responseType = detectedMime
    }

    // Crear directorio si no existe
    const uploadDir = getUploadDir('landing')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Nombre único — `type` ya está restringido al enum fijo de arriba y
    // `extension` siempre sale del mime detectado, nunca del nombre del
    // cliente.
    const timestamp = Date.now()
    const filename = `${type}-${timestamp}.${extension}`
    const filepath = getUploadDir('landing', filename)

    await writeFile(filepath, finalBuffer)

    // Retornar URL pública — servida via /api/uploads/
    const publicUrl = `/api/uploads/landing/${filename}`

    return NextResponse.json({
      url: publicUrl,
      filename,
      size: finalBuffer.length,
      type: responseType,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 })
  }
}

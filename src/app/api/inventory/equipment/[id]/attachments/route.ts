import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { getUploadDir } from '@/lib/upload-path'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]

/**
 * GET /api/inventory/equipment/[id]/attachments
 * Lista adjuntos de un equipo
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: equipmentId } = await params

  const attachments = await prisma.equipment_attachments.findMany({
    where: { equipmentId },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(attachments)
}

/**
 * POST /api/inventory/equipment/[id]/attachments
 * Sube un adjunto a un equipo
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return NextResponse.json(
      { error: 'No tienes permiso para gestionar el inventario' },
      { status: 403 }
    )
  }

  const { id: equipmentId } = await params

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } })
  if (!equipment) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }

  const { SecurityConfigService } = await import('@/lib/services/security-config-service')
  const sizeCheck = await SecurityConfigService.validateFileSize(file.size)
  if (!sizeCheck.valid) {
    return NextResponse.json({ error: sizeCheck.message }, { status: 400 })
  }

  const uploadDir = getUploadDir('equipment', equipmentId)
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

  const buffer = Buffer.from(await file.arrayBuffer())

  let ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  let mimeType = file.type
  if (file.type.startsWith('image/')) {
    // El navegador no siempre reporta el formato real: un archivo ".jpg"
    // puede ser WebP por dentro (pasa con capturas/recortes de algunos
    // navegadores). Guardarlo con la extensión declarada en vez de la real
    // deja el archivo ilegible para todo lo que sí valida el contenido —
    // ej. el acta de entrega en PDF, que solo sabe leer PNG/JPEG y
    // terminaba omitiendo la foto sin ningún aviso. Se detecta el formato
    // real del contenido y se usa ese, no el que dijo el cliente.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const sharp = require('sharp') as typeof import('sharp')
      const meta = await sharp(buffer).metadata()
      const extByFormat: Record<string, string> = {
        jpeg: 'jpg',
        png: 'png',
        webp: 'webp',
        gif: 'gif',
      }
      const mimeByFormat: Record<string, string> = {
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif',
      }
      if (meta.format && extByFormat[meta.format]) {
        ext = extByFormat[meta.format]
        mimeType = mimeByFormat[meta.format]
      }
    } catch {
      // No se pudo decodificar pese al Content-Type declarado — se guarda
      // igual con lo que reportó el cliente, no bloquea la subida.
    }
  }

  const filename = `${randomUUID()}.${ext}`
  const filepath = getUploadDir('equipment', equipmentId, filename)
  await writeFile(filepath, buffer)

  const attachment = await prisma.equipment_attachments.create({
    data: {
      id: randomUUID(),
      equipmentId,
      filename,
      originalName: file.name,
      mimeType,
      size: file.size,
      path: filepath,
      uploadedBy: session.user.id,
      createdAt: new Date(),
    },
    include: { uploader: { select: { id: true, name: true } } },
  })

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'EQUIPMENT_ATTACHMENT_UPLOAD',
      entityType: 'equipment',
      entityId: equipmentId,
      userId: session.user.id,
      details: { descripcion: `Archivo adjunto "${file.name}" subido al equipo ${equipment.code}` },
      createdAt: new Date(),
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}

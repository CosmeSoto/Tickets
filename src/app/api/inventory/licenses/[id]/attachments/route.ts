import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { getUploadDir } from '@/lib/upload-path'

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * GET /api/inventory/licenses/[id]/attachments
 * Lista adjuntos de una licencia
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: licenseId } = await params

  const attachments = await prisma.license_attachments.findMany({
    where: { licenseId },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(attachments)
}

/**
 * POST /api/inventory/licenses/[id]/attachments
 * Sube un adjunto a una licencia
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!await canManageInventory(session.user.id, session.user.role)) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el inventario' }, { status: 403 })
  }

  const { id: licenseId } = await params

  const license = await prisma.software_licenses.findUnique({ where: { id: licenseId } })
  if (!license) return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 })

  // Leer límite de tamaño desde system_settings
  const setting = await prisma.system_settings.findUnique({ where: { key: 'max_file_size' } })
  const maxSize = setting?.value ? parseInt(setting.value, 10) : DEFAULT_MAX_SIZE

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

  if (file.size > maxSize) {
    const limitMB = Math.round(maxSize / (1024 * 1024))
    return NextResponse.json({ error: `El archivo supera el límite de ${limitMB}MB` }, { status: 400 })
  }

  const uploadDir = getUploadDir('licenses', licenseId)
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const filename = `${randomUUID()}.${ext}`
  const filepath = getUploadDir('licenses', licenseId, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  const attachment = await prisma.license_attachments.create({
    data: {
      id: randomUUID(),
      licenseId,
      filename,
      originalName: file.name,
      mimeType: file.type,
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
      action: 'LICENSE_ATTACHMENT_UPLOAD',
      entityType: 'software_license',
      entityId: licenseId,
      userId: session.user.id,
      details: { filename: file.name, licenseName: license.name },
      createdAt: new Date(),
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}

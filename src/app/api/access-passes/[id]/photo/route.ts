import { randomUUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanManageAccess,
  assertCanScanAccess,
  getAccessModulePermission,
  isAccessFamilyAllowed,
} from '@/lib/access/access-control'
import { getUploadDir } from '@/lib/upload-path'
import { SecurityConfigService } from '@/lib/services/security-config-service'

const MAX_PHOTO_EDGE = 1280

function detectImageMime(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

async function resolvePass(id: string) {
  return (prisma as any).access_passes.findUnique({
    where: { id },
    include: { subject: { select: { id: true, photoPath: true } } },
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied
  const pass = await resolvePass((await params).id)
  if (!pass) return NextResponse.json({ error: 'Pase no encontrado.' }, { status: 404 })
  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  if (!isAccessFamilyAllowed(permission, pass.familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a este pase.' }, { status: 403 })
  }
  const form = await request.formData()
  const photo = form.get('photo')
  if (!(photo instanceof File) || photo.size <= 0) {
    return NextResponse.json({ error: 'Debes adjuntar una foto válida.' }, { status: 400 })
  }
  const sizeCheck = await SecurityConfigService.validatePersonalImageSize(photo.size)
  if (!sizeCheck.valid) {
    return NextResponse.json({ error: sizeCheck.message }, { status: 400 })
  }

  const raw = Buffer.from(await photo.arrayBuffer())
  const detected = detectImageMime(raw)
  if (!detected) {
    return NextResponse.json(
      { error: 'La foto debe ser JPG, PNG o WebP válido (firma de archivo).' },
      { status: 400 }
    )
  }

  let processed: Buffer
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const sharp = require('sharp') as typeof import('sharp')
    processed = await sharp(raw)
      .rotate()
      .resize({
        width: MAX_PHOTO_EDGE,
        height: MAX_PHOTO_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82, progressive: true })
      .toBuffer()
  } catch {
    return NextResponse.json(
      { error: 'No se pudo procesar la imagen. Usa una foto JPG, PNG o WebP.' },
      { status: 400 }
    )
  }

  const directory = path.join(getUploadDir(), 'access-subjects', pass.subject.id)
  await mkdir(directory, { recursive: true })
  const filename = `${randomUUID()}.jpg`
  const absolutePath = path.join(directory, filename)
  await writeFile(absolutePath, processed)
  await (prisma as any).access_subjects.update({
    where: { id: pass.subject.id },
    data: { photoPath: absolutePath },
  })
  return NextResponse.json({ photoUrl: `/api/access-passes/${pass.id}/photo` })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanScanAccess(session.user.id, session.user.role)
  if (denied) return denied
  const pass = await resolvePass((await params).id)
  if (!pass?.subject.photoPath)
    return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 })
  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  if (!isAccessFamilyAllowed(permission, pass.familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a este pase.' }, { status: 403 })
  }
  try {
    const content = await readFile(pass.subject.photoPath)
    const extension = path.extname(pass.subject.photoPath).toLowerCase()
    const contentType =
      extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
    return new NextResponse(content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Archivo de foto no disponible.' }, { status: 404 })
  }
}

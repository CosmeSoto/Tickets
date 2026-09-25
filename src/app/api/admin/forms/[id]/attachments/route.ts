/**
 * API: Admin - Form File Upload
 * POST /api/admin/forms/[id]/attachments  — sube un archivo y actualiza fileUrl en el form
 * GET  /api/admin/forms/[id]/attachments  — lista adjuntos del form
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FileService } from '@/lib/services/file-service'
import { assertCanManageForms, assertCanModifyForm } from '@/lib/forms/forms-access'
import { assertCanViewForm } from '@/lib/forms/form-visibility'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar permiso de gestión
    const deniedManage = await assertCanManageForms(session.user.id, session.user.role)
    if (deniedManage) return deniedManage

    // Verificar que puede modificar este documento específico
    const isSuperAdmin =
      (
        await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { isSuperAdmin: true },
        })
      )?.isSuperAdmin === true
    const deniedModify = await assertCanModifyForm(
      id,
      session.user.id,
      session.user.role,
      isSuperAdmin
    )
    if (deniedModify) return deniedModify

    const form = await prisma.forms.findUnique({
      where: { id },
      include: { form_attachments: true },
    })
    if (!form) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const externalUrlRaw = formData.get('externalUrl')
    const externalUrl = typeof externalUrlRaw === 'string' ? externalUrlRaw.trim() : ''

    if (!file && !externalUrl) {
      return NextResponse.json({ error: 'No se recibió ningún archivo ni enlace' }, { status: 400 })
    }

    // Procesar y escribir el archivo (disco o nube) ANTES de la transacción
    // — no hace falta mantener una conexión de BD abierta durante la lectura
    // y compresión. Un link pegado a mano no tiene nada que procesar.
    const prepared = file
      ? await FileService.prepareFormFileUpload(file, id, session.user.id)
      : FileService.prepareExternalLinkAttachment(externalUrl)
    const fileUrl = `/api/forms/${id}/file`
    const oldAttachments = form.form_attachments.map(a => ({
      path: a.path,
      storageProvider: a.storageProvider,
      externalId: a.externalId,
      uploadedById: a.uploadedById,
    }))

    // Borrar adjuntos viejos + crear el nuevo + actualizar `forms` en una
    // única transacción: antes se borraba cada adjunto viejo y se subía el
    // nuevo en pasos sueltos sin atomicidad — dos subidas concurrentes del
    // mismo documento podían dejar `forms.fileUrl/fileSize/fileType`
    // desincronizado de lo que realmente hay en `form_attachments`.
    const attachment = await prisma.$transaction(async tx => {
      await tx.form_attachments.deleteMany({ where: { formId: id } })

      const created = await tx.form_attachments.create({
        data: {
          id: randomUUID(),
          ...prepared,
          formId: id,
          uploadedById: session.user.id,
          createdAt: new Date(),
        },
      })

      await tx.forms.update({
        where: { id },
        data: {
          fileUrl,
          fileSize: created.size,
          fileType: created.mimeType,
          updatedById: session.user.id,
        },
      })

      return created
    })

    // Limpieza del/los archivo(s) viejo(s) (disco o nube), best-effort — fuera
    // de la transacción: un archivo huérfano no es un problema de integridad
    // de datos, a diferencia de las filas de `form_attachments`.
    await FileService.deleteAttachmentFiles(oldAttachments)

    return NextResponse.json({ attachment, fileUrl }, { status: 201 })
  } catch (error) {
    console.error('Error subiendo archivo de form:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al subir archivo' },
      { status: 500 }
    )
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const deniedView = await assertCanViewForm(id, session.user.id)
    if (deniedView) return deniedView

    const attachments = await FileService.getFilesByForm(id)
    return NextResponse.json({ attachments })
  } catch (error) {
    // Antes: `{attachments:[]}` con 200 para cualquier excepción — mismo
    // antipatrón ya corregido en GET /api/admin/news, escondía un error real
    // de Prisma como "sin adjuntos".
    console.error('Error obteniendo adjuntos:', error)
    return NextResponse.json({ error: 'Error al obtener adjuntos' }, { status: 500 })
  }
}

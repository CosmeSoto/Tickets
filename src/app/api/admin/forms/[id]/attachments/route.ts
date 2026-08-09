/**
 * API: Admin - Form File Upload
 * POST /api/admin/forms/[id]/attachments  — sube un archivo y actualiza fileUrl en el form
 * GET  /api/admin/forms/[id]/attachments  — lista adjuntos del form
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
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

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }

    // Eliminar adjuntos anteriores (un form tiene un solo archivo)
    for (const old of form.form_attachments) {
      await FileService.deleteFormFile(old.id).catch(() => {})
    }

    // Subir el nuevo archivo
    const attachment = await FileService.uploadFormFile({
      file,
      formId: id,
      uploadedById: session.user.id,
    })

    // La URL pública accesible para todos los usuarios autenticados
    const fileUrl = `/api/forms/${id}/file`

    // Actualizar el form con la URL, tamaño y tipo del archivo
    await prisma.forms.update({
      where: { id },
      data: {
        fileUrl,
        fileSize: attachment.size,
        fileType: attachment.mimeType,
        updatedById: session.user.id,
      },
    })

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
    console.error('Error obteniendo adjuntos:', error)
    return NextResponse.json({ attachments: [] })
  }
}

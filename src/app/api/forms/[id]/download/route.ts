/**
 * API: User - Form Download
 * POST /api/forms/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanViewForm } from '@/lib/forms/form-visibility'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const denied = await assertCanViewForm(id, session.user.id)
    if (denied) return denied

    const form = await prisma.forms.findUnique({
      where: { id, isActive: true },
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    await prisma.form_downloads.create({
      data: {
        formId: id,
        userId: session.user.id,
      },
    })

    await prisma.forms.update({
      where: { id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    })

    return NextResponse.json({ success: true, fileUrl: form.fileUrl })
  } catch (error) {
    console.error('Error registrando descarga:', error)
    return NextResponse.json({ error: 'Error al registrar descarga' }, { status: 500 })
  }
}

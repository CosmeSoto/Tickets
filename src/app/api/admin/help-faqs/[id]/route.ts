/**
 * PUT    /api/admin/help-faqs/[id] — edita una pregunta (incluye activar/desactivar).
 * DELETE /api/admin/help-faqs/[id] — elimina una pregunta.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { HELP_MODULE_SECTIONS } from '@/features/help/data/faq-by-module'

const VALID_MODULES = new Set(HELP_MODULE_SECTIONS.map(s => s.id))
const VALID_ROLES = new Set(['ADMIN', 'TECHNICIAN', 'CLIENT'])

function requireAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === 'ADMIN'
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!requireAdmin(session)) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.help_faqs.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Pregunta no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 })
    }

    const {
      module: moduleId,
      category,
      question,
      answer,
      mediaUrl,
      roles,
      keywords,
      order,
      isActive,
    } = body

    if (moduleId !== undefined && !VALID_MODULES.has(moduleId)) {
      return NextResponse.json({ success: false, message: 'Módulo inválido' }, { status: 400 })
    }
    if (category !== undefined && !category?.trim()) {
      return NextResponse.json(
        { success: false, message: 'La categoría es obligatoria' },
        { status: 400 }
      )
    }
    if (question !== undefined && !question?.trim()) {
      return NextResponse.json(
        { success: false, message: 'La pregunta es obligatoria' },
        { status: 400 }
      )
    }
    if (answer !== undefined && !answer?.trim()) {
      return NextResponse.json(
        { success: false, message: 'La respuesta es obligatoria' },
        { status: 400 }
      )
    }
    if (Array.isArray(roles) && roles.some((r: string) => !VALID_ROLES.has(r))) {
      return NextResponse.json({ success: false, message: 'Rol inválido' }, { status: 400 })
    }

    const updateData: Record<string, unknown> = {}
    if (moduleId !== undefined) updateData.module = moduleId
    if (category !== undefined) updateData.category = category.trim()
    if (question !== undefined) updateData.question = question.trim()
    if (answer !== undefined) updateData.answer = answer.trim()
    if (mediaUrl !== undefined) updateData.mediaUrl = mediaUrl?.trim() || null
    if (roles !== undefined) updateData.roles = Array.isArray(roles) ? roles : []
    if (keywords !== undefined) updateData.keywords = Array.isArray(keywords) ? keywords : []
    if (order !== undefined) updateData.order = typeof order === 'number' ? order : 0
    if (isActive !== undefined) updateData.isActive = !!isActive

    const updated = await prisma.help_faqs.update({ where: { id }, data: updateData })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[API] Error actualizando FAQ de ayuda:', error)
    return NextResponse.json(
      { success: false, message: 'Error al actualizar la pregunta' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!requireAdmin(session)) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const existing = await prisma.help_faqs.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Pregunta no encontrada' },
        { status: 404 }
      )
    }

    await prisma.help_faqs.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Pregunta eliminada' })
  } catch (error) {
    console.error('[API] Error eliminando FAQ de ayuda:', error)
    return NextResponse.json(
      { success: false, message: 'Error al eliminar la pregunta' },
      { status: 500 }
    )
  }
}

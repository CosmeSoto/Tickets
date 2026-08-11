import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * PATCH /api/admin/families/[id]/general
 * Actualiza campos básicos de families: name, description, color, icon, isActive, order, code
 * Valida unicidad de code contra otras familias → HTTP 409 si colisiona
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    if (session.user.role !== 'ADMIN')
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

    const requester = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    if (!requester?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Administrador puede editar datos generales de familias' },
        { status: 403 }
      )
    }

    const { id } = await params

    const existing = await prisma.families.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, color, icon, isActive, order, code, contactWhatsapp } = body

    // Validate code uniqueness against other families
    if (code !== undefined && code !== existing.code) {
      const codeConflict = await prisma.families.findFirst({
        where: { code, id: { not: id } },
      })
      if (codeConflict) {
        return NextResponse.json(
          { error: 'El código ya está en uso por otra familia' },
          { status: 409 }
        )
      }
    }

    const { normalizeWhatsAppPhone } = await import('@/lib/sales-whatsapp-contact')
    const normalizedWhatsapp =
      contactWhatsapp === undefined
        ? undefined
        : contactWhatsapp === null || contactWhatsapp === ''
          ? null
          : normalizeWhatsAppPhone(String(contactWhatsapp)) || String(contactWhatsapp).replace(/\D/g, '').slice(0, 30) || null

    const updated = await prisma.families.update({
      where: { id },
      data: {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
        ...(normalizedWhatsapp !== undefined && { contactWhatsapp: normalizedWhatsapp }),
      },
    })

    // Invalidar caché de la familia y listas de familias
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await Promise.all([
        invalidateCache(`admin:family:id=${id}`),
        invalidateCache('families:*'),
        invalidateCache('inv:families:*'),
      ])
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating family general:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

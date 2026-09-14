/**
 * API: Admin - Form Category by ID
 * PUT    /api/admin/form-categories/[id]
 * DELETE /api/admin/form-categories/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanManageForms } from '@/lib/forms/forms-access'
import { isPrismaForeignKeyViolation } from '@/lib/db/prisma-errors'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const denied = await assertCanManageForms(session.user.id, session.user.role)
    if (denied) return denied

    const data = await request.json()

    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const category = await prisma.form_categories.update({
      where: { id },
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color || undefined,
        isActive: data.isActive !== false,
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error actualizando categoría:', error)
    return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const denied = await assertCanManageForms(session.user.id, session.user.role)
    if (denied) return denied

    const category = await prisma.form_categories.findUnique({
      where: { id },
      include: { _count: { select: { forms: true } } },
    })

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    if (category._count.forms > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: tiene ${category._count.forms} documento${category._count.forms !== 1 ? 's' : ''} asociado${category._count.forms !== 1 ? 's' : ''}`,
        },
        { status: 400 }
      )
    }

    try {
      await prisma.form_categories.delete({ where: { id } })
    } catch (deleteError) {
      // TOCTOU: un POST /api/admin/forms con esta categoryId puede colarse
      // entre el conteo de arriba y este delete. La FK real de Postgres ya
      // impide borrar una categoría con documentos asociados (evita la
      // corrupción de datos) — esto solo convierte esa carrera en un 400
      // controlado en vez de dejarla caer al catch genérico como 500.
      if (isPrismaForeignKeyViolation(deleteError)) {
        return NextResponse.json(
          { error: 'No se puede eliminar: tiene documentos asociados' },
          { status: 400 }
        )
      }
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando categoría:', error)
    return NextResponse.json({ error: 'Error al eliminar categoría' }, { status: 500 })
  }
}

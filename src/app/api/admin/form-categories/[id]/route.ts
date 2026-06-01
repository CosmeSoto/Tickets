/**
 * API: Admin - Form Category by ID
 * PUT    /api/admin/form-categories/[id]
 * DELETE /api/admin/form-categories/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

async function requireManageAccess(userId: string) {
  const dbUser = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageForms: true, isSuperAdmin: true, role: true },
  })
  return (
    dbUser?.isSuperAdmin === true || dbUser?.canManageForms === true || dbUser?.role === 'ADMIN'
  )
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const canManage = await requireManageAccess(session.user.id)
    if (!canManage) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

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

    const canManage = await requireManageAccess(session.user.id)
    if (!canManage) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

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

    await prisma.form_categories.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando categoría:', error)
    return NextResponse.json({ error: 'Error al eliminar categoría' }, { status: 500 })
  }
}

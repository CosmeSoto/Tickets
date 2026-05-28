/**
 * API: Admin - Form Category by ID
 * PUT /api/admin/form-categories/[id]
 * DELETE /api/admin/form-categories/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { canManageForms: true, isSuperAdmin: true },
    })

    if (!dbUser?.isSuperAdmin && !dbUser?.canManageForms) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const data = await request.json()
    const category = await prisma.form_categories.update({
      where: { id: params.id },
      data: {
        name: data.name,
        description: data.description || null,
        isActive: data.isActive !== false,
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error actualizando categoría:', error)
    return NextResponse.json({ error: 'Error al actualizar categoría' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { canManageForms: true, isSuperAdmin: true },
    })

    if (!dbUser?.isSuperAdmin && !dbUser?.canManageForms) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Check if category has forms
    const category = await prisma.form_categories.findUnique({
      where: { id: params.id },
      include: { _count: { select: { forms: true } } },
    })

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    if (category._count.forms > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar la categoría porque tiene documentos asociados' },
        { status: 400 }
      )
    }

    await prisma.form_categories.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando categoría:', error)
    return NextResponse.json({ error: 'Error al eliminar categoría' }, { status: 500 })
  }
}

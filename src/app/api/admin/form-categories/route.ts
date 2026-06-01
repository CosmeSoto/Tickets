/**
 * API: Admin - Form Categories Management
 * GET  /api/admin/form-categories  — cualquier usuario con acceso a forms
 * POST /api/admin/form-categories  — solo admins / canManageForms
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Cualquier usuario autenticado puede leer las categorías (necesario para el select del formulario)
    const categories = await prisma.form_categories.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { forms: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error obteniendo categorías:', error)
    return NextResponse.json({ error: 'Error al obtener categorías' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { canManageForms: true, isSuperAdmin: true, role: true },
    })

    const canManage =
      dbUser?.isSuperAdmin === true || dbUser?.canManageForms === true || dbUser?.role === 'ADMIN'

    if (!canManage) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const data = await request.json()

    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
    }

    const category = await prisma.form_categories.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        color: data.color || '#6B7280',
        isActive: data.isActive !== false,
      },
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Error creando categoría:', error)
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 })
  }
}

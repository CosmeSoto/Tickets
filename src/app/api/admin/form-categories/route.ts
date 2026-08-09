/**
 * API: Admin - Form Categories Management
 * GET  /api/admin/form-categories  — usuarios con módulo documentos
 * POST /api/admin/form-categories  — assertCanManageForms (+ formsEnabled)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanManageForms } from '@/lib/forms/forms-access'
import { getFormViewer, hasFormsModuleAccess } from '@/lib/forms/form-visibility'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const viewer = await getFormViewer(session.user.id)
    if (!viewer || !hasFormsModuleAccess(viewer)) {
      return NextResponse.json({ error: 'No tienes acceso al módulo de documentos' }, { status: 403 })
    }

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

    const denied = await assertCanManageForms(session.user.id, session.user.role)
    if (denied) return denied

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

/**
 * API: Admin - Form Categories Management
 * GET /api/admin/form-categories
 * POST /api/admin/form-categories
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { formsEnabled: true, canManageForms: true, isSuperAdmin: true, role: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = dbUser.isSuperAdmin === true
    const canManage = dbUser.canManageForms === true || isSuperAdmin
    const hasAccess = dbUser.formsEnabled === true || isSuperAdmin || dbUser.role === 'ADMIN'

    if (!hasAccess || !canManage) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    const where: any = { isActive: true }
    if (familyId && familyId !== 'all') {
      where.familyId = familyId
    }

    const categories = await prisma.form_categories.findMany({
      where,
      include: { families: true },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error obteniendo categorías:', error)
    return NextResponse.json({ categories: [] })
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
      select: { canManageForms: true, isSuperAdmin: true },
    })

    if (!dbUser?.isSuperAdmin && !dbUser?.canManageForms) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const data = await request.json()
    const category = await prisma.form_categories.create({
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        order: data.order || 0,
        familyId: data.familyId || null,
        isActive: data.isActive !== false,
      },
    })

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error creando categoría:', error)
    return NextResponse.json({ error: 'Error al crear categoría' }, { status: 500 })
  }
}

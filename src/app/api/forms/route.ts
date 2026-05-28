/**
 * API: User - Forms View
 * GET /api/forms
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
      select: { formsEnabled: true, role: true, departmentId: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (!dbUser.formsEnabled && dbUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')

    const where: any = { isActive: true }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ]
    }

    const forms = await prisma.forms.findMany({
      where,
      include: {
        category: true,
        family: true,
        createdBy: { select: { id: true, name: true } },
        _count: { select: { form_downloads: true } },
      },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ forms })
  } catch (error) {
    console.error('Error obteniendo formularios:', error)
    return NextResponse.json({ forms: [] })
  }
}

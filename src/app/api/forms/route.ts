/**
 * API: User - Forms/Documents Feed
 * GET /api/forms
 *
 * Devuelve documentos activos visibles para el usuario actual,
 * respetando restricciones de rol, familia, departamento y usuario.
 * Resiliente: nunca devuelve 500.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildFormVisibilityConditions,
  getFormViewer,
  hasFormsModuleAccess,
} from '@/lib/forms/form-visibility'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ forms: [] })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')

    const user = await getFormViewer(session.user.id)
    if (!user || !hasFormsModuleAccess(user)) {
      return NextResponse.json({ forms: [] })
    }

    const visibilityConditions = buildFormVisibilityConditions(user)

    const where: any = {
      isActive: true,
      OR: visibilityConditions,
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId
    }

    if (search) {
      where.AND = [
        { OR: visibilityConditions },
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { summary: { contains: search, mode: 'insensitive' } },
          ],
        },
      ]
      delete where.OR
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
    console.error('[/api/forms] Error:', error)
    return NextResponse.json({ forms: [] })
  }
}

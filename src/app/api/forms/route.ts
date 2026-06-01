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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ forms: [] })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')

    // Obtener usuario desde DB con su familia/departamento
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        departmentId: true,
        formsEnabled: true,
        isSuperAdmin: true,
        departments: { select: { familyId: true } },
      },
    })

    if (!user) return NextResponse.json({ forms: [] })

    // ADMIN y superadmin siempre tienen acceso (independiente de formsEnabled)
    const isAdminOrSuper = user.role === 'ADMIN' || user.isSuperAdmin === true

    // Solo usuarios con acceso al módulo (o admin/superadmin)
    if (!user.formsEnabled && !isAdminOrSuper) {
      return NextResponse.json({ forms: [] })
    }

    // ── Filtro de visibilidad (igual que noticias) ────────────────────────────
    // Un documento es visible si:
    //   - No tiene restricciones (ningún rol, usuario, departamento, familia)
    //   - O el usuario cumple alguna restricción
    const userFamilyId = user.departments?.familyId

    const visibilityConditions: any[] = [
      // Sin restricciones = visible para todos
      {
        form_roles: { none: {} },
        form_users: { none: {} },
        form_departments: { none: {} },
        form_families: { none: {} },
      },
      // Por rol
      { form_roles: { some: { role: user.role } } },
      // Por usuario específico
      { form_users: { some: { userId: user.id } } },
      // El creador siempre ve sus propios documentos
      { createdById: user.id },
    ]

    if (user.departmentId) {
      visibilityConditions.push({
        form_departments: { some: { departmentId: user.departmentId } },
      })
    }
    if (userFamilyId) {
      visibilityConditions.push({
        form_families: { some: { familyId: userFamilyId } },
      })
    }

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

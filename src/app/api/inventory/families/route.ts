import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory } from '@/lib/inventory-access'
import { getAccessibleFamilyIds } from '@/lib/inventory/family-access'
import { randomUUID } from 'crypto'
import { withCache, buildCacheKey, invalidateCache } from '@/lib/api-cache'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { user } = session
    const isAdmin = user.role === 'ADMIN'
    const isSuperAdmin = (user as any).isSuperAdmin === true
    const userCanManageInventory = (user as any).canManageInventory === true
    const isManager = !isAdmin && (await canManageInventory(user.id, user.role))
    const includeInactive =
      isAdmin && isSuperAdmin && request.nextUrl.searchParams.get('includeInactive') === 'true'

    // Caché 5 min — familias de inventario cambian raramente
    const cacheKey = buildCacheKey('inv:families', {
      uid: user.id,
      role: user.role,
      isSuperAdmin,
      includeInactive,
    })

    return NextResponse.json(
      await withCache(cacheKey, 300, async () => {
        if (isAdmin || isManager) {
          const accessibleIds = await getAccessibleFamilyIds(
            user.id,
            user.role,
            isSuperAdmin,
            userCanManageInventory
          )
          const families = await prisma.families.findMany({
            where: {
              ...(includeInactive ? {} : { isActive: true }),
              ...(accessibleIds !== undefined ? { id: { in: accessibleIds } } : {}),
            },
            orderBy: { order: 'asc' },
          })
          return { families }
        }
        const families = await prisma.families.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: { id: true, name: true, code: true, color: true, icon: true, order: true },
        })
        return { families }
      })
    )
  } catch {
    return NextResponse.json({ error: 'Error al obtener familias' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/families
 * Crea una nueva familia de inventario.
 * Solo ADMIN.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo el administrador puede gestionar familias de inventario' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, code, icon, color, order, description } = body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
    }

    // Generar code a partir del nombre si no se provee
    const familyCode: string = code
      ? String(code)
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '')
      : name
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '')

    const family = await prisma.families.create({
      data: {
        id: randomUUID(),
        code: familyCode,
        name: name.trim(),
        icon: icon ?? null,
        color: color ?? '#6B7280',
        order: order ?? 0,
        description: description ?? null,
      },
    })

    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'CREATE',
          entityType: 'inventory_family',
          entityId: family.id,
          userId: session.user.id,
          details: { name: family.name },
        },
      })
      .catch(err => console.warn('[audit] families POST:', err?.message))

    // Invalidar caché de familias de inventario
    try {
      await invalidateCache('inv:families:*')
    } catch {}

    return NextResponse.json({ family }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error al crear la familia' }, { status: 500 })
  }
}

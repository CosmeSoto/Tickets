/**
 * GET /api/admin/system-modules
 * Returns the catalog of available system modules.
 * Used by the user edit modal to dynamically render module toggles.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withCache } from '@/lib/api-cache'

// Fallback hardcoded modules in case the DB table doesn't exist yet
const FALLBACK_MODULES = [
  {
    key: 'tickets',
    name: 'Tickets de Soporte',
    description: 'Gestión de tickets de soporte técnico',
    icon: 'Ticket',
    isActive: true,
    order: 1,
    defaultForAdmin: true,
    defaultForTech: true,
    defaultForClient: true,
    requiresManager: false,
    familyScoped: true,
  },
  {
    key: 'inventory',
    name: 'Inventario',
    description: 'Gestión de activos, equipos y suministros',
    icon: 'Package',
    isActive: true,
    order: 2,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: true,
    familyScoped: true,
  },
  {
    key: 'patrols',
    name: 'Rondas y Patrullajes',
    description: 'Ejecución y supervisión de rondas de seguridad',
    icon: 'Shield',
    isActive: true,
    order: 3,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: false,
    familyScoped: true,
  },
  {
    key: 'news',
    name: 'Noticias',
    description: 'Gestión de noticias, anuncios y comunicados internos',
    icon: 'Newspaper',
    isActive: true,
    order: 4,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: false,
    familyScoped: false,
  },
  {
    key: 'forms',
    name: 'Documentos',
    description: 'Gestión de documentos descargables',
    icon: 'FileText',
    isActive: true,
    order: 5,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: true,
    familyScoped: false,
  },
  {
    key: 'credentials',
    name: 'Credenciales',
    description: 'Bóveda de credenciales por área y enlaces a equipos',
    icon: 'KeyRound',
    isActive: true,
    order: 6,
    defaultForAdmin: true,
    defaultForTech: false,
    defaultForClient: false,
    requiresManager: true,
    familyScoped: true,
  },
]

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const modules = await withCache('system:modules', 300, async () => {
    try {
      const rows = await prisma.system_modules.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      })
      return rows.length > 0 ? rows : FALLBACK_MODULES
    } catch {
      // Table might not exist yet — return fallback
      return FALLBACK_MODULES
    }
  })

  return NextResponse.json(modules)
}

/**
 * PUT /api/admin/system-modules
 * Update a module's active status or defaults (Super Admin only)
 */
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN' || !(session.user as any).isSuperAdmin) {
    return NextResponse.json({ error: 'Solo Super Admin puede modificar módulos' }, { status: 403 })
  }

  const body = await request.json()
  const { key, ...data } = body

  if (!key) {
    return NextResponse.json({ error: 'key es requerido' }, { status: 400 })
  }

  try {
    const updated = await prisma.system_modules.upsert({
      where: { key },
      update: { ...data, updatedAt: new Date() },
      create: { key, ...data, updatedAt: new Date() },
    })

    // Invalidar cache
    const { invalidateCache } = await import('@/lib/api-cache')
    await invalidateCache('system:modules')

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error updating system module:', error)
    return NextResponse.json({ error: 'Error al actualizar módulo' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canReadModuleFamilyConfig } from '@/lib/auth/module-config-access'

const GONE_BODY = {
  error: 'Campos personalizados por familia fueron retirados. Usa atributos por tipo en Catálogos.',
  code: 'CUSTOM_FIELDS_REMOVED',
  replacement: 'Catálogos → atributos del tipo de activo',
}

/**
 * @deprecated Preferir atributos por tipo. Solo lectura residual; escrituras → 410.
 *
 * GET /api/inventory/families/[familyId]/custom-fields
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId } = await params
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const allowed = await canReadModuleFamilyConfig(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      familyId,
      'inventory'
    )
    if (!allowed) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const fields = await prisma.family_custom_fields.findMany({
      where: { familyId },
      orderBy: { order: 'asc' },
    })

    const response = NextResponse.json(fields)
    response.headers.set('X-Deprecated', 'true')
    return response
  } catch (error) {
    console.error('Error en GET /api/inventory/families/[familyId]/custom-fields:', error)
    return NextResponse.json({ error: 'Error al obtener campos personalizados' }, { status: 500 })
  }
}

/**
 * POST retirado — usar atributos por tipo.
 */
export async function POST() {
  return NextResponse.json(GONE_BODY, { status: 410 })
}

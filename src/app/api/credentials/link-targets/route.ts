import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkCredentialsModuleAccess,
  getCredentialsFamilyScopeIds,
} from '@/lib/credentials/access'

/**
 * GET /api/credentials/link-targets?familyId=&subtype=EQUIPMENT|LICENSE&search=
 * Lista equipos o licencias del área para enlazar a una credencial (scope credentials).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const familyId = searchParams.get('familyId')
  const subtype = searchParams.get('subtype')
  const search = (searchParams.get('search') || '').trim()

  if (!familyId) {
    return NextResponse.json({ error: 'familyId es requerido' }, { status: 400 })
  }
  if (subtype !== 'EQUIPMENT' && subtype !== 'LICENSE') {
    return NextResponse.json({ error: 'subtype inválido' }, { status: 400 })
  }

  const scope = await getCredentialsFamilyScopeIds(session.user.id, {
    isSuperAdmin: ctx.isSuperAdmin,
  })
  if (!ctx.isSuperAdmin && !scope.includes(familyId)) {
    return NextResponse.json({ error: 'Área fuera de alcance' }, { status: 403 })
  }

  if (subtype === 'EQUIPMENT') {
    const items = await prisma.equipment.findMany({
      where: {
        type: { familyId },
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { serialNumber: { contains: search, mode: 'insensitive' } },
                { model: { model: { contains: search, mode: 'insensitive' } } },
                { model: { brand: { name: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        serialNumber: true,
        status: true,
        model: {
          select: {
            model: true,
            brand: { select: { name: true } },
          },
        },
      },
      orderBy: [{ code: 'asc' }],
      take: 80,
    })

    return NextResponse.json({
      items: items.map(e => {
        const modelName = [e.model?.brand?.name, e.model?.model].filter(Boolean).join(' ')
        return {
          id: e.id,
          label: [e.code, modelName || null, e.serialNumber ? `SN ${e.serialNumber}` : null]
            .filter(Boolean)
            .join(' · '),
          name: modelName || e.code,
          code: e.code,
          status: e.status,
        }
      }),
    })
  }

  const items = await prisma.software_licenses.findMany({
    where: {
      licenseType: { familyId },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { vendor: { contains: search, mode: 'insensitive' } },
              { key: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      vendor: true,
      licenseType: { select: { name: true } },
    },
    orderBy: [{ name: 'asc' }],
    take: 80,
  })

  return NextResponse.json({
    items: items.map(l => ({
      id: l.id,
      label: [l.name, l.licenseType?.name, l.vendor].filter(Boolean).join(' · '),
      name: l.name,
    })),
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FamilyService } from '@/lib/services/family.service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

// GET /api/families — Lista familias; ADMIN ve todas las suyas, otros roles ven las habilitadas para tickets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    // ── Clientes y técnicos: todas las familias habilitadas para tickets ────
    if (session.user.role !== 'ADMIN') {
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { departments: { select: { familyId: true } } },
      })
      const userFamilyId = user?.departments?.familyId ?? null

      const families = (await (prisma.families.findMany as any)({
        where: { isActive: true, ticketFamilyConfig: { ticketsEnabled: true } },
        select: {
          id: true, name: true, code: true, color: true, icon: true,
          description: true, isActive: true,
          ticketFamilyConfig: { select: { ticketsEnabled: true, allowedFromFamilies: true } },
        },
        orderBy: { order: 'asc' },
      })) as any[]

      const accessible = families.filter(f => {
        const allowed = f.ticketFamilyConfig?.allowedFromFamilies ?? []
        if (allowed.length === 0) return true
        if (!userFamilyId) return true
        return allowed.includes(userFamilyId)
      })

      return NextResponse.json({
        success: true,
        data: accessible.map(f => ({
          ...f,
          isOwnFamily: f.id === userFamilyId,
          isRestricted: (f.ticketFamilyConfig?.allowedFromFamilies ?? []).length > 0,
        })),
      })
    }

    // ── ADMIN ────────────────────────────────────────────────────────────────
    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    let families = await FamilyService.findAll(includeInactive)

    if (!currentUser?.isSuperAdmin) {
      try {
        const assignments = await prisma.admin_family_assignments.findMany({
          where: { adminId: session.user.id, isActive: true },
          select: { familyId: true },
        })
        if (assignments.length > 0) {
          const allowedIds = new Set(assignments.map(a => a.familyId))
          families = families.filter(f => allowedIds.has(f.id))
        }
      } catch { /* fallback seguro */ }
    }

    return NextResponse.json({ success: true, data: families })
  } catch (error) {
    console.error('[GET /api/families]', error)
    return NextResponse.json({ success: false, message: 'Error al obtener familias' }, { status: 500 })
  }
}

// POST /api/families — Crea una nueva familia; solo ADMIN
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, code, description, color, icon, order } = body

    // Validar campos requeridos
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: 'El campo "name" es requerido' },
        { status: 400 }
      )
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { success: false, message: 'El campo "code" es requerido' },
        { status: 400 }
      )
    }

    // Validar code: ≤10 chars alfanuméricos
    const codeClean = code.trim().toUpperCase()
    if (!/^[A-Z0-9_]{1,10}$/.test(codeClean)) {
      return NextResponse.json(
        {
          success: false,
          message: 'El código debe ser alfanumérico (A-Z, 0-9, _), máximo 10 caracteres',
        },
        { status: 400 }
      )
    }

    // Verificar unicidad del código
    const existing = await prisma.families.findUnique({ where: { code: codeClean } })
    if (existing) {
      return NextResponse.json(
        { success: false, message: `Ya existe una familia con el código "${codeClean}"` },
        { status: 400 }
      )
    }

    const family = await FamilyService.create({
      name: name.trim(),
      code: codeClean,
      description,
      color,
      icon,
      order,
    })

    await AuditServiceComplete.log({
      action: 'FAMILY_CREATED',
      entityType: 'settings',
      entityId: family.id,
      userId: session.user.id,
      details: { familyCode: family.code, familyName: family.name },
      request,
    })

    // Invalidar caché de familias para todos los roles
    await invalidateCache([
      'families:role=ADMIN*',
      'families:role=TECHNICIAN*',
      'families:role=CLIENT*',
    ]).catch(() => {})

    return NextResponse.json(
      { success: true, data: family, message: `Familia "${family.name}" creada exitosamente` },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/families]', error)
    return NextResponse.json({ success: false, message: 'Error al crear familia' }, { status: 500 })
  }
}

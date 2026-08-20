import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkCredentialsModuleAccess,
  canCreateCredentials,
  ensureDefaultAreaVault,
  getCredentialsFamilyScopeIds,
  buildCredentialEntriesVisibilityWhere,
} from '@/lib/credentials/access'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const createVaultSchema = z.object({
  familyId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  kind: z.enum(['AREA', 'PERSONAL']).optional(),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as any).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const familyIds = await getCredentialsFamilyScopeIds(session.user.id, {
    isSuperAdmin: ctx.isSuperAdmin,
  })

  for (const familyId of familyIds) {
    try {
      await ensureDefaultAreaVault(familyId)
    } catch {
      // familyId huérfano (p. ej. tras restore parcial): ignorar y continuar
    }
  }

  const entryVisibility = await buildCredentialEntriesVisibilityWhere(ctx)

  const vaults = await prisma.credential_vaults.findMany({
    where: {
      isActive: true,
      OR: [{ familyId: { in: familyIds } }, { ownerUserId: session.user.id, kind: 'PERSONAL' }],
    },
    include: {
      family: { select: { id: true, name: true, code: true, color: true, order: true } },
      _count: { select: { entries: { where: entryVisibility } } },
    },
  })

  // Orden operativo: áreas por order/name de familia; personales al final
  vaults.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'AREA' ? -1 : 1
    const ao = a.family?.order ?? 9999
    const bo = b.family?.order ?? 9999
    if (ao !== bo) return ao - bo
    const an = a.family?.name ?? a.name
    const bn = b.family?.name ?? b.name
    const byFamily = an.localeCompare(bn, 'es')
    if (byFamily !== 0) return byFamily
    return a.name.localeCompare(b.name, 'es')
  })

  return NextResponse.json({ vaults })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as any).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  if (!(await canCreateCredentials(session.user.id, session.user.role, ctx.isSuperAdmin))) {
    return NextResponse.json({ error: 'Sin permiso para crear bóvedas' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createVaultSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const kind = parsed.data.kind ?? (parsed.data.familyId ? 'AREA' : 'PERSONAL')

  if (kind === 'PERSONAL') {
    const vault = await prisma.credential_vaults.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        kind: 'PERSONAL',
        ownerUserId: session.user.id,
      },
      include: {
        family: { select: { id: true, name: true, code: true, color: true } },
        _count: { select: { entries: { where: { isActive: true } } } },
      },
    })
    await AuditServiceComplete.log({
      action: AuditActionsComplete.CREDENTIAL_VAULT_CREATED,
      entityType: 'credential_vault',
      entityId: vault.id,
      userId: session.user.id,
      details: { name: vault.name, kind: vault.kind },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })
    return NextResponse.json({ vault }, { status: 201 })
  }

  if (!parsed.data.familyId) {
    return NextResponse.json({ error: 'familyId requerido para bóveda de área' }, { status: 400 })
  }

  const scope = await getCredentialsFamilyScopeIds(session.user.id, {
    isSuperAdmin: ctx.isSuperAdmin,
  })
  if (!ctx.isSuperAdmin && !scope.includes(parsed.data.familyId)) {
    return NextResponse.json({ error: 'Área fuera de alcance' }, { status: 403 })
  }

  const vault = await prisma.credential_vaults.create({
    data: {
      familyId: parsed.data.familyId,
      name: parsed.data.name,
      description: parsed.data.description,
      kind: 'AREA',
    },
    include: {
      family: { select: { id: true, name: true, code: true, color: true } },
      _count: { select: { entries: { where: { isActive: true } } } },
    },
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.CREDENTIAL_VAULT_CREATED,
    entityType: 'credential_vault',
    entityId: vault.id,
    userId: session.user.id,
    details: { name: vault.name, kind: vault.kind, familyId: vault.familyId },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  })

  return NextResponse.json({ vault }, { status: 201 })
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkCredentialsModuleAccess,
  canManageCredentialsVault,
  assertEquipmentLinkAllowed,
  credentialEntryMetadataSelect,
  getCredentialsFamilyScopeIds,
  userCanAccessVault,
} from '@/lib/credentials/access'
import { EncryptionService } from '@/lib/services/encryption.service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const createEntrySchema = z.object({
  vaultId: z.string().uuid(),
  title: z.string().min(1).max(200),
  username: z.string().max(200).optional(),
  secret: z.string().min(1),
  url: z.string().url().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
  entryType: z.string().max(50).optional(),
  equipmentId: z.string().uuid().optional(),
  licenseId: z.string().uuid().optional(),
})

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const vaultId = searchParams.get('vaultId')
  const familyIds = await getCredentialsFamilyScopeIds(session.user.id, {
    isSuperAdmin: ctx.isSuperAdmin,
  })

  const entries = await prisma.credential_entries.findMany({
    where: {
      isActive: true,
      ...(vaultId ? { vaultId } : {}),
      vault: {
        isActive: true,
        OR: [{ familyId: { in: familyIds } }, { ownerUserId: session.user.id, kind: 'PERSONAL' }],
      },
    },
    select: credentialEntryMetadataSelect,
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ entries })
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

  if (!(await canManageCredentialsVault(session.user.id, session.user.role, ctx.isSuperAdmin))) {
    return NextResponse.json({ error: 'Sin permiso para gestionar credenciales' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const vault = await prisma.credential_vaults.findFirst({
    where: { id: parsed.data.vaultId, isActive: true },
  })
  if (!vault) {
    return NextResponse.json({ error: 'Bóveda no encontrada' }, { status: 404 })
  }

  if (!(await userCanAccessVault(ctx, vault))) {
    return NextResponse.json({ error: 'Sin acceso a la bóveda' }, { status: 403 })
  }

  const linkCheck = await assertEquipmentLinkAllowed(ctx, parsed.data.equipmentId, vault.familyId)
  if (!linkCheck.ok) {
    return NextResponse.json({ error: linkCheck.error }, { status: 422 })
  }

  const entry = await prisma.credential_entries.create({
    data: {
      id: randomUUID(),
      vaultId: parsed.data.vaultId,
      title: parsed.data.title,
      username: parsed.data.username || null,
      secretEncrypted: EncryptionService.encrypt(parsed.data.secret),
      url: parsed.data.url || null,
      notes: parsed.data.notes || null,
      entryType: parsed.data.entryType || (parsed.data.equipmentId ? 'EQUIPMENT' : 'GENERIC'),
      equipmentId: parsed.data.equipmentId || null,
      licenseId: parsed.data.licenseId || null,
      createdById: session.user.id,
    },
    select: credentialEntryMetadataSelect,
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.CREDENTIAL_CREATED,
    entityType: 'credential_entry',
    entityId: entry.id,
    userId: session.user.id,
    details: { title: entry.title, vaultId: entry.vaultId },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  })

  return NextResponse.json({ entry }, { status: 201 })
}

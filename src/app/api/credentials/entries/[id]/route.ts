import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertEquipmentLinkAllowed,
  assertLicenseLinkAllowed,
  checkCredentialsModuleAccess,
  credentialEntryMetadataSelect,
  userCanAccessEntry,
  userCanMutateEntry,
} from '@/lib/credentials/access'
import { EncryptionService } from '@/lib/services/encryption.service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const updateEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  username: z.string().max(200).nullable().optional(),
  secret: z.string().min(1).optional(),
  url: z.string().url().nullable().optional().or(z.literal('')),
  notes: z.string().max(2000).nullable().optional(),
  entryType: z.string().max(50).optional(),
  equipmentId: z.string().uuid().nullable().optional(),
  licenseId: z.string().uuid().nullable().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

async function loadEntry(id: string) {
  return prisma.credential_entries.findFirst({
    where: { id, isActive: true },
    include: { vault: true },
  })
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as any).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const entry = await loadEntry(id)
  if (!entry) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }

  if (!(await userCanAccessEntry(ctx, entry))) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const metadata = await prisma.credential_entries.findUnique({
    where: { id },
    select: credentialEntryMetadataSelect,
  })

  return NextResponse.json({ entry: metadata })
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as any).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const entry = await loadEntry(id)
  if (!entry) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }

  if (!(await userCanMutateEntry(ctx, entry))) {
    return NextResponse.json({ error: 'Sin permiso para editar esta credencial' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateEntrySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  if (parsed.data.equipmentId !== undefined) {
    const linkCheck = await assertEquipmentLinkAllowed(
      ctx,
      parsed.data.equipmentId,
      entry.vault.familyId
    )
    if (!linkCheck.ok) {
      return NextResponse.json({ error: linkCheck.error }, { status: 422 })
    }
  }

  if (parsed.data.licenseId !== undefined) {
    const linkCheck = await assertLicenseLinkAllowed(
      ctx,
      parsed.data.licenseId,
      entry.vault.familyId
    )
    if (!linkCheck.ok) {
      return NextResponse.json({ error: linkCheck.error }, { status: 422 })
    }
  }

  const updateData: Record<string, unknown> = {
    updatedById: session.user.id,
  }
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title
  if (parsed.data.username !== undefined) updateData.username = parsed.data.username
  if (parsed.data.url !== undefined) updateData.url = parsed.data.url || null
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes
  if (parsed.data.entryType !== undefined) updateData.entryType = parsed.data.entryType
  if (parsed.data.equipmentId !== undefined) updateData.equipmentId = parsed.data.equipmentId
  if (parsed.data.licenseId !== undefined) updateData.licenseId = parsed.data.licenseId
  if (parsed.data.secret) {
    updateData.secretEncrypted = EncryptionService.encrypt(parsed.data.secret)
  }

  const updated = await prisma.credential_entries.update({
    where: { id },
    data: updateData,
    select: credentialEntryMetadataSelect,
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.CREDENTIAL_UPDATED,
    entityType: 'credential_entry',
    entityId: id,
    userId: session.user.id,
    details: { title: updated.title },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  })

  return NextResponse.json({ entry: updated })
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as any).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const entry = await loadEntry(id)
  if (!entry) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }

  if (!(await userCanMutateEntry(ctx, entry))) {
    return NextResponse.json(
      { error: 'Sin permiso para eliminar esta credencial' },
      { status: 403 }
    )
  }

  // Soft-delete + sobrescribe secreto para no dejar ciphertext recuperable
  await prisma.credential_entries.update({
    where: { id },
    data: {
      isActive: false,
      updatedById: session.user.id,
      secretEncrypted: EncryptionService.encrypt(`DELETED:${id}:${Date.now()}`),
      username: null,
      notes: null,
    },
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.CREDENTIAL_DELETED,
    entityType: 'credential_entry',
    entityId: id,
    userId: session.user.id,
    details: { title: entry.title },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  })

  return NextResponse.json({ success: true })
}

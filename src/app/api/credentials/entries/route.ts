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
  assertLicenseLinkAllowed,
  credentialEntryMetadataSelect,
  getCredentialsFamilyScopeIds,
  userCanAccessVault,
} from '@/lib/credentials/access'
import { EncryptionService } from '@/lib/services/encryption.service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const optionalUrl = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .max(500)
    .refine(
      val => {
        if (!val) return true
        try {
          // Acepta http(s) o host/IP sin esquema (lo normalizamos al guardar)
          const candidate = /^https?:\/\//i.test(val) ? val : `https://${val}`
          // eslint-disable-next-line no-new
          new URL(candidate)
          return true
        } catch {
          return false
        }
      },
      { message: 'URL inválida. Usa un enlace como https://panel.ejemplo.com o 192.168.1.1' }
    )
    .optional()
)

const optionalUuid = z.preprocess(emptyToUndefined, z.string().uuid().optional())

const createEntrySchema = z.object({
  vaultId: z.string().uuid({ message: 'Selecciona una bóveda válida' }),
  title: z.string().min(1, 'El título es obligatorio').max(200),
  username: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  secret: z.string().min(1, 'La contraseña / secreto es obligatorio'),
  url: optionalUrl,
  notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  entryType: z
    .enum(['GENERIC', 'EQUIPMENT', 'LICENSE', 'NETWORK', 'SERVICE'])
    .optional()
    .default('GENERIC'),
  equipmentId: optionalUuid,
  licenseId: optionalUuid,
})

function normalizeOptionalUrl(url?: string | null): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map(i => i.message).filter(Boolean)
  return issues[0] || 'Datos inválidos'
}

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
      OR: [
        {
          vault: {
            isActive: true,
            OR: [
              { familyId: { in: familyIds } },
              { ownerUserId: session.user.id, kind: 'PERSONAL' },
            ],
          },
        },
        // Compartidos explícitos usuario→usuario (capability VIEW en MVP)
        {
          vault: { isActive: true },
          shares: { some: { userId: session.user.id } },
        },
      ],
    },
    select: {
      ...credentialEntryMetadataSelect,
      shares: {
        select: {
          id: true,
          capability: true,
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({
    entries: entries.map(({ shares, ...entry }) => {
      const sharedWithMe = shares.some(s => s.userId === session.user.id)
      const vault = entry.vault
      const hasVaultAccess =
        ctx.isSuperAdmin ||
        (vault?.kind === 'PERSONAL' && vault.ownerUserId === session.user.id) ||
        (!!vault?.familyId && familyIds.includes(vault.familyId))

      // Destinatarios solo si gestionas/ves la bóveda (privacidad del share)
      const recipients = hasVaultAccess
        ? shares
            .filter(s => s.user)
            .map(s => ({
              id: s.user!.id,
              name: s.user!.name,
              email: s.user!.email,
              capability: s.capability,
            }))
        : []

      return {
        ...entry,
        sharedWithMe,
        shareCapability: shares.find(s => s.userId === session.user.id)?.capability ?? null,
        isShared: recipients.length > 0,
        shareCount: recipients.length,
        sharedWith: recipients,
        sharedWithLabel:
          recipients.length > 0
            ? recipients.map(r => `${r.name} <${r.email}>`).join('; ')
            : sharedWithMe
              ? 'Compartida conmigo'
              : '',
      }
    }),
  })
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
      {
        error: formatZodError(parsed.error),
        details: parsed.error.flatten(),
      },
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

  let equipmentId = parsed.data.equipmentId
  let licenseId = parsed.data.licenseId
  let entryType = parsed.data.entryType

  if (entryType === 'EQUIPMENT' && !equipmentId) {
    return NextResponse.json(
      { error: 'Selecciona el equipo al que enlazas esta credencial' },
      { status: 400 }
    )
  }
  if (entryType === 'LICENSE' && !licenseId) {
    return NextResponse.json(
      { error: 'Selecciona la licencia a la que enlazas esta credencial' },
      { status: 400 }
    )
  }
  if (entryType !== 'EQUIPMENT') equipmentId = undefined
  if (entryType !== 'LICENSE') licenseId = undefined

  const equipmentCheck = await assertEquipmentLinkAllowed(ctx, equipmentId, vault.familyId)
  if (!equipmentCheck.ok) {
    return NextResponse.json({ error: equipmentCheck.error }, { status: 422 })
  }
  const licenseCheck = await assertLicenseLinkAllowed(ctx, licenseId, vault.familyId)
  if (!licenseCheck.ok) {
    return NextResponse.json({ error: licenseCheck.error }, { status: 422 })
  }

  if (equipmentId) entryType = 'EQUIPMENT'
  if (licenseId) entryType = 'LICENSE'

  const entry = await prisma.credential_entries.create({
    data: {
      id: randomUUID(),
      vaultId: parsed.data.vaultId,
      title: parsed.data.title.trim(),
      username: parsed.data.username?.trim() || null,
      secretEncrypted: EncryptionService.encrypt(parsed.data.secret),
      url: normalizeOptionalUrl(parsed.data.url),
      notes: parsed.data.notes?.trim() || null,
      entryType,
      equipmentId: equipmentId || null,
      licenseId: licenseId || null,
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

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkCredentialsModuleAccess,
  buildCredentialEntriesVisibilityWhere,
  credentialEntryMetadataSelect,
  assertLicenseLinkAllowed,
} from '@/lib/credentials/access'

type RouteParams = { params: Promise<{ licenseId: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { licenseId } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const visibilityWhere = await buildCredentialEntriesVisibilityWhere(ctx)

  const entries = await prisma.credential_entries.findMany({
    where: {
      AND: [visibilityWhere, { licenseId }],
    },
    select: credentialEntryMetadataSelect,
    orderBy: { title: 'asc' },
  })

  // Si el área de esta licencia no está en el alcance de Credenciales del
  // usuario (aunque sí lo esté en Inventario), evitamos que la tarjeta del
  // detalle ofrezca "Agregar" para terminar en un 403 al guardar — ver
  // ModuleAccessCard.familyAlignment en Usuarios, que ahora avisa de este
  // desajuste antes de que ocurra.
  const linkCheck = await assertLicenseLinkAllowed(ctx, licenseId, null)

  return NextResponse.json({ entries, canCreate: linkCheck.ok })
}

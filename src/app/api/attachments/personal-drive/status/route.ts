/**
 * GET /api/attachments/personal-drive/status
 * Estado de la conexión del Drive personal del usuario logueado, para la
 * tarjeta "Drive personal" en /profile. `enabled` viaja SIEMPRE (no solo
 * cuando `connected`) para que la tarjeta distinga "el admin apagó esto
 * después de que me conecté" de "nunca me conecté".
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CloudStorageService } from '@/lib/services/cloud-storage-service'
import { FileService } from '@/lib/services/file-service'
import {
  PersonalDriveGraphService,
  PERSONAL_DRIVE_PROVIDER,
} from '@/lib/services/personal-drive-graph-service'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const enabled = await CloudStorageService.isPersonalDriveEnabled()

  const account = await prisma.oauth_accounts.findUnique({
    where: {
      provider_providerId: { provider: PERSONAL_DRIVE_PROVIDER, providerId: session.user.id },
    },
  })
  if (!account) return NextResponse.json({ enabled, connected: false })

  let connectedEmail: string | null = null
  try {
    const accessToken = await PersonalDriveGraphService.getAccessToken(session.user.id)
    connectedEmail = await PersonalDriveGraphService.getConnectedAccountEmail(accessToken)
  } catch {
    // No bloquea la respuesta — si el token ya no sirve, igual mostramos
    // "conectado" (hay una fila) y el usuario puede reconectar desde acá.
  }

  const storedAttachmentCount = await FileService.countPersonalDriveAttachments(session.user.id)

  return NextResponse.json({ enabled, connected: true, connectedEmail, storedAttachmentCount })
}

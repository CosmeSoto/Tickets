/**
 * DELETE /api/attachments/personal-drive/disconnect
 * Revoca la conexión del Drive personal del usuario logueado — solo borra el
 * estado local (Graph no ofrece un endpoint limpio de revocación). Siempre
 * permitido, sin importar el toggle de admin: alguien que se conectó antes
 * de que se apagara la función igual tiene que poder desconectarse.
 *
 * Los adjuntos ya subidos a ese Drive quedan huérfanos para la app (no hay
 * cómo leerlos ni borrarlos de ahí en adelante) — siguen existiendo en el
 * OneDrive de la persona, solo que el sistema pierde acceso. La tarjeta de
 * perfil avisa esto antes de desconectar si `storedAttachmentCount > 0`.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PERSONAL_DRIVE_PROVIDER } from '@/lib/services/personal-drive-graph-service'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  await prisma.oauth_accounts.deleteMany({
    where: { provider: PERSONAL_DRIVE_PROVIDER, providerId: session.user.id },
  })

  return NextResponse.json({ success: true, message: 'Conexión con tu Drive personal revocada' })
}

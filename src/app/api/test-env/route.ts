import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)

  // Solo ADMIN puede ver variables de entorno
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return NextResponse.json({
    encryptionKeySet: !!process.env.ENCRYPTION_KEY,
    nodeEnv: process.env.NODE_ENV,
    nextauthUrlSet: !!process.env.NEXTAUTH_URL,
    databaseUrlSet: !!process.env.DATABASE_URL,
    redisUrlSet: !!process.env.REDIS_URL,
  })
}

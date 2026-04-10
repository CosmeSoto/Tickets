import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/config/upload-limits
 * Retorna los límites de subida de archivos para el usuario autenticado.
 * Accesible para cualquier rol (no solo ADMIN).
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'maxFileSize' },
    })
    const maxFileSizeMB = setting ? parseInt(setting.value) || 10 : 10
    return NextResponse.json({ maxFileSizeMB })
  } catch {
    return NextResponse.json({ maxFileSizeMB: 10 })
  }
}

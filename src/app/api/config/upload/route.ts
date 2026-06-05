import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/config/upload
 * Retorna la configuración de carga de archivos (maxFileSize).
 * Accesible para cualquier usuario autenticado (ADMIN, gestor, técnico, etc.)
 * No expone configuración sensible (SMTP, seguridad, etc.)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const setting = await prisma.system_settings.findUnique({
      where: { key: 'maxFileSize' },
      select: { value: true },
    })

    const maxFileSize = setting?.value ? parseInt(setting.value, 10) : 10

    return NextResponse.json(
      { maxFileSize },
      {
        headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' },
      }
    )
  } catch (error) {
    console.error('Error al obtener config de upload:', error)
    return NextResponse.json({ maxFileSize: 10 })
  }
}

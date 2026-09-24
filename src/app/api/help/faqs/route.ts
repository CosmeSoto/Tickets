/**
 * GET /api/help/faqs — preguntas frecuentes activas del Centro de Ayuda.
 * El filtrado por módulo activo y rol se sigue haciendo en el cliente
 * (src/features/help/filter-help-faqs.ts, igual que con el array estático
 * anterior) — acá solo se excluyen las inactivas, todo lo demás llega igual
 * a cualquier usuario autenticado, sin datos sensibles.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const faqs = await prisma.help_faqs.findMany({
      where: { isActive: true },
      orderBy: [{ module: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json({ success: true, data: faqs })
  } catch (error) {
    console.error('[API] Error listando FAQs de ayuda:', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener las preguntas frecuentes' },
      { status: 500 }
    )
  }
}

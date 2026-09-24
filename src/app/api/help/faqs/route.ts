/**
 * GET /api/help/faqs — preguntas frecuentes activas del Centro de Ayuda.
 * El filtrado por MÓDULO activo se sigue haciendo en el cliente
 * (src/features/help/filter-help-faqs.ts) porque depende de flags por
 * usuario (useUserModules()) que esta ruta no resuelve. El filtrado por ROL
 * si se aplica acá también, no solo en el cliente: `roles` ya viene en la
 * sesión, es gratis, y así una pregunta marcada solo para ADMIN nunca sale
 * en la respuesta cruda para un CLIENT/TECHNICIAN (antes solo se ocultaba en
 * la UI, visible igual en la pestaña Red del navegador).
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
      where: {
        isActive: true,
        OR: [{ roles: { isEmpty: true } }, { roles: { has: session.user.role } }],
      },
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

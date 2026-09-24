/**
 * GET  /api/admin/help-faqs — lista TODAS las preguntas (activas e inactivas)
 *      para la pantalla de administración (Configuración Sistema → Ayuda).
 * POST /api/admin/help-faqs — crea una pregunta nueva.
 * Contenido de ayuda, no un dato sensible — alcanza con rol ADMIN (no hace
 * falta Super Admin, a diferencia de OAuth/backups/tickets).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { HELP_MODULE_SECTIONS } from '@/features/help/data/faq-by-module'

const VALID_MODULES = new Set(HELP_MODULE_SECTIONS.map(s => s.id))
const VALID_ROLES = new Set(['ADMIN', 'TECHNICIAN', 'CLIENT'])

function requireAdmin(session: { user?: { role?: string } } | null) {
  return session?.user?.role === 'ADMIN'
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!requireAdmin(session)) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
    }

    const faqs = await prisma.help_faqs.findMany({
      orderBy: [{ module: 'asc' }, { order: 'asc' }],
    })

    return NextResponse.json({ success: true, data: faqs })
  } catch (error) {
    console.error('[API] Error listando FAQs de ayuda (admin):', error)
    return NextResponse.json(
      { success: false, message: 'Error al obtener las preguntas frecuentes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!requireAdmin(session)) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 })
    }

    const { module: moduleId, category, question, answer, mediaUrl, roles, keywords, order } = body

    if (!VALID_MODULES.has(moduleId)) {
      return NextResponse.json({ success: false, message: 'Módulo inválido' }, { status: 400 })
    }
    if (!category?.trim() || !question?.trim() || !answer?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Categoría, pregunta y respuesta son obligatorias' },
        { status: 400 }
      )
    }
    if (Array.isArray(roles) && roles.some((r: string) => !VALID_ROLES.has(r))) {
      return NextResponse.json({ success: false, message: 'Rol inválido' }, { status: 400 })
    }

    const created = await prisma.help_faqs.create({
      data: {
        id: randomUUID(),
        module: moduleId,
        category: category.trim(),
        question: question.trim(),
        answer: answer.trim(),
        mediaUrl: mediaUrl?.trim() || null,
        roles: Array.isArray(roles) ? roles : [],
        keywords: Array.isArray(keywords) ? keywords : [],
        order: typeof order === 'number' ? order : 0,
      },
    })

    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    console.error('[API] Error creando FAQ de ayuda:', error)
    return NextResponse.json(
      { success: false, message: 'Error al crear la pregunta' },
      { status: 500 }
    )
  }
}

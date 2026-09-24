/**
 * GET  /api/admin/help-faqs — lista TODAS las preguntas (activas e inactivas)
 *      para la pantalla de administración (Configuración Sistema → Ayuda).
 * POST /api/admin/help-faqs — crea una pregunta nueva.
 * Restringido a Super Admin, igual que el resto de las pestañas de
 * Configuración Sistema (OAuth, Backups, Almacenamiento) — un ADMIN de
 * familia no gestiona esto.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { HELP_MODULE_SECTIONS } from '@/features/help/data/faq-by-module'

const VALID_MODULES = new Set(HELP_MODULE_SECTIONS.map(s => s.id))
const VALID_ROLES = new Set(['ADMIN', 'TECHNICIAN', 'CLIENT'])

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const gate = await requireSuperAdmin(session)
    if (!gate.ok) {
      return NextResponse.json({ success: false, message: gate.error }, { status: gate.status })
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
    const gate = await requireSuperAdmin(session)
    if (!gate.ok) {
      return NextResponse.json({ success: false, message: gate.error }, { status: gate.status })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ success: false, message: 'JSON inválido' }, { status: 400 })
    }

    const { module: moduleId, category, question, answer, mediaUrl, roles, keywords, order } = body

    if (!VALID_MODULES.has(moduleId)) {
      return NextResponse.json({ success: false, message: 'Módulo inválido' }, { status: 400 })
    }
    // typeof antes de trim(): category/question/answer podrían no ser string
    // (ej. un número) — `?.trim` solo protege contra null/undefined, no contra
    // otros tipos, y llamar trim() sobre eso tira una excepción sin capturar
    // acá (cae al catch genérico y responde 500 en vez de un 400 claro).
    if (
      typeof category !== 'string' ||
      typeof question !== 'string' ||
      typeof answer !== 'string' ||
      !category.trim() ||
      !question.trim() ||
      !answer.trim()
    ) {
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
        mediaUrl: typeof mediaUrl === 'string' ? mediaUrl.trim() || null : null,
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

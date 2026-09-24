import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { HELP_FAQS } from '../../src/features/help/data/faq-by-module'

/**
 * Siembra la tabla `help_faqs` con el contenido que antes vivía hardcodeado
 * en `src/features/help/data/faq-by-module.ts` — a partir de ahora esa tabla
 * es la fuente real (editable desde Configuración Sistema → Ayuda). Solo
 * inserta lo que falte (match por `question` + `module`, no hay otro campo
 * único natural): correr el seed de nuevo no duplica ni pisa ediciones ya
 * hechas desde la pantalla de administración.
 */
export async function seedHelpFaqs(prisma: PrismaClient) {
  let created = 0

  for (const [index, faq] of HELP_FAQS.entries()) {
    const existing = await prisma.help_faqs.findFirst({
      where: { module: faq.module, question: faq.question },
      select: { id: true },
    })
    if (existing) continue

    await prisma.help_faqs.create({
      data: {
        id: randomUUID(),
        module: faq.module,
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        mediaUrl: faq.mediaUrl || null,
        roles: faq.roles || [],
        keywords: faq.keywords || [],
        order: index,
        isActive: true,
      },
    })
    created++
  }

  if (created > 0) {
    console.log(`  ✅ ${created} preguntas de ayuda creadas`)
  }
}

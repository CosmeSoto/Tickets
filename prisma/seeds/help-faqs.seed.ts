import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { HELP_FAQS } from '../../src/features/help/data/faq-by-module'

/**
 * Siembra la tabla `help_faqs` con el contenido que antes vivía hardcodeado
 * en `src/features/help/data/faq-by-module.ts` — a partir de ahora esa tabla
 * es la fuente real (editable desde Configuración Sistema → Ayuda). Solo
 * inserta lo que falte, usando el `id` del array semilla (ej. 'acc-1') como
 * `seedKey` — un identificador estable, no el texto de la pregunta. Antes el
 * match era por (module, question): si un admin editaba el texto de una
 * pregunta y alguien corría `npm run db:seed` de nuevo (documentado como
 * "seguro repetirlo" en README/SETUP), el seed ya no encontraba esa fila y
 * creaba un duplicado con el texto viejo. Con `seedKey` eso no puede pasar:
 * el seed nunca vuelve a tocar una fila ya sembrada, edite el admin lo que
 * edite, y nunca toca una fila creada desde la pantalla de administración
 * (esas tienen `seedKey: null`).
 */
export async function seedHelpFaqs(prisma: PrismaClient) {
  let created = 0

  for (const [index, faq] of HELP_FAQS.entries()) {
    const existing = await prisma.help_faqs.findUnique({
      where: { seedKey: faq.id },
      select: { id: true },
    })
    if (existing) continue

    await prisma.help_faqs.create({
      data: {
        id: randomUUID(),
        seedKey: faq.id,
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

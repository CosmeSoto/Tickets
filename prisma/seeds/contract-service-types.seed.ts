import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Catálogo inicial de tipos de servicio (contratos / suscripciones).
 * Idempotente: ON CONFLICT (code) actualiza nombre/orden.
 */
const CONTRACT_SERVICE_TYPES = [
  { code: 'SOCIAL_MEDIA', name: 'Redes sociales' },
  { code: 'CONTENT', name: 'Contenido / editorial' },
  { code: 'AUDIOVISUAL', name: 'Servicios audiovisuales' },
  { code: 'ARTIFICIAL_INTELLIGENCE', name: 'Inteligencia artificial' },
  { code: 'EDUCATION_LMS', name: 'Educación / LMS (Canvas, etc.)' },
  { code: 'CLOUD_SERVICES', name: 'Servicios en la nube' },
  { code: 'DESIGN', name: 'Diseño y creatividad' },
  { code: 'COMMUNICATIONS', name: 'Comunicaciones / internet' },
  { code: 'DIGITAL_ADS', name: 'Publicidad digital / Ads' },
  { code: 'OTHER', name: 'Otro servicio' },
] as const

export async function seedContractServiceTypes(prisma: PrismaClient) {
  for (const [i, t] of CONTRACT_SERVICE_TYPES.entries()) {
    const id = randomUUID()
    await prisma.$executeRaw`
      INSERT INTO contract_service_types (id, code, name, description, is_active, "order", created_at, updated_at)
      VALUES (${id}, ${t.code}, ${t.name}, NULL, true, ${i}, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        "order" = EXCLUDED."order",
        is_active = true,
        updated_at = NOW()
    `
  }
  console.log('✅ Tipos de servicio (contratos)')
}

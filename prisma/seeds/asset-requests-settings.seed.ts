import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Habilita solicitud de activos por familia (requerido para el formulario de compras).
 * Idempotente: seguro de ejecutar en seed completo y en ensure-catalogs.
 */
export async function seedAssetRequestsFamilySettings(
  prisma: PrismaClient,
  familyMap: Map<string, string>
) {
  const now = new Date()
  for (const familyId of familyMap.values()) {
    const key = `asset_requests_enabled_${familyId}`
    await prisma.system_settings.upsert({
      where: { key },
      update: { value: 'true' },
      create: {
        id: randomUUID(),
        key,
        value: 'true',
        description: 'Solicitud de activos habilitada para esta familia',
        updatedAt: now,
      },
    })
  }
  console.log(`✅ Solicitud de activos habilitada en ${familyMap.size} familias`)
}

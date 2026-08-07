import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const SUPPLIER_TYPES = [
  {
    code: 'EQUIPMENT',
    name: 'Equipos',
    description: 'Proveedor de equipos tecnológicos y hardware',
  },
  {
    code: 'CONSUMABLE',
    name: 'Suministros',
    description: 'Proveedor de materiales MRO y suministros',
  },
  { code: 'LICENSE', name: 'Licencias', description: 'Proveedor de software y licencias' },
  { code: 'MIXED', name: 'Mixto', description: 'Proveedor de múltiples categorías' },
  { code: 'SERVICE', name: 'Servicios', description: 'Proveedor de servicios y mantenimiento' },
  {
    code: 'ARCHITECTURE',
    name: 'Arquitectura',
    description: 'Proveedor de servicios de arquitectura',
    familyCode: 'ARCHITECTURE',
  },
  {
    code: 'OPERATIONS',
    name: 'Operaciones',
    description: 'Proveedor de servicios operativos y mantenimiento',
    familyCode: 'OPERATIONS',
  },
]

export async function seedSupplierTypes(prisma: PrismaClient, familyMap: Map<string, string>) {
  for (const [i, t] of SUPPLIER_TYPES.entries()) {
    const familyId = t.familyCode ? (familyMap.get(t.familyCode) ?? null) : null
    const id = randomUUID()
    await prisma.$executeRaw`
      INSERT INTO supplier_types (id, code, name, description, family_id, is_active, "order", created_at, updated_at)
      VALUES (${id}, ${t.code}, ${t.name}, ${t.description ?? null}, ${familyId}, true, ${i + 1}, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        family_id = EXCLUDED.family_id,
        "order" = EXCLUDED."order",
        updated_at = NOW()
    `
  }
  console.log('✅ Tipos de proveedor')
}

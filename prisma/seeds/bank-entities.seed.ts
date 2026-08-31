import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

// Bancos y entidades financieras más usados en Ecuador — sugerencias
// iniciales para el selector de "Banco / Entidad" (facturas de equipo, datos
// bancarios de proveedores). El admin puede agregar/editar/eliminar desde el
// propio selector; esto solo evita partir de una lista vacía.
const BANK_ENTITIES = [
  'Banco Pichincha',
  'Banco Guayaquil',
  'Banco del Pacífico',
  'Produbanco',
  'Banco Bolivariano',
  'Banco Internacional',
  'Banco General Rumiñahui',
  'Banco de Loja',
  'BanEcuador',
  'Diners Club del Ecuador',
  'Banco Solidario',
  'Cooperativa JEP',
]

export async function seedBankEntities(prisma: PrismaClient) {
  for (const [i, name] of BANK_ENTITIES.entries()) {
    const id = randomUUID()
    await prisma.$executeRaw`
      INSERT INTO bank_entities (id, name, is_active, "order", created_at, updated_at)
      VALUES (${id}, ${name}, true, ${i + 1}, NOW(), NOW())
      ON CONFLICT (name) DO NOTHING
    `
  }
  console.log('✅ Bancos/entidades')
}

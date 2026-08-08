import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const UNITS = [
  { code: 'UNIT', name: 'Unidad', symbol: 'ud', order: 1 },
  { code: 'BOX', name: 'Caja', symbol: 'caja', order: 2 },
  { code: 'PACK', name: 'Paquete', symbol: 'paq', order: 3 },
  { code: 'REAM', name: 'Resma', symbol: 'resma', order: 4 },
  { code: 'METER', name: 'Metro', symbol: 'm', order: 5 },
  { code: 'LITER', name: 'Litro', symbol: 'L', order: 6 },
  { code: 'KG', name: 'Kilogramo', symbol: 'kg', order: 7 },
  { code: 'SET', name: 'Juego', symbol: 'juego', order: 8 },
  // Consumo diario de oficina (dispensers / pantries)
  { code: 'BOTELLON', name: 'Botellón', symbol: 'bot', order: 9 },
  { code: 'GALLON', name: 'Galón', symbol: 'gal', order: 10 },
]

export async function seedUnitsOfMeasure(prisma: PrismaClient) {
  for (const u of UNITS) {
    await prisma.units_of_measure.upsert({
      where: { code: u.code },
      update: { name: u.name, symbol: u.symbol, order: u.order },
      create: { id: randomUUID(), ...u, isActive: true },
    })
  }
  console.log(`✅ ${UNITS.length} unidades de medida`)
}

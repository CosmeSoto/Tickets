import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

export async function seedEquipmentBrands(prisma: PrismaClient, familyMap: Map<string, string>) {
  const fam = (code: string) => familyMap.get(code)!
  const brands = [
    { code: 'DELL', name: 'Dell', order: 1, familyId: fam('TECHNOLOGY') },
    { code: 'APPLE', name: 'Apple', order: 2, familyId: fam('TECHNOLOGY') },
    { code: 'HP', name: 'HP', order: 3, familyId: fam('TECHNOLOGY') },
    { code: 'LENOVO', name: 'Lenovo', order: 4, familyId: fam('TECHNOLOGY') },
    { code: 'ASUS', name: 'Asus', order: 5, familyId: fam('TECHNOLOGY') },
    { code: 'ACER', name: 'Acer', order: 6, familyId: fam('TECHNOLOGY') },
    { code: 'MSI', name: 'MSI', order: 7, familyId: fam('TECHNOLOGY') },
    { code: 'SAMSUNG', name: 'Samsung', order: 8, familyId: fam('TECHNOLOGY') },
    { code: 'LG', name: 'LG', order: 9, familyId: fam('TECHNOLOGY') },
    { code: 'SONY', name: 'Sony', order: 10, familyId: fam('TECHNOLOGY') },
    { code: 'CANON', name: 'Canon', order: 11, familyId: fam('TECHNOLOGY') },
    { code: 'EPSON', name: 'Epson', order: 12, familyId: fam('TECHNOLOGY') },
    { code: 'BROTHER', name: 'Brother', order: 13, familyId: fam('TECHNOLOGY') },
    { code: 'CISCO', name: 'Cisco', order: 14, familyId: fam('TECHNOLOGY') },
    { code: 'TP_LINK', name: 'TP-Link', order: 15, familyId: fam('TECHNOLOGY') },
    { code: 'OTHER_BRAND', name: 'Otra Marca', order: 99, familyId: fam('TECHNOLOGY') },
  ]

  for (const b of brands) {
    await prisma.equipment_brands.upsert({
      where: { code: b.code },
      update: { name: b.name, order: b.order, familyId: b.familyId },
      create: { id: randomUUID(), ...b, isActive: true },
    })
  }
  console.log(`  ✓ ${brands.length} marcas de equipos`)
}

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const BASE_BRANDS = [
  { code: 'DELL', name: 'Dell', order: 1 },
  { code: 'APPLE', name: 'Apple', order: 2 },
  { code: 'HP', name: 'HP', order: 3 },
  { code: 'LENOVO', name: 'Lenovo', order: 4 },
  { code: 'ASUS', name: 'Asus', order: 5 },
  { code: 'ACER', name: 'Acer', order: 6 },
  { code: 'MSI', name: 'MSI', order: 7 },
  { code: 'SAMSUNG', name: 'Samsung', order: 8 },
  { code: 'LG', name: 'LG', order: 9 },
  { code: 'SONY', name: 'Sony', order: 10 },
  { code: 'CANON', name: 'Canon', order: 11 },
  { code: 'EPSON', name: 'Epson', order: 12 },
  { code: 'BROTHER', name: 'Brother', order: 13 },
  { code: 'CISCO', name: 'Cisco', order: 14 },
  { code: 'TP_LINK', name: 'TP-Link', order: 15 },
  { code: 'OTHER_BRAND', name: 'Otra Marca', order: 99 },
]

/** Familias que suelen registrar equipos con marca */
const BRAND_FAMILIES = [
  'TECHNOLOGY',
  'ARCHITECTURE',
  'OPERATIONS',
  'ADMINISTRATIVE',
  'COMMERCIAL',
  'MARKETING',
] as const

export async function seedEquipmentBrands(prisma: PrismaClient, familyMap: Map<string, string>) {
  let count = 0

  for (const familyCode of BRAND_FAMILIES) {
    const familyId = familyMap.get(familyCode)
    if (!familyId) continue

    for (const brand of BASE_BRANDS) {
      const code = familyCode === 'TECHNOLOGY' ? brand.code : `${brand.code}_${familyCode}`
      await prisma.equipment_brands.upsert({
        where: { code },
        update: { name: brand.name, order: brand.order, familyId, isActive: true },
        create: { id: randomUUID(), code, name: brand.name, order: brand.order, familyId, isActive: true },
      })
      count++
    }
  }

  console.log(`  ✓ ${count} marcas de equipos (${BRAND_FAMILIES.length} familias)`)
}

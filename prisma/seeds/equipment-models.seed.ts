/**
 * Seed: Equipment Models (Catálogo de Modelos de Equipos)
 *
 * Crea modelos de equipos de referencia para el formulario unificado.
 * Los modelos se asocian a los tipos de equipo existentes por código.
 * Usa upsert para ser idempotente.
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

interface ModelSeed {
  brand: string
  model: string
  typeCode: string
  standardPrice?: number
  defaultAccessories?: string[]
}

const MODELS: ModelSeed[] = [
  // LAPTOPS
  {
    brand: 'Dell',
    model: 'Latitude 5540',
    typeCode: 'LAPTOP',
    standardPrice: 1200,
    defaultAccessories: ['Cargador', 'Bolso'],
  },
  { brand: 'Dell', model: 'Latitude 5440', typeCode: 'LAPTOP', standardPrice: 1100 },
  {
    brand: 'HP',
    model: 'EliteBook 840 G10',
    typeCode: 'LAPTOP',
    standardPrice: 1300,
    defaultAccessories: ['Cargador'],
  },
  { brand: 'HP', model: 'ProBook 450 G10', typeCode: 'LAPTOP', standardPrice: 950 },
  {
    brand: 'Lenovo',
    model: 'ThinkPad E14 Gen 5',
    typeCode: 'LAPTOP',
    standardPrice: 1050,
    defaultAccessories: ['Cargador'],
  },
  { brand: 'Lenovo', model: 'IdeaPad 3 15', typeCode: 'LAPTOP', standardPrice: 750 },
  {
    brand: 'Apple',
    model: 'MacBook Air M2',
    typeCode: 'LAPTOP',
    standardPrice: 1499,
    defaultAccessories: ['Cargador USB-C'],
  },
  {
    brand: 'Apple',
    model: 'MacBook Pro M3',
    typeCode: 'LAPTOP',
    standardPrice: 1999,
    defaultAccessories: ['Cargador USB-C'],
  },
  { brand: 'Asus', model: 'ExpertBook B1 B1502', typeCode: 'LAPTOP', standardPrice: 850 },

  // DESKTOPS
  {
    brand: 'Dell',
    model: 'OptiPlex 7010',
    typeCode: 'DESKTOP',
    standardPrice: 900,
    defaultAccessories: ['Teclado', 'Mouse'],
  },
  {
    brand: 'HP',
    model: 'EliteDesk 800 G9',
    typeCode: 'DESKTOP',
    standardPrice: 950,
    defaultAccessories: ['Teclado', 'Mouse'],
  },
  { brand: 'Lenovo', model: 'ThinkCentre M70q', typeCode: 'DESKTOP', standardPrice: 800 },

  // MONITORES
  {
    brand: 'Dell',
    model: 'P2422H 24"',
    typeCode: 'MONITOR',
    standardPrice: 280,
    defaultAccessories: ['Cable HDMI', 'Cable DisplayPort'],
  },
  { brand: 'Dell', model: 'U2722D 27"', typeCode: 'MONITOR', standardPrice: 450 },
  { brand: 'HP', model: 'E24 G5 24"', typeCode: 'MONITOR', standardPrice: 260 },
  { brand: 'LG', model: '27UK850-W 27"', typeCode: 'MONITOR', standardPrice: 380 },
  { brand: 'Samsung', model: 'S27A600 27"', typeCode: 'MONITOR', standardPrice: 320 },

  // IMPRESORAS
  {
    brand: 'HP',
    model: 'LaserJet Pro M404dn',
    typeCode: 'PRINTER',
    standardPrice: 350,
    defaultAccessories: ['Cable USB', 'Tóner inicial'],
  },
  { brand: 'HP', model: 'LaserJet Pro MFP M428fdw', typeCode: 'PRINTER', standardPrice: 480 },
  {
    brand: 'Epson',
    model: 'EcoTank L3250',
    typeCode: 'PRINTER',
    standardPrice: 280,
    defaultAccessories: ['Botellas de tinta'],
  },
  { brand: 'Canon', model: 'PIXMA G3160', typeCode: 'PRINTER', standardPrice: 250 },
  { brand: 'Brother', model: 'HL-L2350DW', typeCode: 'PRINTER', standardPrice: 200 },

  // TELÉFONOS
  {
    brand: 'Cisco',
    model: 'IP Phone 7841',
    typeCode: 'PHONE',
    standardPrice: 180,
    defaultAccessories: ['Cable de red'],
  },
  { brand: 'Yealink', model: 'T46U', typeCode: 'PHONE', standardPrice: 150 },
  { brand: 'Grandstream', model: 'GXP2160', typeCode: 'PHONE', standardPrice: 120 },

  // TABLETS
  {
    brand: 'Apple',
    model: 'iPad 10th Gen',
    typeCode: 'TABLET',
    standardPrice: 449,
    defaultAccessories: ['Cargador', 'Funda'],
  },
  { brand: 'Samsung', model: 'Galaxy Tab S9', typeCode: 'TABLET', standardPrice: 699 },
  { brand: 'Lenovo', model: 'Tab M10 Plus', typeCode: 'TABLET', standardPrice: 280 },

  // TECLADOS
  { brand: 'Logitech', model: 'MK270 Wireless', typeCode: 'KEYBOARD', standardPrice: 35 },
  { brand: 'HP', model: 'USB Keyboard 125', typeCode: 'KEYBOARD', standardPrice: 20 },
  { brand: 'Dell', model: 'KB216 USB', typeCode: 'KEYBOARD', standardPrice: 18 },

  // MOUSE
  { brand: 'Logitech', model: 'M185 Wireless', typeCode: 'MOUSE', standardPrice: 25 },
  { brand: 'HP', model: 'USB Mouse 125', typeCode: 'MOUSE', standardPrice: 15 },
  { brand: 'Dell', model: 'MS116 USB', typeCode: 'MOUSE', standardPrice: 12 },

  // HEADSETS
  {
    brand: 'Jabra',
    model: 'Evolve2 30',
    typeCode: 'HEADSET',
    standardPrice: 120,
    defaultAccessories: ['Cable USB'],
  },
  { brand: 'Logitech', model: 'H390 USB', typeCode: 'HEADSET', standardPrice: 45 },
  { brand: 'Plantronics', model: 'Blackwire 3220', typeCode: 'HEADSET', standardPrice: 80 },

  // WEBCAMS
  {
    brand: 'Logitech',
    model: 'C920 HD Pro',
    typeCode: 'WEBCAM',
    standardPrice: 90,
    defaultAccessories: ['Cable USB'],
  },
  { brand: 'Logitech', model: 'C505 HD', typeCode: 'WEBCAM', standardPrice: 55 },

  // DOCKING STATIONS
  {
    brand: 'Dell',
    model: 'WD19S 180W',
    typeCode: 'DOCKING_STATION',
    standardPrice: 280,
    defaultAccessories: ['Cable USB-C', 'Adaptador de corriente'],
  },
  {
    brand: 'HP',
    model: 'USB-C G5 Essential Dock',
    typeCode: 'DOCKING_STATION',
    standardPrice: 250,
  },
  {
    brand: 'Lenovo',
    model: 'ThinkPad Universal USB-C Dock',
    typeCode: 'DOCKING_STATION',
    standardPrice: 220,
  },

  // UPS
  {
    brand: 'APC',
    model: 'Back-UPS 600VA',
    typeCode: 'UPS',
    standardPrice: 120,
    defaultAccessories: ['Cable de poder'],
  },
  { brand: 'APC', model: 'Smart-UPS 1500VA', typeCode: 'UPS', standardPrice: 450 },
  { brand: 'CyberPower', model: 'CP1000AVRLCD', typeCode: 'UPS', standardPrice: 150 },

  // ROUTERS
  {
    brand: 'Cisco',
    model: 'RV340 Dual WAN',
    typeCode: 'ROUTER',
    standardPrice: 350,
    defaultAccessories: ['Cable de red', 'Adaptador de corriente'],
  },
  { brand: 'MikroTik', model: 'hEX RB750Gr3', typeCode: 'ROUTER', standardPrice: 80 },
  { brand: 'Ubiquiti', model: 'UniFi Dream Machine', typeCode: 'ROUTER', standardPrice: 299 },

  // SWITCHES
  {
    brand: 'Cisco',
    model: 'SG350-28 28-Port',
    typeCode: 'SWITCH',
    standardPrice: 450,
    defaultAccessories: ['Cable de poder', 'Cables de rack'],
  },
  { brand: 'HP', model: 'Aruba 1930 24G', typeCode: 'SWITCH', standardPrice: 380 },
  { brand: 'Ubiquiti', model: 'UniFi Switch 24', typeCode: 'SWITCH', standardPrice: 320 },

  // SERVIDORES
  {
    brand: 'Dell',
    model: 'PowerEdge R350',
    typeCode: 'SERVER',
    standardPrice: 3500,
    defaultAccessories: ['Cables de poder', 'Rieles de rack'],
  },
  { brand: 'HP', model: 'ProLiant DL380 Gen10', typeCode: 'SERVER', standardPrice: 5000 },

  // CÁMARAS IP (SECURITY)
  {
    brand: 'Hikvision',
    model: 'DS-2CD2143G2-I 4MP',
    typeCode: 'IP_CAMERA',
    standardPrice: 120,
    defaultAccessories: ['Soporte de montaje', 'Cable de red'],
  },
  { brand: 'Dahua', model: 'IPC-HDW2831T-AS 8MP', typeCode: 'IP_CAMERA', standardPrice: 150 },
  { brand: 'Axis', model: 'P3245-V', typeCode: 'IP_CAMERA', standardPrice: 280 },

  // DVR/NVR
  {
    brand: 'Hikvision',
    model: 'DS-7608NI-K2 8CH',
    typeCode: 'DVR_NVR',
    standardPrice: 350,
    defaultAccessories: ['Disco duro 2TB', 'Mouse'],
  },
  { brand: 'Dahua', model: 'NVR4108HS-8P-4KS2 8CH', typeCode: 'DVR_NVR', standardPrice: 280 },
]

export async function seedEquipmentModels(prisma: PrismaClient) {
  console.log('🖥️  Creando catálogo de modelos de equipos...')

  // Obtener todos los tipos de equipo por código
  const types = await prisma.equipment_types.findMany({
    select: { id: true, code: true },
  })
  const typeMap = new Map(types.map(t => [t.code, t.id]))

  let created = 0
  let skipped = 0

  for (const m of MODELS) {
    const typeId = typeMap.get(m.typeCode)
    if (!typeId) {
      // El tipo no existe en esta instalación, saltar
      skipped++
      continue
    }

    await prisma.equipment_models.upsert({
      where: {
        brand_model_typeId: {
          brand: m.brand,
          model: m.model,
          typeId,
        },
      },
      update: {
        standardPrice: m.standardPrice,
        defaultAccessories: m.defaultAccessories ?? [],
        isActive: true,
      },
      create: {
        id: randomUUID(),
        brand: m.brand,
        model: m.model,
        typeId,
        standardPrice: m.standardPrice,
        defaultAccessories: m.defaultAccessories ?? [],
        isActive: true,
      },
    })
    created++
  }

  console.log(
    `  ✓ ${created} modelos creados/actualizados${skipped > 0 ? `, ${skipped} omitidos (tipo no encontrado)` : ''}`
  )
}

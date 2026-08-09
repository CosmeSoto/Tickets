import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const INVENTORY_SETTINGS = [
  {
    key: 'inventory.act_expiration_days',
    value: '7',
    description: 'Días de expiración para actas',
  },
  {
    key: 'inventory.low_stock_alert_enabled',
    value: 'true',
    description: 'Habilitar alertas de stock bajo',
  },
  {
    key: 'inventory.license_alert_enabled',
    value: 'true',
    description: 'Habilitar alertas de vencimiento de licencias y contratos',
  },
  {
    key: 'inventory.license_alert_days_first',
    value: '30',
    description: 'Días antes para primera alerta de licencias',
  },
  {
    key: 'inventory.license_alert_days_second',
    value: '7',
    description: 'Días antes para segunda alerta de licencias',
  },
  {
    key: 'inventory.contract_alert_days',
    value: '30',
    description: 'Días antes de vencimiento de contrato/renta para alerta',
  },
  {
    key: 'inventory.maintenance_alert_days',
    value: '30',
    description: 'Días de anticipación para mantenimientos programados (dashboard)',
  },
  {
    key: 'inventory.warranty_alert_days',
    value: '30',
    description: 'Días antes de vencimiento de garantía',
  },
  {
    key: 'inventory.warranty_alert_enabled',
    value: 'true',
    description: 'Habilita alertas de garantía de equipos',
  },
  {
    key: 'inventory.mro_expiry_alert_enabled',
    value: 'true',
    description: 'Habilita alertas de caducidad MRO',
  },
  {
    key: 'inventory.mro_expiry_alert_days',
    value: '30',
    description: 'Días antes de caducidad MRO para primera alerta',
  },
  {
    key: 'inventory.mro_expiry_alert_days_urgent',
    value: '7',
    description: 'Días antes de caducidad MRO para alerta urgente',
  },
  {
    key: 'inventory.batch_utilization_alert_enabled',
    value: 'true',
    description: 'Habilita alertas de utilización y stock en lotes',
  },
  {
    key: 'inventory.batch_utilization_email_critical',
    value: 'true',
    description: 'Envía email en alertas críticas de lotes',
  },
  {
    key: 'inventory.batch_utilization_email_warning',
    value: 'false',
    description: 'Envía email en alertas de advertencia de lotes',
  },
  {
    key: 'inventory.batch_low_stock_threshold_pct',
    value: '15',
    description: 'Porcentaje mínimo de stock disponible en lote antes de alertar',
  },
]

// ── Configuración de seguridad de contraseñas ──────────────────────────────
const SECURITY_SETTINGS = [
  {
    key: 'passwordChangeIntervalDays',
    value: '0',
    description:
      'Días de validez de la contraseña. 0 = sin expiración automática (solo fuerza cambio en próximo login cuando requirePasswordChange está activo).',
  },
]

export async function seedSecuritySettings(prisma: PrismaClient) {
  const now = new Date()
  for (const s of SECURITY_SETTINGS) {
    await prisma.system_settings.upsert({
      where: { key: s.key },
      update: { description: s.description },
      create: { id: randomUUID(), ...s, updatedAt: now },
    })
  }
  console.log(`✅ ${SECURITY_SETTINGS.length} configuraciones de seguridad de contraseñas`)
}

export async function seedInventorySettings(prisma: PrismaClient) {
  const now = new Date()
  for (const s of INVENTORY_SETTINGS) {
    await prisma.system_settings.upsert({
      where: { key: s.key },
      update: { description: s.description },
      create: { id: randomUUID(), ...s, updatedAt: now },
    })
  }
  console.log(`✅ ${INVENTORY_SETTINGS.length} configuraciones de inventario`)
}

export async function seedFolioCounters(prisma: PrismaClient) {
  const year = new Date().getFullYear()
  const types = ['ACT', 'DEV', 'BAJ']
  for (const type of types) {
    await prisma.folio_counters.upsert({
      where: { year_type: { year, type } },
      update: {},
      create: { id: randomUUID(), year, type, lastNumber: 0 },
    })
  }
  console.log(`✅ Contadores de folio (ACT, DEV, BAJ) para ${year}`)
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { invalidateBatchAlertSettingsCache } from '@/lib/inventory/batch-alert-settings'
import { invalidateSupplierQualificationThresholdsCache } from '@/lib/inventory/supplier-qualification'
import { logConfigAudit } from '@/lib/services/config-audit'
import { invalidateSettings } from '@/lib/api-cache'

const inventorySettingsSchema = z
  .object({
    // Sin default []: si el cliente no envía manager_ids, no se pisan en BD
    manager_ids: z.array(z.string()).optional(),
    act_expiration_days: z.number().min(1).max(30),
    low_stock_alert_enabled: z.boolean(),
    license_alert_enabled: z.boolean(),
    license_alert_days_first: z.number().min(1).max(90),
    license_alert_days_second: z.number().min(1).max(90),
    mro_expiry_alert_days: z.number().min(1).max(365).optional(),
    mro_expiry_alert_days_urgent: z.number().min(1).max(365).optional(),
    warranty_alert_days: z.number().min(1).max(365).optional(),
    contract_alert_days: z.number().min(1).max(365).optional(),
    maintenance_alert_days: z.number().min(1).max(365).optional(),
    mro_expiry_alert_enabled: z.boolean().optional(),
    warranty_alert_enabled: z.boolean().optional(),
    batch_utilization_alert_enabled: z.boolean().optional(),
    batch_utilization_email_critical: z.boolean().optional(),
    batch_utilization_email_warning: z.boolean().optional(),
    batch_low_stock_threshold_pct: z.number().min(5).max(50).optional(),
    supplier_qualification_min_a: z.number().int().min(0).max(30).optional(),
    supplier_qualification_min_b: z.number().int().min(0).max(30).optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.supplier_qualification_min_a !== undefined &&
      val.supplier_qualification_min_b !== undefined &&
      val.supplier_qualification_min_b >= val.supplier_qualification_min_a
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El mínimo de Clasificación B debe ser menor que el de Clasificación A',
        path: ['supplier_qualification_min_b'],
      })
    }
  })

const DEFAULT_SETTINGS: Record<string, string> = {
  manager_ids: '[]',
  act_expiration_days: '7',
  low_stock_alert_enabled: 'true',
  license_alert_enabled: 'true',
  license_alert_days_first: '30',
  license_alert_days_second: '7',
  mro_expiry_alert_days: '30',
  mro_expiry_alert_days_urgent: '7',
  warranty_alert_days: '30',
  contract_alert_days: '30',
  maintenance_alert_days: '30',
  mro_expiry_alert_enabled: 'true',
  warranty_alert_enabled: 'true',
  batch_utilization_alert_enabled: 'true',
  batch_utilization_email_critical: 'true',
  batch_utilization_email_warning: 'false',
  batch_low_stock_threshold_pct: '15',
  supplier_qualification_min_a: '25',
  supplier_qualification_min_b: '19',
}

const JSON_FIELDS = ['manager_ids']
const BOOLEAN_FIELDS = [
  'low_stock_alert_enabled',
  'license_alert_enabled',
  'mro_expiry_alert_enabled',
  'warranty_alert_enabled',
  'batch_utilization_alert_enabled',
  'batch_utilization_email_critical',
  'batch_utilization_email_warning',
]
const NUMBER_FIELDS = [
  'act_expiration_days',
  'license_alert_days_first',
  'license_alert_days_second',
  'mro_expiry_alert_days',
  'mro_expiry_alert_days_urgent',
  'warranty_alert_days',
  'contract_alert_days',
  'maintenance_alert_days',
  'batch_low_stock_threshold_pct',
  'supplier_qualification_min_a',
  'supplier_qualification_min_b',
]

async function loadInventorySettings(): Promise<Record<string, unknown>> {
  const settingsKeys = Object.keys(DEFAULT_SETTINGS)
  const dbSettings = await prisma.system_settings.findMany({
    where: { key: { in: settingsKeys.map(k => `inventory.${k}`) } },
  })

  const settings: Record<string, unknown> = {}
  for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
    const dbRow = dbSettings.find(s => s.key === `inventory.${key}`)
    const raw = dbRow?.value ?? defaultValue

    if (JSON_FIELDS.includes(key)) {
      try {
        settings[key] = JSON.parse(raw)
      } catch {
        settings[key] = JSON.parse(defaultValue)
      }
    } else if (BOOLEAN_FIELDS.includes(key)) {
      settings[key] = raw === 'true'
    } else if (NUMBER_FIELDS.includes(key)) {
      settings[key] = parseInt(raw) || parseInt(defaultValue)
    } else {
      settings[key] = raw
    }
  }

  return settings
}

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const role = session.user.role
    if (role !== 'ADMIN') {
      const { canManageInventory } = await import('@/lib/inventory-access')
      const manages = await canManageInventory(session.user.id, role)
      if (!manages) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    const settings = await loadInventorySettings()

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error obteniendo configuración de inventario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const gate = await requireSuperAdmin(session)
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const body = await request.json()
    const settings = inventorySettingsSchema.parse(body)
    const oldValues = await loadInventorySettings()

    const updatedKeys: string[] = []
    for (const [key, value] of Object.entries(settings)) {
      if (value === undefined) continue
      const serialized = JSON_FIELDS.includes(key) ? JSON.stringify(value) : String(value)

      await prisma.system_settings.upsert({
        where: { key: `inventory.${key}` },
        create: {
          id: crypto.randomUUID(),
          key: `inventory.${key}`,
          value: serialized,
          description: getSettingDescription(key),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        update: { value: serialized, updatedAt: new Date() },
      })
      updatedKeys.push(`inventory.${key}`)
    }

    invalidateBatchAlertSettingsCache()
    invalidateSupplierQualificationThresholdsCache()
    if (updatedKeys.length > 0) {
      await invalidateSettings(updatedKeys)
    }

    await logConfigAudit({
      action: 'inventory_settings_updated',
      entityType: 'inventory',
      entityId: 'global',
      userId: session!.user.id,
      userEmail: session!.user.email ?? null,
      oldValues,
      newValues: settings as Record<string, unknown>,
    })

    return NextResponse.json({ success: true, message: 'Configuración actualizada exitosamente' })
  } catch (error) {
    console.error('Error actualizando configuración de inventario:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

function getSettingDescription(key: string): string {
  const descriptions: Record<string, string> = {
    manager_ids: 'IDs de usuarios con acceso para gestionar el inventario',
    act_expiration_days: 'Días para expiración de actas de entrega',
    low_stock_alert_enabled: 'Habilita alertas de stock bajo',
    license_alert_enabled: 'Habilita alertas de vencimiento de licencias',
    license_alert_days_first: 'Días antes para primera alerta de licencias',
    license_alert_days_second: 'Días antes para segunda alerta de licencias',
    mro_expiry_alert_days: 'Días antes de caducidad MRO para primera alerta',
    mro_expiry_alert_days_urgent: 'Días antes de caducidad MRO para alerta urgente',
    warranty_alert_days: 'Días antes de vencimiento de garantía para alerta',
    contract_alert_days: 'Días antes de vencimiento de contrato para alerta',
    maintenance_alert_days: 'Días de anticipación para mantenimientos programados en el dashboard',
    mro_expiry_alert_enabled: 'Habilita alertas de caducidad MRO',
    warranty_alert_enabled: 'Habilita alertas de garantía de equipos',
    batch_utilization_alert_enabled: 'Habilita alertas de utilización y stock en lotes',
    batch_utilization_email_critical: 'Envía email en alertas críticas de lotes',
    batch_utilization_email_warning: 'Envía email en alertas de advertencia de lotes',
    batch_low_stock_threshold_pct: 'Porcentaje mínimo de stock disponible antes de alertar',
    supplier_qualification_min_a:
      'Puntaje total mínimo (sobre 30) para Clasificación A en calificación de proveedores',
    supplier_qualification_min_b:
      'Puntaje total mínimo (sobre 30) para Clasificación B en calificación de proveedores',
  }
  return descriptions[key] || ''
}

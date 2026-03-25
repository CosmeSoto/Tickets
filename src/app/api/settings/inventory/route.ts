import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const inventorySettingsSchema = z.object({
  manager_ids: z.array(z.string()).optional().default([]),
  act_expiration_days: z.number().min(1).max(30),
  low_stock_alert_enabled: z.boolean(),
  license_alert_enabled: z.boolean(),
  license_alert_days_first: z.number().min(1).max(90),
  license_alert_days_second: z.number().min(1).max(90),
})

const DEFAULT_SETTINGS: Record<string, string> = {
  manager_ids: '[]',
  act_expiration_days: '7',
  low_stock_alert_enabled: 'true',
  license_alert_enabled: 'true',
  license_alert_days_first: '30',
  license_alert_days_second: '7',
}

const JSON_FIELDS = ['manager_ids']
const BOOLEAN_FIELDS = ['low_stock_alert_enabled', 'license_alert_enabled']
const NUMBER_FIELDS = ['act_expiration_days', 'license_alert_days_first', 'license_alert_days_second']

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const settingsKeys = Object.keys(DEFAULT_SETTINGS)
    const dbSettings = await prisma.system_settings.findMany({
      where: { key: { in: settingsKeys.map(k => `inventory.${k}`) } },
    })

    const settings: Record<string, any> = {}
    for (const [key, defaultValue] of Object.entries(DEFAULT_SETTINGS)) {
      const dbRow = dbSettings.find(s => s.key === `inventory.${key}`)
      const raw = dbRow?.value ?? defaultValue

      if (JSON_FIELDS.includes(key)) {
        try { settings[key] = JSON.parse(raw) } catch { settings[key] = JSON.parse(defaultValue) }
      } else if (BOOLEAN_FIELDS.includes(key)) {
        settings[key] = raw === 'true'
      } else if (NUMBER_FIELDS.includes(key)) {
        settings[key] = parseInt(raw) || parseInt(defaultValue)
      } else {
        settings[key] = raw
      }
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error obteniendo configuración de inventario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const body = await request.json()
    const settings = inventorySettingsSchema.parse(body)

    for (const [key, value] of Object.entries(settings)) {
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
    }

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
  }
  return descriptions[key] || ''
}

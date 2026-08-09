import { NextResponse } from 'next/server'

const GONE_BODY = {
  error: 'Campos personalizados por familia fueron retirados. Usa atributos por tipo en Catálogos.',
  code: 'CUSTOM_FIELDS_REMOVED',
  replacement: 'Catálogos → atributos del tipo de activo',
}

/**
 * PUT /api/inventory/families/[familyId]/custom-fields/[fieldId]
 * @deprecated Retirado — atributos por tipo.
 */
export async function PUT() {
  return NextResponse.json(GONE_BODY, { status: 410 })
}

/**
 * DELETE /api/inventory/families/[familyId]/custom-fields/[fieldId]
 * @deprecated Retirado — atributos por tipo.
 */
export async function DELETE() {
  return NextResponse.json(GONE_BODY, { status: 410 })
}

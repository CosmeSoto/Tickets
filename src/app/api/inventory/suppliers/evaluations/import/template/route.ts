/**
 * GET /api/inventory/suppliers/evaluations/import/template
 *
 * Genera un Excel (.xlsx) de plantilla para la importación masiva de
 * calificaciones de proveedores (ver route.ts en el directorio padre), con:
 * - Hoja "Calificaciones" con columnas claras y ejemplos reales
 * - Hoja "Instrucciones" con guía paso a paso
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import * as XLSX from 'xlsx'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return inventoryForbidden()
  }

  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Calificaciones ────────────────────────────────────────────────

  const headers = [
    'Año',
    'Proveedor',
    'RUC/NIT',
    'Mail',
    'Contacto',
    'Detalle',
    'Calidad (0-5)',
    'Tiempo de crédito (0-5)',
    'Tiempo de entrega (0-5)',
    'Precio (0-5)',
    'Referencias (0-5)',
    'Equipo (0-5)',
  ]

  const examples = [
    [
      '2025',
      'Distribuidora Andina S.A.',
      '1790012345001',
      'ventas@andina.com',
      'María Pérez',
      'Suministro de repuestos eléctricos',
      '5',
      '4',
      '4',
      '3',
      '5',
      '4',
    ],
    [
      '2025',
      'Suministros del Norte Cía. Ltda.',
      '1791234567001',
      'contacto@snorte.com',
      'Juan Ramírez',
      'Mantenimiento de equipos de red',
      '4',
      '3',
      '5',
      '4',
      '4',
      '5',
    ],
  ]

  const wsData = [headers, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 8 }, // Año
    { wch: 30 }, // Proveedor
    { wch: 18 }, // RUC/NIT
    { wch: 26 }, // Mail
    { wch: 20 }, // Contacto
    { wch: 30 }, // Detalle
    { wch: 14 }, // Calidad
    { wch: 20 }, // Tiempo de crédito
    { wch: 20 }, // Tiempo de entrega
    { wch: 12 }, // Precio
    { wch: 16 }, // Referencias
    { wch: 12 }, // Equipo
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones')

  // ── Hoja 2: Instrucciones ─────────────────────────────────────────────────

  const instrucciones = [
    ['GUÍA DE IMPORTACIÓN DE CALIFICACIONES DE PROVEEDORES', '', '', ''],
    ['', '', '', ''],
    ['¿Cómo usar este archivo?', '', '', ''],
    ['1. Ve a la hoja "Calificaciones" y completa los datos siguiendo los ejemplos.', '', '', ''],
    ['2. Guarda el archivo como .xlsx o CSV (Archivo → Guardar como).', '', '', ''],
    ['3. En el sistema, haz clic en "Importar calificaciones" y sube el archivo.', '', '', ''],
    ['4. Revisa la vista previa antes de confirmar.', '', '', ''],
    ['', '', '', ''],
    ['COLUMNAS EXPLICADAS', '', '', ''],
    ['', '', '', ''],
    ['Columna', 'Obligatorio', 'Valores válidos', 'Ejemplo'],
    ['Año', 'SÍ', 'Año entre 2000 y 2100', '2025'],
    ['Proveedor', 'SÍ', 'Nombre del proveedor', 'Distribuidora Andina S.A.'],
    [
      'RUC/NIT',
      'No (recomendado)',
      'Texto libre, máx. 20 caracteres — si viene, se usa primero para ubicar/crear el proveedor (más confiable que el nombre)',
      '1790012345001',
    ],
    ['Mail', 'No', 'Correo del proveedor (solo se usa si hay que crearlo)', 'ventas@andina.com'],
    ['Contacto', 'No', 'Nombre de la persona de contacto', 'María Pérez'],
    ['Detalle', 'No', 'Descripción del servicio o suministro evaluado', 'Suministro de repuestos'],
    ['Calidad (0-5)', 'SÍ', 'Número entero de 0 a 5', '5'],
    ['Tiempo de crédito (0-5)', 'SÍ', 'Número entero de 0 a 5', '4'],
    ['Tiempo de entrega (0-5)', 'SÍ', 'Número entero de 0 a 5', '4'],
    ['Precio (0-5)', 'SÍ', 'Número entero de 0 a 5', '3'],
    ['Referencias (0-5)', 'SÍ', 'Número entero de 0 a 5', '5'],
    ['Equipo (0-5)', 'SÍ', 'Número entero de 0 a 5', '4'],
    ['', '', '', ''],
    ['CONSEJOS IMPORTANTES', '', '', ''],
    ['', '', '', ''],
    [
      '✓ Si el proveedor ya existe en el sistema, se ubica por RUC/NIT (o por nombre exacto si no hay RUC) y no se duplica.',
      '',
      '',
      '',
    ],
    [
      '✓ Si el proveedor NO existe, se crea automáticamente con los datos de la fila (Nombre, RUC/NIT, Mail, Contacto) y el Área por defecto elegida al importar.',
      '',
      '',
      '',
    ],
    [
      '✓ Sin un área por defecto seleccionada, las filas de proveedores nuevos fallarán (a menos que seas Super Admin); las de proveedores ya existentes se importan igual.',
      '',
      '',
      '',
    ],
    ['✓ Puedes incluir varias filas del mismo proveedor para distintos años.', '', '', ''],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones)
  wsInstr['!cols'] = [{ wch: 55 }, { wch: 16 }, { wch: 70 }, { wch: 25 }]

  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-calificaciones-proveedores.xlsx"',
    },
  })
}

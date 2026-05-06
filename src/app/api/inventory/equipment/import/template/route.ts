import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

/**
 * GET /api/inventory/equipment/import/template
 * Genera un Excel (.xlsx) con plantilla para importación masiva de equipos.
 * - Hoja "Equipos" con columnas, validaciones y ejemplos
 * - Hoja "Instrucciones" con guía paso a paso
 * - Hoja "Valores válidos" con enums y catálogos
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Equipos ───────────────────────────────────────────────────────
  const headers = [
    'Código',
    'N° de Serie *',
    'Marca *',
    'Modelo *',
    'Tipo de equipo *',
    'Modo de adquisición *',
    'Estado',
    'Condición',
    'Bodega',
    'Ubicación física',
    'Proveedor',
    'N° Factura',
    'Fecha de compra',
    'Precio de compra',
    'Vida útil (años)',
    'Valor residual',
    'Método depreciación',
    'Accesorios',
    'Especificaciones',
    'Notas',
  ]

  const examples = [
    [
      '',                    // Código (auto si vacío)
      'SN-LAP-2026-001',    // N° Serie
      'Dell',               // Marca
      'Latitude 5430',      // Modelo
      'Laptop',             // Tipo (nombre exacto)
      'FIXED_ASSET',        // Modo adquisición
      'AVAILABLE',          // Estado
      'NEW',                // Condición
      'Bodega Principal',   // Bodega (nombre exacto)
      'Piso 2 - Rack A',   // Ubicación física
      'Free com',           // Proveedor (nombre exacto)
      'FAC-2026-001',       // N° Factura
      '2026-01-15',         // Fecha compra (YYYY-MM-DD)
      '1200.00',            // Precio
      '5',                  // Vida útil
      '200.00',             // Valor residual
      'LINEAR',             // Método depreciación
      'Cargador,Mouse',     // Accesorios (separados por coma)
      'RAM:16GB;CPU:i7',    // Especificaciones (clave:valor separados por ;)
      'Equipo nuevo 2026',  // Notas
    ],
    [
      'TECHNO-EQ-FA-2026-002',
      'SN-MON-2026-001',
      'LG',
      '27UK850-W',
      'Monitor',
      'FIXED_ASSET',
      'AVAILABLE',
      'NEW',
      'Bodega Principal',
      '',
      '',
      '',
      '2026-02-01',
      '450.00',
      '5',
      '50.00',
      'LINEAR',
      'Cable HDMI,Cable DisplayPort',
      'Resolución:4K;Panel:IPS',
      '',
    ],
    [
      '',
      'SN-PRINT-2026-001',
      'HP',
      'LaserJet Pro M404n',
      'Impresora',
      'RENTAL',
      'AVAILABLE',
      'GOOD',
      '',
      'Recepción',
      'Free com',
      '',
      '',
      '',
      '',
      '',
      '',
      'Cable USB',
      '',
      'Equipo en alquiler mensual',
    ],
  ]

  const wsData = [headers, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = [
    { wch: 26 }, // Código
    { wch: 22 }, // N° Serie
    { wch: 14 }, // Marca
    { wch: 20 }, // Modelo
    { wch: 20 }, // Tipo
    { wch: 22 }, // Modo adquisición
    { wch: 14 }, // Estado
    { wch: 14 }, // Condición
    { wch: 20 }, // Bodega
    { wch: 22 }, // Ubicación física
    { wch: 18 }, // Proveedor
    { wch: 16 }, // N° Factura
    { wch: 16 }, // Fecha compra
    { wch: 16 }, // Precio
    { wch: 16 }, // Vida útil
    { wch: 16 }, // Valor residual
    { wch: 22 }, // Método depreciación
    { wch: 24 }, // Accesorios
    { wch: 28 }, // Especificaciones
    { wch: 28 }, // Notas
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Equipos')

  // ── Hoja 2: Valores válidos ───────────────────────────────────────────────
  const valoresData = [
    ['VALORES VÁLIDOS PARA CADA COLUMNA', '', ''],
    ['', '', ''],
    ['Modo de adquisición', '', ''],
    ['FIXED_ASSET', 'Activo Fijo', ''],
    ['RENTAL', 'Alquiler / Renta', ''],
    ['LOAN', 'Préstamo', ''],
    ['', '', ''],
    ['Estado', '', ''],
    ['AVAILABLE', 'Disponible (por defecto)', ''],
    ['ASSIGNED', 'Asignado', ''],
    ['MAINTENANCE', 'En mantenimiento', ''],
    ['DAMAGED', 'Dañado', ''],
    ['RETIRED', 'Retirado', ''],
    ['', '', ''],
    ['Condición', '', ''],
    ['NEW', 'Nuevo (por defecto)', ''],
    ['LIKE_NEW', 'Como Nuevo', ''],
    ['GOOD', 'Bueno', ''],
    ['FAIR', 'Regular', ''],
    ['POOR', 'Malo', ''],
    ['', '', ''],
    ['Método de depreciación', '', ''],
    ['LINEAR', 'Línea recta', ''],
    ['DECLINING_BALANCE', 'Saldo decreciente', ''],
    ['UNITS_OF_PRODUCTION', 'Unidades de producción', ''],
    ['', '', ''],
    ['Accesorios', '', ''],
    ['Separar con coma', 'Ej: Cargador,Mouse,Funda', ''],
    ['', '', ''],
    ['Especificaciones', '', ''],
    ['Formato clave:valor', 'Separar pares con punto y coma', ''],
    ['Ejemplo', 'RAM:16GB;CPU:Intel i7;SSD:512GB', ''],
    ['', '', ''],
    ['Fecha de compra', '', ''],
    ['Formato', 'YYYY-MM-DD', 'Ej: 2026-01-15'],
  ]

  const wsValores = XLSX.utils.aoa_to_sheet(valoresData)
  wsValores['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsValores, 'Valores válidos')

  // ── Hoja 3: Instrucciones ─────────────────────────────────────────────────
  const instrData = [
    ['GUÍA DE IMPORTACIÓN MASIVA DE EQUIPOS', '', ''],
    ['', '', ''],
    ['¿Cómo usar este archivo?', '', ''],
    ['1. Completa la hoja "Equipos" con los datos de tus activos.', '', ''],
    ['2. Consulta la hoja "Valores válidos" para los campos con opciones fijas.', '', ''],
    ['3. Guarda como CSV (Archivo → Guardar como → CSV UTF-8) o deja como .xlsx.', '', ''],
    ['4. En el sistema, ve a Inventario → Importar equipos y sube el archivo.', '', ''],
    ['5. Revisa la vista previa antes de confirmar la importación.', '', ''],
    ['', '', ''],
    ['COLUMNAS EXPLICADAS', '', ''],
    ['', '', ''],
    ['Columna', 'Obligatorio', 'Descripción'],
    ['Código', 'No', 'Si se omite, se genera automáticamente según la familia'],
    ['N° de Serie *', 'SÍ', 'Número de serie único del equipo'],
    ['Marca *', 'SÍ', 'Fabricante del equipo (Dell, HP, Lenovo, etc.)'],
    ['Modelo *', 'SÍ', 'Modelo específico del equipo'],
    ['Tipo de equipo *', 'SÍ', 'Nombre exacto del tipo (ver catálogo en el sistema)'],
    ['Modo de adquisición *', 'SÍ', 'FIXED_ASSET, RENTAL o LOAN'],
    ['Estado', 'No', 'AVAILABLE por defecto. Ver hoja "Valores válidos"'],
    ['Condición', 'No', 'NEW por defecto. Ver hoja "Valores válidos"'],
    ['Bodega', 'No', 'Nombre exacto de la bodega (debe existir en el sistema)'],
    ['Ubicación física', 'No', 'Descripción libre de la ubicación física'],
    ['Proveedor', 'No', 'Nombre exacto del proveedor (debe existir en el sistema)'],
    ['N° Factura', 'No', 'Número de factura de compra'],
    ['Fecha de compra', 'No', 'Formato YYYY-MM-DD (ej: 2026-01-15)'],
    ['Precio de compra', 'No', 'Valor numérico en USD (ej: 1200.00)'],
    ['Vida útil (años)', 'No', 'Número entero de años (ej: 5)'],
    ['Valor residual', 'No', 'Valor numérico en USD al final de la vida útil'],
    ['Método depreciación', 'No', 'LINEAR, DECLINING_BALANCE o UNITS_OF_PRODUCTION'],
    ['Accesorios', 'No', 'Lista separada por comas (ej: Cargador,Mouse,Funda)'],
    ['Especificaciones', 'No', 'Pares clave:valor separados por ; (ej: RAM:16GB;CPU:i7)'],
    ['Notas', 'No', 'Observaciones adicionales del equipo'],
    ['', '', ''],
    ['NOTAS IMPORTANTES', '', ''],
    ['', '', ''],
    ['✓ Los campos marcados con * son obligatorios.', '', ''],
    ['✓ El Tipo de equipo debe coincidir exactamente con el nombre en el sistema.', '', ''],
    ['✓ La Bodega y el Proveedor deben existir previamente en el sistema.', '', ''],
    ['✓ Si el Código está vacío, se genera automáticamente.', '', ''],
    ['✓ Máximo 500 equipos por importación.', '', ''],
    ['✓ Los equipos duplicados (mismo N° de serie) se reportan como error.', '', ''],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrData)
  wsInstr['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 55 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-equipos.xlsx"',
    },
  })
}

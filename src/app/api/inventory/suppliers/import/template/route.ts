/**
 * GET /api/inventory/suppliers/import/template
 *
 * Genera un Excel (.xlsx) de plantilla para la importación masiva de
 * proveedores (ver route.ts en este mismo directorio), con:
 * - Hoja "Proveedores" con columnas claras y ejemplos reales
 * - Hoja "Instrucciones" con guía paso a paso y valores válidos para los
 *   campos de catálogo/enum (Tipo de proveedor, Método de pago, etc.)
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import {
  SUPPLIER_BANK_ACCOUNT_TYPE_LABELS,
  SUPPLIER_PAYMENT_TERMS_OPTIONS,
} from '@/lib/validations/inventory/supplier'
import { PAYMENT_METHOD_TYPE_LABELS } from '@/types/contracts'
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

  // ── Hoja 1: Proveedores ───────────────────────────────────────────────────

  const headers = [
    'Nombre *',
    'RUC/NIT',
    'Email',
    'Teléfono',
    'Contacto',
    'Área',
    'Razón social legal',
    'Tipo de proveedor',
    'Sitio web',
    'Dirección',
    'Ciudad',
    'País',
    'Plazo de pago',
    'Límite de crédito',
    'Moneda',
    'Método de pago',
    'Banco',
    'Cuenta bancaria',
    'Tipo de cuenta',
    'SWIFT/BIC',
    'Notas',
  ]

  const examples = [
    [
      'Distribuidora Andina S.A.',
      '1790012345001',
      'ventas@andina.com',
      '0991234567',
      'María Pérez',
      'TI',
      'Distribuidora Andina Sociedad Anónima',
      '',
      'https://andina.com',
      'Av. Amazonas N30-100',
      'Quito',
      'Ecuador',
      '30 días',
      '5000',
      'USD',
      'Transferencia bancaria',
      'Banco Pichincha',
      '2201234567',
      'Cuenta corriente',
      '',
      '',
    ],
    [
      'Global Parts Inc.',
      'EIN 87-1234567',
      'sales@globalparts.com',
      '+1 305 555 0134',
      'John Smith',
      '',
      '',
      '',
      'https://globalparts.com',
      '',
      'Miami',
      'Estados Unidos',
      '',
      '',
      'USD',
      '',
      '',
      '',
      '',
      'GLPTUS33',
      '',
    ],
  ]

  const wsData = [headers, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = headers.map(h => ({ wch: Math.max(14, Math.min(30, h.length + 6)) }))

  XLSX.utils.book_append_sheet(wb, ws, 'Proveedores')

  // ── Hoja 2: Instrucciones ─────────────────────────────────────────────────

  const paymentTermsLabels = SUPPLIER_PAYMENT_TERMS_OPTIONS.map(o => o.label).join(' | ')
  const paymentMethodLabels = Object.values(PAYMENT_METHOD_TYPE_LABELS).join(' | ')
  const bankAccountTypeLabels = Object.values(SUPPLIER_BANK_ACCOUNT_TYPE_LABELS).join(' | ')

  const instrucciones = [
    ['GUÍA DE IMPORTACIÓN DE PROVEEDORES', '', '', ''],
    ['', '', '', ''],
    ['¿Cómo usar este archivo?', '', '', ''],
    ['1. Ve a la hoja "Proveedores" y completa los datos siguiendo los ejemplos.', '', '', ''],
    ['2. Guarda el archivo como .xlsx o CSV (Archivo → Guardar como).', '', '', ''],
    ['3. En el sistema, haz clic en "Importar proveedores" y sube el archivo.', '', '', ''],
    ['4. Revisa la vista previa antes de confirmar.', '', '', ''],
    ['', '', '', ''],
    ['Solo "Nombre" es obligatorio. El resto de columnas son opcionales: si no', '', '', ''],
    ['las llenas, quedan vacías y las puedes completar luego desde el sistema.', '', '', ''],
    ['', '', '', ''],
    ['COLUMNAS EXPLICADAS', '', '', ''],
    ['', '', '', ''],
    ['Columna', 'Obligatorio', 'Valores válidos', 'Ejemplo'],
    ['Nombre *', 'SÍ', 'Cualquier texto', 'Distribuidora Andina S.A.'],
    [
      'RUC/NIT',
      'No (recomendado)',
      'Texto libre, máx. 20 caracteres — admite RUC de Ecuador y NIT, VAT, EIN u otros identificadores tributarios extranjeros',
      '1790012345001',
    ],
    ['Email', 'No', 'Correo válido', 'ventas@andina.com'],
    ['Teléfono', 'No', 'Cualquier formato', '0991234567'],
    ['Contacto', 'No', 'Nombre de la persona de contacto', 'María Pérez'],
    ['Área', 'No', 'Nombre o código del área/familia existente en el sistema', 'TI'],
    ['Razón social legal', 'No', 'Cualquier texto', 'Distribuidora Andina Sociedad Anónima'],
    [
      'Tipo de proveedor',
      'No',
      'Nombre o código de un tipo existente en el sistema (Configuración → Tipos de proveedor)',
      'Repuestos',
    ],
    ['Sitio web', 'No', 'URL', 'https://andina.com'],
    ['Dirección', 'No', 'Cualquier texto', 'Av. Amazonas N30-100'],
    ['Ciudad', 'No', 'Cualquier texto', 'Quito'],
    ['País', 'No', 'Cualquier texto', 'Ecuador'],
    ['Plazo de pago', 'No', `Número de días, o una de: ${paymentTermsLabels}`, '30 días'],
    ['Límite de crédito', 'No', 'Número (admite coma o punto decimal)', '5000'],
    ['Moneda', 'No', 'Código de 3 letras (ISO 4217)', 'USD'],
    ['Método de pago', 'No', `Una de: ${paymentMethodLabels}`, 'Transferencia bancaria'],
    ['Banco', 'No', 'Cualquier texto', 'Banco Pichincha'],
    ['Cuenta bancaria', 'No', 'Cualquier texto', '2201234567'],
    ['Tipo de cuenta', 'No', `Una de: ${bankAccountTypeLabels}`, 'Cuenta corriente'],
    ['SWIFT/BIC', 'No', 'Código SWIFT/BIC', 'GLPTUS33'],
    ['Notas', 'No', 'Texto libre', ''],
    ['', '', '', ''],
    ['CONSEJOS IMPORTANTES', '', '', ''],
    ['', '', '', ''],
    [
      '✓ Si conoces el RUC/NIT, inclúyelo: evita crear duplicados de proveedores ya existentes.',
      '',
      '',
      '',
    ],
    [
      '✓ Si la fila no trae Área y no hay un área por defecto seleccionada, el sistema fallará esa fila (a menos que seas Super Admin).',
      '',
      '',
      '',
    ],
    [
      '✓ Si "Tipo de proveedor" o "Método de pago" o "Tipo de cuenta" no coinciden con ningún valor válido, esa fila fallará con el motivo indicado — corrígela y vuelve a intentar solo esas filas.',
      '',
      '',
      '',
    ],
    ['✓ Máximo 500 proveedores por importación.', '', '', ''],
    [
      '✓ Si un proveedor ya existe (mismo RUC/NIT o mismo nombre), se omite y se reporta — nunca se sobrescribe.',
      '',
      '',
      '',
    ],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones)
  wsInstr['!cols'] = [{ wch: 55 }, { wch: 16 }, { wch: 70 }, { wch: 30 }]

  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-proveedores.xlsx"',
    },
  })
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import * as XLSX from 'xlsx'

/**
 * GET /api/categories/import/template
 * Genera un Excel (.xlsx) amigable con:
 * - Hoja "Categorías" con columnas claras, ejemplos reales y jerarquía visual
 * - Hoja "Instrucciones" con guía paso a paso
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const wb = XLSX.utils.book_new()

  // ── Hoja 1: Categorías ────────────────────────────────────────────────────

  // Encabezados amigables
  const headers = [
    'Nombre *',
    'Descripción',
    'Nivel (1-4)',
    'Categoría Padre',
    'Departamento',
    'Área / Familia',
    'Color (hex)',
    'Activa (true/false)',
  ]

  // Ejemplos que muestran una jerarquía real y comprensible
  const examples = [
    // Nivel 1 — categorías principales
    [
      'Soporte Técnico',
      'Problemas de hardware y software',
      '1',
      '',
      'Sistemas',
      'TI',
      '#3B82F6',
      'true',
    ],
    [
      'Redes y Conectividad',
      'Problemas de red e internet',
      '1',
      '',
      'Infraestructura',
      'TI',
      '#EF4444',
      'true',
    ],
    [
      'Recursos Humanos',
      'Solicitudes del área de RRHH',
      '1',
      '',
      'RRHH',
      'RRHH',
      '#10B981',
      'true',
    ],
    // Nivel 2 — subcategorías (padre = nombre exacto del nivel 1)
    [
      'Hardware',
      'Equipos físicos: laptops, monitores, etc.',
      '2',
      'Soporte Técnico',
      'Sistemas',
      'TI',
      '#60A5FA',
      'true',
    ],
    [
      'Software',
      'Aplicaciones, sistemas operativos, licencias',
      '2',
      'Soporte Técnico',
      'Sistemas',
      'TI',
      '#818CF8',
      'true',
    ],
    [
      'WiFi',
      'Problemas de conexión inalámbrica',
      '2',
      'Redes y Conectividad',
      'Infraestructura',
      'TI',
      '#F87171',
      'true',
    ],
    // Nivel 3 — especialidades (padre = nombre exacto del nivel 2)
    [
      'Laptops',
      'Fallas en laptops y portátiles',
      '3',
      'Hardware',
      'Sistemas',
      'TI',
      '#93C5FD',
      'true',
    ],
    [
      'Impresoras',
      'Problemas con impresoras y escáneres',
      '3',
      'Hardware',
      'Sistemas',
      'TI',
      '#6EE7B7',
      'true',
    ],
    [
      'Vacaciones',
      'Solicitudes de vacaciones y permisos',
      '3',
      'Recursos Humanos',
      'RRHH',
      'RRHH',
      '#34D399',
      'true',
    ],
  ]

  const wsData = [headers, ...examples]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Ancho de columnas
  ws['!cols'] = [
    { wch: 28 }, // Nombre
    { wch: 42 }, // Descripción
    { wch: 14 }, // Nivel
    { wch: 28 }, // Padre
    { wch: 22 }, // Departamento
    { wch: 18 }, // Área
    { wch: 14 }, // Color
    { wch: 20 }, // Activa
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Categorías')

  // ── Hoja 2: Instrucciones ─────────────────────────────────────────────────

  const instrucciones = [
    ['GUÍA DE IMPORTACIÓN DE CATEGORÍAS', '', '', ''],
    ['', '', '', ''],
    ['¿Cómo usar este archivo?', '', '', ''],
    ['1. Ve a la hoja "Categorías" y completa los datos siguiendo los ejemplos.', '', '', ''],
    ['2. Guarda el archivo como CSV (Archivo → Guardar como → CSV UTF-8).', '', '', ''],
    ['3. En el sistema, haz clic en "Importar" y sube el archivo CSV.', '', '', ''],
    ['4. Revisa la vista previa antes de confirmar.', '', '', ''],
    ['', '', '', ''],
    ['COLUMNAS EXPLICADAS', '', '', ''],
    ['', '', '', ''],
    ['Columna', 'Obligatorio', 'Valores válidos', 'Ejemplo'],
    ['Nombre *', 'SÍ', 'Cualquier texto', 'Soporte Técnico'],
    ['Descripción', 'No', 'Texto descriptivo', 'Problemas de hardware y software'],
    ['Nivel (1-4)', 'No', '1=Principal  2=Subcategoría  3=Especialidad  4=Detalle', '1'],
    [
      'Categoría Padre',
      'No',
      'Nombre EXACTO de la categoría padre (vacío si es nivel 1)',
      'Soporte Técnico',
    ],
    ['Departamento', 'No', 'Nombre del departamento', 'Sistemas'],
    ['Área / Familia', 'No', 'Código o nombre del área', 'TI'],
    ['Color (hex)', 'No', 'Código de color hexadecimal', '#3B82F6'],
    ['Activa (true/false)', 'No', 'true = activa   false = inactiva', 'true'],
    ['', '', '', ''],
    ['JERARQUÍA DE NIVELES', '', '', ''],
    ['', '', '', ''],
    ['Nivel 1 → Categoría Principal   (sin padre)', '', '', ''],
    ['  Nivel 2 → Subcategoría        (padre = nombre del nivel 1)', '', '', ''],
    ['    Nivel 3 → Especialidad      (padre = nombre del nivel 2)', '', '', ''],
    ['      Nivel 4 → Detalle         (padre = nombre del nivel 3)', '', '', ''],
    ['', '', '', ''],
    ['CONSEJOS IMPORTANTES', '', '', ''],
    ['', '', '', ''],
    [
      '✓ El nombre del padre debe ser EXACTAMENTE igual al nombre de la categoría padre.',
      '',
      '',
      '',
    ],
    ['✓ Si el nivel se omite, se calcula automáticamente según el padre.', '', '', ''],
    ['✓ Puedes crear padres e hijos en el mismo archivo — el sistema los resuelve.', '', '', ''],
    ['✓ Máximo 500 categorías por importación.', '', '', ''],
    ['✓ Si una categoría ya existe (mismo nombre), depende del modo elegido:', '', '', ''],
    ['   • Agregar: la omite (no la toca)', '', '', ''],
    ['   • Agregar y actualizar: actualiza descripción, color y estado', '', '', ''],
    ['   • Reemplazar área: elimina las existentes y crea las del archivo', '', '', ''],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrucciones)
  wsInstr['!cols'] = [{ wch: 55 }, { wch: 14 }, { wch: 50 }, { wch: 25 }]

  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instrucciones')

  // Generar buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-categorias.xlsx"',
    },
  })
}

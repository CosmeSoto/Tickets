/**
 * Utilidad para parsear archivos de importación masiva.
 * Soporta CSV (texto plano) y Excel (.xlsx).
 * Devuelve siempre un array de arrays de strings (filas × columnas).
 */
import * as XLSX from 'xlsx'

/**
 * Parsea un archivo CSV o Excel y devuelve las filas como arrays de strings.
 * - CSV: separa por comas respetando comillas
 * - Excel: lee la primera hoja y convierte todas las celdas a string
 */
export async function parseImportFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcel(file)
  }

  // CSV / TXT
  const text = await file.text()
  return parseCSVText(text)
}

async function parseExcel(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false })

  // Usar la primera hoja que no sea "Instrucciones" ni "Valores válidos"
  const sheetName =
    wb.SheetNames.find(
      n => !['instrucciones', 'valores válidos', 'valores validos'].includes(n.toLowerCase())
    ) ?? wb.SheetNames[0]

  const ws = wb.Sheets[sheetName]
  if (!ws) return []

  // Convertir a array de arrays — raw: true para obtener valores sin formato
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: false, // false = formatear fechas como strings legibles
  })

  // Filtrar filas completamente vacías y convertir todo a string
  return raw
    .filter(row => row.some(cell => cell !== '' && cell != null))
    .map(row => row.map(cell => (cell == null ? '' : String(cell).trim())))
}

function parseCSVText(text: string): string[][] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  return lines.map(line => {
    const cols: string[] = []
    let current = ''
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue }
      current += ch
    }
    cols.push(current.trim())
    return cols
  })
}

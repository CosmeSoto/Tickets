import { getCachedBranding } from '@/lib/branding-cache'
/**
 * Utilidades de exportación globales — CSV, Excel (xlsx), PDF (print)
 *
 * Diseño:
 * - Sin dependencias de UI — funciona en cualquier contexto cliente
 * - CSV: nativo, sin librerías extra
 * - Excel: usa `xlsx` (ya instalado)
 * - PDF: window.print() con CSS @media print — sin librerías extra, produce PDFs limpios
 *
 * Uso:
 *   import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/utils/export'
 *   exportToCSV({ filename: 'tickets', columns, rows })
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ExportColumn {
  /** Clave del campo en el objeto de datos (opcional si se usa accessor) */
  key?: string
  /** Encabezado legible para el usuario */
  label?: string
  /** Alias para label (compatibilidad) */
  header?: string
  /** Función para extraer el valor (alternativa a key) */
  accessor?: string | ((row: any) => any)
  /** Transformación opcional del valor antes de exportar */
  format?: (value: any, row: any) => string
}

export interface ExportOptions<T = any> {
  filename: string
  columns: ExportColumn[]
  rows: T[]
  /** Título para el PDF (opcional) */
  title?: string
  /** Subtítulo / descripción para el PDF (opcional) */
  subtitle?: string
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Extrae el valor de texto plano de una celda */
function getCellText<T>(row: T, col: ExportColumn): string {
  let raw: any

  // Soportar tanto key como accessor
  if (col.accessor) {
    if (typeof col.accessor === 'function') {
      raw = col.accessor(row)
    } else {
      raw = (row as any)[col.accessor]
    }
  } else if (col.key) {
    raw = (row as any)[col.key]
  } else {
    raw = ''
  }

  if (col.format) {
    try {
      const formatted = col.format(raw, row)
      return formatted != null ? String(formatted) : ''
    } catch (e) {
      console.error('[getCellText] Error in format function:', e)
      return ''
    }
  }
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'boolean') return raw ? 'Sí' : 'No'
  if (raw instanceof Date) return raw.toLocaleDateString('es-ES')
  return String(raw)
}

/** Obtiene el label de una columna */
function getColumnLabel(col: ExportColumn): string {
  return col.label || col.header || col.key || col.accessor?.toString() || ''
}

/** Escapa un valor para CSV (RFC 4180) */
function escapeCSV(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

/**
 * Exporta datos a CSV y dispara la descarga en el navegador.
 * Incluye BOM UTF-8 para compatibilidad con Excel en Windows.
 */
export function exportToCSV<T>(options: ExportOptions<T>): void {
  const { filename, columns, rows } = options

  const header = columns.map(c => escapeCSV(getColumnLabel(c))).join(',')
  const body = rows
    .map(row => columns.map(col => escapeCSV(getCellText(row, col))).join(','))
    .join('\n')

  const bom = '\uFEFF'
  const content = bom + header + '\n' + body

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${sanitizeFilename(filename)}.csv`)
}

// ─── Excel ────────────────────────────────────────────────────────────────────

/**
 * Exporta datos a Excel (.xlsx) usando la librería `xlsx` ya instalada.
 * Incluye encabezados en negrita y anchos de columna automáticos.
 */
export async function exportToExcel<T>(options: ExportOptions<T>): Promise<void> {
  const { filename, columns, rows, title } = options

  // Importación dinámica para no aumentar el bundle inicial
  const XLSX = await import('xlsx')

  const headerRow = columns.map(c => getColumnLabel(c))
  const dataRows = rows.map(row => columns.map(col => getCellText(row, col)))

  const wsData = [headerRow, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Ancho de columnas automático (máximo 50 chars)
  ws['!cols'] = columns.map((col, i) => {
    const maxLen = Math.max(getColumnLabel(col).length, ...dataRows.map(r => (r[i] ?? '').length))
    return { wch: Math.min(maxLen + 2, 50) }
  })

  // Estilo de encabezado (negrita) — solo funciona con xlsx-style, pero dejamos la estructura
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[cellAddr]) {
      ws[cellAddr].s = { font: { bold: true } }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title?.slice(0, 31) ?? 'Datos')

  XLSX.writeFile(wb, `${sanitizeFilename(filename)}.xlsx`)
}

// ─── PDF (print) ──────────────────────────────────────────────────────────────

/**
 * Genera un PDF usando window.print() con una ventana de impresión estilizada.
 * No requiere librerías externas. Produce PDFs limpios y profesionales.
 */
export function exportToPDF<T>(options: ExportOptions<T>): void {
  const { filename, columns, rows, title, subtitle } = options

  const date = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const tableRows = rows
    .map(
      row =>
        `<tr>${columns.map(col => `<td>${escapeHTML(getCellText(row, col))}</td>`).join('')}</tr>`
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHTML(title ?? filename)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #111; padding: 24px; }
    .header { margin-bottom: 20px; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; }
    .header h1 { font-size: 18px; font-weight: 700; color: #111; }
    .header p { font-size: 11px; color: #6b7280; margin-top: 4px; }
    .meta { display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f3f4f6; }
    th { text-align: left; padding: 7px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; border-bottom: 1px solid #d1d5db; }
    td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:nth-child(even) td { background: #f9fafb; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.5cm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHTML(title ?? filename)}</h1>
    ${subtitle ? `<p>${escapeHTML(subtitle)}</p>` : ''}
  </div>
  <div class="meta">
    <span>${rows.length} registro${rows.length !== 1 ? 's' : ''}</span>
    <span>Generado el ${date}</span>
  </div>
  <table>
    <thead>
      <tr>${columns.map(c => `<th>${escapeHTML(getColumnLabel(c))}</th>`).join('')}</tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">${escapeHTML(getCachedBranding().systemName)} — ${escapeHTML(title ?? filename)} — ${date}</div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=700')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

function escapeHTML(str: string | null | undefined): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  if (a && a.parentNode) a.parentNode.removeChild(a)
  // Liberar memoria después de un tick
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

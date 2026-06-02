/**
 * qr-bulk-print.ts
 *
 * Utilidad para imprimir múltiples códigos QR en una sola ventana.
 *
 * Para etiquetas en rollo (57/58mm): genera una página por etiqueta
 * separada con CSS page-break, para que cada etiqueta se imprima
 * en su propia hoja/etiqueta.
 *
 * Para A4/Letter: imprime un grid de etiquetas por página,
 * aprovechando el espacio de la hoja.
 */

import type { PrintFormat } from './qr-print-dialog'
import type { QRPrintItem } from './qr-print-dialog'

// ── Grid layout por formato ───────────────────────────────────────────────────

interface GridConfig {
  cols: number
  cellWidthMm: number
  cellHeightMm: number
  qrSizeMm: number
  fontSizePt: number
  subfontSizePt: number
}

const GRID_CONFIG: Record<PrintFormat, GridConfig> = {
  '57x40': {
    cols: 1,
    cellWidthMm: 55,
    cellHeightMm: 38,
    qrSizeMm: 28,
    fontSizePt: 6,
    subfontSizePt: 5,
  },
  '58x40': {
    cols: 1,
    cellWidthMm: 56,
    cellHeightMm: 38,
    qrSizeMm: 29,
    fontSizePt: 6,
    subfontSizePt: 5,
  },
  A4: { cols: 4, cellWidthMm: 48, cellHeightMm: 52, qrSizeMm: 38, fontSizePt: 7, subfontSizePt: 6 },
  Letter: {
    cols: 4,
    cellWidthMm: 46,
    cellHeightMm: 52,
    qrSizeMm: 36,
    fontSizePt: 7,
    subfontSizePt: 6,
  },
}

// ── CSS por formato ───────────────────────────────────────────────────────────

function buildBulkCSS(format: PrintFormat, cfg: GridConfig): string {
  const isLabel = format === '57x40' || format === '58x40'
  const pageWidth =
    format === '57x40' ? '57mm' : format === '58x40' ? '58mm' : format === 'A4' ? 'A4' : 'letter'
  const pageMargin = isLabel ? '1mm' : '8mm'

  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page {
      size: ${pageWidth};
      margin: ${pageMargin};
    }
    body {
      font-family: sans-serif;
      background: #fff;
      color: #000;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(${cfg.cols}, ${cfg.cellWidthMm}mm);
      gap: ${isLabel ? '0' : '2mm'};
      justify-content: center;
    }
    .cell {
      width: ${cfg.cellWidthMm}mm;
      height: ${cfg.cellHeightMm}mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1mm;
      ${isLabel ? 'page-break-after: always;' : ''}
      ${isLabel ? 'break-after: page;' : ''}
      padding: 1mm;
      border: ${isLabel ? 'none' : '0.3pt dashed #ccc'};
    }
    .cell:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .qr-img {
      width: ${cfg.qrSizeMm}mm;
      height: ${cfg.qrSizeMm}mm;
      display: block;
    }
    .label-text {
      font-size: ${cfg.fontSizePt}pt;
      font-weight: 700;
      font-family: monospace;
      text-align: center;
      max-width: ${cfg.cellWidthMm - 2}mm;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .sublabel-text {
      font-size: ${cfg.subfontSizePt}pt;
      color: #444;
      text-align: center;
      max-width: ${cfg.cellWidthMm - 2}mm;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  `
}

// ── HTML por item ─────────────────────────────────────────────────────────────

function buildCellHtml(item: QRPrintItem): string {
  const sublabelHtml = item.sublabel
    ? `<div class="sublabel-text">${escapeHtml(item.sublabel)}</div>`
    : ''
  return `
    <div class="cell">
      <img class="qr-img" src="${item.qrSrc}" alt="QR ${escapeHtml(item.label)}" />
      <div class="label-text">${escapeHtml(item.label)}</div>
      ${sublabelHtml}
    </div>
  `
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Abre una ventana de impresión con todos los QR proporcionados.
 *
 * @param items   Lista de items QR a imprimir
 * @param format  Formato de página seleccionado
 */
export function printBulkQR(items: QRPrintItem[], format: PrintFormat): void {
  if (!items.length) return

  const cfg = GRID_CONFIG[format]
  const css = buildBulkCSS(format, cfg)
  const cellsHtml = items.map(buildCellHtml).join('\n')
  const title = `QR Batch (${items.length})`

  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) {
    // Fallback: popup bloqueado
    alert('Permite las ventanas emergentes para esta página para imprimir.')
    return
  }

  win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <div class="grid">
    ${cellsHtml}
  </div>
  <script>
    // Esperar a que todas las imágenes carguen antes de imprimir
    var images = document.querySelectorAll('img');
    var loaded = 0;
    var total = images.length;

    function tryPrint() {
      loaded++;
      if (loaded >= total) {
        window.print();
        setTimeout(function() { window.close(); }, 800);
      }
    }

    if (total === 0) {
      window.print();
      setTimeout(function() { window.close(); }, 800);
    } else {
      images.forEach(function(img) {
        if (img.complete) {
          tryPrint();
        } else {
          img.onload = tryPrint;
          img.onerror = tryPrint; // imprimir de todas formas si falla una imagen
        }
      });
    }
  <\/script>
</body>
</html>`)
  win.document.close()
}

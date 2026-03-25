// PDFKit se carga via helper para evitar análisis estático de Turbopack
import { loadPDFKit } from '@/lib/utils/load-pdfkit'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import type { DeliveryAct } from '@/types/inventory/delivery-act'
import { getUploadDir } from '@/lib/upload-path'

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/')) {
      // Rutas /api/uploads/... → leer desde filesystem directamente
      if (url.startsWith('/api/uploads/')) {
        const relativePath = url.replace('/api/uploads/', '')
        const localPath = getUploadDir(relativePath)
        if (fs.existsSync(localPath)) return fs.readFileSync(localPath)
        return null
      }
      // Rutas /uploads/... (legacy)
      const localPath = path.join(process.cwd(), 'public', url)
      if (fs.existsSync(localPath)) return fs.readFileSync(localPath)
      return null
    }
    return await new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http
      client.get(url, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }).on('error', reject)
    })
  } catch {
    return null
  }
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
}

// Colores corporativos
const C = {
  primary: '#1E40AF',    // azul oscuro
  accent: '#3B82F6',     // azul medio
  light: '#EFF6FF',      // azul muy claro (fondo secciones)
  border: '#BFDBFE',     // borde azul claro
  text: '#1E293B',       // texto principal
  muted: '#64748B',      // texto secundario
  white: '#FFFFFF',
  gray: '#F8FAFC',
}

export async function generateDeliveryActPDF(
  act: DeliveryAct,
  qrCodeDataUrl: string,
  systemInfo?: { logoUrl?: string | null; logoDarkUrl?: string | null; companyName?: string }
): Promise<any> {
  const PDFDocument = loadPDFKit()

  // Página A4 apaisada para que todo quepa en una hoja
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: `Acta de Entrega - ${act.folio}`,
      Author: systemInfo?.companyName || 'Sistema de Inventario',
      Subject: 'Acta de Entrega',
    },
  })

  const W = doc.page.width   // 595
  const H = doc.page.height  // 842
  const ML = 32              // margen lateral
  const CW = W - ML * 2      // ancho contenido

  // ── HEADER ──────────────────────────────────────────────────────────────
  // Fondo azul oscuro
  doc.rect(0, 0, W, 72).fill(C.primary)

  const companyName = systemInfo?.companyName || 'Sistema de Inventario'
  // Header tiene fondo azul oscuro → usar logo oscuro (versión blanca/clara para fondos oscuros)
  // Fallback al logo claro si no hay versión oscura
  const logoUrl = systemInfo?.logoDarkUrl || systemInfo?.logoUrl

  let logoBuffer: Buffer | null = null
  if (logoUrl) logoBuffer = await fetchImageBuffer(logoUrl)

  if (logoBuffer) {
    doc.image(logoBuffer, ML, 11, { fit: [120, 50], align: 'left' })
  } else {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(C.white)
      .text(companyName, ML, 22, { width: 160 })
  }

  // Título y folio a la derecha
  doc.fontSize(15).font('Helvetica-Bold').fillColor(C.white)
    .text('ACTA DE ENTREGA', ML + 160, 16, { width: CW - 160, align: 'right' })
  doc.fontSize(10).font('Helvetica').fillColor('#BFDBFE')
    .text(act.folio, ML + 160, 36, { width: CW - 160, align: 'right' })

  // Estado del acta
  const statusLabel = act.status === 'ACCEPTED' ? 'ACEPTADA' : act.status === 'REJECTED' ? 'RECHAZADA' : 'PENDIENTE'
  const statusColor = act.status === 'ACCEPTED' ? '#22C55E' : act.status === 'REJECTED' ? '#EF4444' : '#F59E0B'
  doc.roundedRect(W - ML - 80, 48, 80, 16, 4).fill(statusColor)
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
    .text(statusLabel, W - ML - 80, 52, { width: 80, align: 'center' })

  let y = 82

  // ── CUERPO: dos columnas ─────────────────────────────────────────────────
  const colW = (CW - 12) / 2
  const col1X = ML
  const col2X = ML + colW + 12

  // Helper: dibuja una tarjeta de sección
  const card = (x: number, cardY: number, w: number, h: number, title: string, icon?: string) => {
    doc.roundedRect(x, cardY, w, h, 4).fill(C.light)
    doc.roundedRect(x, cardY, w, 18, 4).fill(C.accent)
    // Esquinas inferiores del header rectas
    doc.rect(x, cardY + 10, w, 8).fill(C.accent)
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
      .text((icon ? icon + ' ' : '') + title, x + 8, cardY + 5, { width: w - 16 })
    return cardY + 22
  }

  // Helper: fila label + valor
  const row = (x: number, rowY: number, w: number, label: string, value: string) => {
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
      .text(label.toUpperCase(), x + 6, rowY, { width: w / 2 - 6 })
    doc.fontSize(8).font('Helvetica').fillColor(C.text)
      .text(value || '—', x + w / 2, rowY, { width: w / 2 - 6 })
    return rowY + 13
  }

  // Helper: fila ancha (label arriba, valor abajo)
  const rowFull = (x: number, rowY: number, w: number, label: string, value: string) => {
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
      .text(label.toUpperCase(), x + 6, rowY, { width: w - 12 })
    doc.fontSize(8).font('Helvetica').fillColor(C.text)
      .text(value || '—', x + 6, rowY + 9, { width: w - 12 })
    return rowY + 20
  }

  // ── COLUMNA IZQUIERDA ────────────────────────────────────────────────────

  // Tarjeta: Equipo
  const eqH = 130
  let cy = card(col1X, y, colW, eqH, 'EQUIPO')
  cy = row(col1X, cy, colW, 'Código', act.equipmentSnapshot.code)
  cy = row(col1X, cy, colW, 'Marca / Modelo', `${act.equipmentSnapshot.brand} ${act.equipmentSnapshot.model}`)
  cy = row(col1X, cy, colW, 'N° de Serie', act.equipmentSnapshot.serialNumber)
  cy = row(col1X, cy, colW, 'Tipo', act.equipmentSnapshot.typeName || act.equipmentSnapshot.type || '—')
  cy = row(col1X, cy, colW, 'Condición', CONDITION_LABELS[act.equipmentSnapshot.condition] || act.equipmentSnapshot.condition)

  // Especificaciones (si existen)
  const specs = act.equipmentSnapshot.specifications
  const specEntries = specs ? Object.entries(specs).filter(([, v]) => v) : []
  if (specEntries.length > 0) {
    const specH = 22 + specEntries.length * 13
    cy = card(col1X, y + eqH + 8, colW, specH, 'ESPECIFICACIONES')
    specEntries.forEach(([k, v]) => {
      cy = row(col1X, cy, colW, k, String(v))
    })
  }

  // Accesorios
  const accY = y + eqH + 8 + (specEntries.length > 0 ? 22 + specEntries.length * 13 + 8 : 0)
  const accList = act.accessories?.length ? act.accessories : []
  const accH = 22 + Math.max(accList.length, 1) * 13
  let acy = card(col1X, accY, colW, accH, 'ACCESORIOS')
  if (accList.length > 0) {
    accList.forEach((a) => {
      doc.fontSize(8).font('Helvetica').fillColor(C.text)
        .text(`• ${a}`, col1X + 6, acy, { width: colW - 12 })
      acy += 13
    })
  } else {
    doc.fontSize(8).font('Helvetica').fillColor(C.muted)
      .text('Sin accesorios registrados', col1X + 6, acy, { width: colW - 12 })
  }

  // Sección financiera (condicional — antes de observaciones)
  const snap = act.equipmentSnapshot as any
  const hasFinancial = !!(snap.supplierName || snap.purchasePrice || snap.purchaseDate || snap.invoiceNumber || snap.purchaseOrderNumber)
  let nextLeftY = accY + accH + 8

  if (hasFinancial) {
    const finRows = [
      snap.supplierName ? ['Proveedor', snap.supplierName + (snap.supplierTaxId ? ` (${snap.supplierTaxId})` : '')] : null,
      snap.purchasePrice != null ? ['Costo adquisición', `$${Number(snap.purchasePrice).toLocaleString('es-EC', { minimumFractionDigits: 2 })}` ] : null,
      snap.purchaseDate ? ['Fecha de compra', new Date(snap.purchaseDate).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })] : null,
      snap.invoiceNumber ? ['N° Factura', snap.invoiceNumber] : null,
      snap.purchaseOrderNumber ? ['N° Orden de Compra', snap.purchaseOrderNumber] : null,
    ].filter(Boolean) as [string, string][]

    const finH = 22 + finRows.length * 13
    let fy2 = card(col1X, nextLeftY, colW, finH, 'INFORMACIÓN FINANCIERA')
    finRows.forEach(([label, value]) => {
      fy2 = row(col1X, fy2, colW, label, value)
    })
    nextLeftY += finH + 8
  }

  // Imagen del equipo (condicional)
  if (snap.equipmentImagePath) {
    const imgBuffer = await fetchImageBuffer(snap.equipmentImagePath)
    if (imgBuffer) {
      const imgH = 22 + 110
      card(col1X, nextLeftY, colW, imgH, 'IMAGEN DEL EQUIPO')
      try {
        doc.image(imgBuffer, col1X + 6, nextLeftY + 22, { fit: [colW - 12, 100] })
      } catch {
        // imagen inválida — omitir silenciosamente
      }
      nextLeftY += imgH + 8
    }
  }

  // Observaciones (si existen)
  if (act.observations) {
    const obsH = 22 + 26
    let ocy = card(col1X, nextLeftY, colW, obsH, 'OBSERVACIONES')
    doc.fontSize(8).font('Helvetica').fillColor(C.text)
      .text(act.observations, col1X + 6, ocy, { width: colW - 12, height: 24, ellipsis: true })
  }

  // ── COLUMNA DERECHA ──────────────────────────────────────────────────────

  // Tarjeta: Entregado por
  const delH = 68
  let dy = card(col2X, y, colW, delH, 'ENTREGADO POR')
  dy = row(col2X, dy, colW, 'Nombre', act.delivererInfo.name)
  dy = row(col2X, dy, colW, 'Email', act.delivererInfo.email)
  dy = row(col2X, dy, colW, 'Departamento', act.delivererInfo.department || '—')

  // Tarjeta: Recibido por
  const recY = y + delH + 8
  const recH = 68
  let ry = card(col2X, recY, colW, recH, 'RECIBIDO POR')
  ry = row(col2X, ry, colW, 'Nombre', act.receiverInfo.name)
  ry = row(col2X, ry, colW, 'Email', act.receiverInfo.email)
  ry = row(col2X, ry, colW, 'Departamento', act.receiverInfo.department || '—')

  // Tarjeta: Fechas
  const fechasY = recY + recH + 8
  const fechasH = act.acceptedAt ? 56 : 42
  let fy = card(col2X, fechasY, colW, fechasH, 'FECHAS')
  const fmtDate = (d: string | Date) => new Date(d).toLocaleString('es-EC', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  fy = rowFull(col2X, fy, colW, 'Fecha de creación', fmtDate(act.createdAt))
  if (act.acceptedAt) {
    rowFull(col2X, fy, colW, 'Fecha de aceptación', fmtDate(act.acceptedAt))
  }

  // Tarjeta: Firma digital + QR (lado a lado)
  const sigY = fechasY + fechasH + 8
  const sigH = 130
  const sigW = colW - 100 - 8  // espacio para QR de 96px

  // Fondo de la tarjeta completa
  doc.roundedRect(col2X, sigY, colW, sigH, 4).fill(C.light)
  doc.roundedRect(col2X, sigY, colW, 18, 4).fill(C.accent)
  doc.rect(col2X, sigY + 10, colW, 8).fill(C.accent)
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
    .text('FIRMA DIGITAL Y VERIFICACIÓN', col2X + 8, sigY + 5, { width: colW - 16 })

  if (act.status === 'ACCEPTED' && act.verificationHash) {
    let scy = sigY + 24

    // Hash (truncado para que quepa)
    const shortHash = act.verificationHash.substring(0, 32) + '...'
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
      .text('HASH DE VERIFICACIÓN', col2X + 6, scy, { width: sigW })
    scy += 9
    doc.fontSize(6.5).font('Helvetica').fillColor(C.text)
      .text(shortHash, col2X + 6, scy, { width: sigW })
    scy += 13

    if (act.signatureTimestamp) {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
        .text('FIRMADO EL', col2X + 6, scy, { width: sigW })
      scy += 9
      doc.fontSize(8).font('Helvetica').fillColor(C.text)
        .text(new Date(act.signatureTimestamp).toLocaleString('es-EC', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }), col2X + 6, scy, { width: sigW })
      scy += 13
    }

    if (act.signatureIp) {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
        .text('IP DE FIRMA', col2X + 6, scy, { width: sigW })
      scy += 9
      doc.fontSize(8).font('Helvetica').fillColor(C.text)
        .text(act.signatureIp, col2X + 6, scy, { width: sigW })
    }

    // QR a la derecha dentro de la tarjeta
    const qrSize = 90
    const qrX = col2X + colW - qrSize - 6
    const qrY = sigY + 22
    doc.image(qrCodeDataUrl, qrX, qrY, { width: qrSize, height: qrSize })
    doc.fontSize(6).font('Helvetica').fillColor(C.muted)
      .text('Escanear para verificar', qrX, qrY + qrSize + 2, { width: qrSize, align: 'center' })
  } else {
    // Acta pendiente — solo QR centrado
    const qrSize = 90
    const qrX = col2X + (colW - qrSize) / 2
    doc.image(qrCodeDataUrl, qrX, sigY + 22, { width: qrSize, height: qrSize })
    doc.fontSize(7).font('Helvetica').fillColor(C.muted)
      .text('Pendiente de firma', col2X + 6, sigY + 24, { width: sigW })
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = H - 28
  doc.rect(0, footerY, W, 28).fill(C.primary)
  doc.fontSize(7).font('Helvetica').fillColor('#BFDBFE')
    .text(
      `Documento generado electrónicamente · ${companyName} · ${new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      ML, footerY + 10,
      { width: CW, align: 'center' }
    )

  return doc
}

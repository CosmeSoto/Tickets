import { loadPDFKit } from '@/lib/utils/load-pdfkit'
import fs from 'fs'
import path from 'path'
import { getUploadDir } from '@/lib/upload-path'

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/api/uploads/')) {
      const relativePath = url.replace('/api/uploads/', '')
      const localPath = getUploadDir(relativePath)
      if (fs.existsSync(localPath)) return fs.readFileSync(localPath)
      return null
    }
    if (url.startsWith('/uploads/')) {
      const localPath = path.join(process.cwd(), 'public', url)
      if (fs.existsSync(localPath)) return fs.readFileSync(localPath)
      return null
    }
    return null
  } catch {
    return null
  }
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
}

const C = {
  primary: '#1E40AF',
  accent: '#3B82F6',
  light: '#EFF6FF',
  border: '#BFDBFE',
  text: '#1E293B',
  muted: '#64748B',
  white: '#FFFFFF',
  returnAccent: '#7C3AED',  // morado para distinguir devoluciones
  returnLight: '#F5F3FF',
}

export async function generateReturnActPDF(
  act: any,
  qrCodeDataUrl: string,
  systemInfo?: { logoUrl?: string | null; logoDarkUrl?: string | null; companyName?: string }
): Promise<any> {
  const PDFDocument = loadPDFKit()

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: `Acta de Devolución - ${act.folio}`,
      Author: systemInfo?.companyName || 'Sistema de Inventario',
      Subject: 'Acta de Devolución de Equipo',
    },
  })

  const W = doc.page.width
  const H = doc.page.height
  const ML = 32
  const CW = W - ML * 2

  // ── HEADER (fondo azul oscuro) ───────────────────────────────────────────
  doc.rect(0, 0, W, 72).fill(C.primary)

  const companyName = systemInfo?.companyName || 'Sistema de Inventario'
  // Fondo oscuro → usar logo oscuro (versión blanca), fallback al claro
  const logoUrl = systemInfo?.logoDarkUrl || systemInfo?.logoUrl
  let logoBuffer: Buffer | null = null
  if (logoUrl) logoBuffer = await fetchImageBuffer(logoUrl)

  if (logoBuffer) {
    doc.image(logoBuffer, ML, 11, { fit: [120, 50], align: 'left' })
  } else {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(C.white)
      .text(companyName, ML, 22, { width: 160 })
  }

  doc.fontSize(15).font('Helvetica-Bold').fillColor(C.white)
    .text('ACTA DE DEVOLUCIÓN DE EQUIPO', ML + 160, 16, { width: CW - 160, align: 'right' })
  doc.fontSize(10).font('Helvetica').fillColor('#BFDBFE')
    .text(act.folio, ML + 160, 36, { width: CW - 160, align: 'right' })

  const statusLabel = act.status === 'ACCEPTED' ? 'ACEPTADA' : act.status === 'REJECTED' ? 'RECHAZADA' : 'PENDIENTE'
  const statusColor = act.status === 'ACCEPTED' ? '#22C55E' : act.status === 'REJECTED' ? '#EF4444' : '#F59E0B'
  doc.roundedRect(W - ML - 80, 48, 80, 16, 4).fill(statusColor)
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
    .text(statusLabel, W - ML - 80, 52, { width: 80, align: 'center' })

  let y = 82

  const colW = (CW - 12) / 2
  const col1X = ML
  const col2X = ML + colW + 12

  const card = (x: number, cardY: number, w: number, h: number, title: string) => {
    doc.roundedRect(x, cardY, w, h, 4).fill(C.returnLight)
    doc.roundedRect(x, cardY, w, 18, 4).fill(C.returnAccent)
    doc.rect(x, cardY + 10, w, 8).fill(C.returnAccent)
    doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
      .text(title, x + 8, cardY + 5, { width: w - 16 })
    return cardY + 22
  }

  const row = (x: number, rowY: number, w: number, label: string, value: string) => {
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
      .text(label.toUpperCase(), x + 6, rowY, { width: w / 2 - 6 })
    doc.fontSize(8).font('Helvetica').fillColor(C.text)
      .text(value || '—', x + w / 2, rowY, { width: w / 2 - 6 })
    return rowY + 13
  }

  const rowFull = (x: number, rowY: number, w: number, label: string, value: string) => {
    doc.fontSize(7).font('Helvetica-Bold').fillColor(C.muted)
      .text(label.toUpperCase(), x + 6, rowY, { width: w - 12 })
    doc.fontSize(8).font('Helvetica').fillColor(C.text)
      .text(value || '—', x + 6, rowY + 9, { width: w - 12 })
    return rowY + 20
  }

  const fmtDate = (d: string | Date) => new Date(d).toLocaleString('es-EC', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // ── COLUMNA IZQUIERDA ────────────────────────────────────────────────────

  // Equipo
  const equipment = act.assignment?.equipment
  const eqH = 130
  let cy = card(col1X, y, colW, eqH, 'EQUIPO DEVUELTO')
  if (equipment) {
    cy = row(col1X, cy, colW, 'Código', equipment.code || '—')
    cy = row(col1X, cy, colW, 'Marca / Modelo', `${equipment.brand || ''} ${equipment.model || ''}`.trim() || '—')
    cy = row(col1X, cy, colW, 'N° de Serie', equipment.serialNumber || '—')
    cy = row(col1X, cy, colW, 'Tipo', equipment.type || '—')
    cy = row(col1X, cy, colW, 'Condición al devolver', CONDITION_LABELS[act.conditionOnReturn] || act.conditionOnReturn || '—')
  }

  // Accesorios devueltos
  const accY = y + eqH + 8
  const accList: string[] = act.accessories || []
  const accH = 22 + Math.max(accList.length, 1) * 13
  let acy = card(col1X, accY, colW, accH, 'ACCESORIOS DEVUELTOS')
  if (accList.length > 0) {
    accList.forEach((a: string) => {
      doc.fontSize(8).font('Helvetica').fillColor(C.text)
        .text(`• ${a}`, col1X + 6, acy, { width: colW - 12 })
      acy += 13
    })
  } else {
    doc.fontSize(8).font('Helvetica').fillColor(C.muted)
      .text('Sin accesorios registrados', col1X + 6, acy, { width: colW - 12 })
  }

  // Observaciones
  if (act.observations) {
    const obsY = accY + accH + 8
    const obsH = 22 + 26
    let ocy = card(col1X, obsY, colW, obsH, 'OBSERVACIONES')
    doc.fontSize(8).font('Helvetica').fillColor(C.text)
      .text(act.observations, col1X + 6, ocy, { width: colW - 12, height: 24, ellipsis: true })
  }

  // ── COLUMNA DERECHA ──────────────────────────────────────────────────────

  // Devuelto por (receiver del assignment = quien tenía el equipo)
  const receiver = act.assignment?.receiver
  const delH = 68
  let dy = card(col2X, y, colW, delH, 'DEVUELTO POR')
  if (receiver) {
    dy = row(col2X, dy, colW, 'Nombre', `${receiver.firstName || ''} ${receiver.lastName || ''}`.trim() || receiver.email)
    dy = row(col2X, dy, colW, 'Email', receiver.email || '—')
    dy = row(col2X, dy, colW, 'Departamento', receiver.department || '—')
  }

  // Recibido por (deliverer del assignment = quien entregó originalmente)
  const deliverer = act.assignment?.deliverer
  const recY = y + delH + 8
  const recH = 68
  let ry = card(col2X, recY, colW, recH, 'RECIBIDO POR')
  if (deliverer) {
    ry = row(col2X, ry, colW, 'Nombre', `${deliverer.firstName || ''} ${deliverer.lastName || ''}`.trim() || deliverer.email)
    ry = row(col2X, ry, colW, 'Email', deliverer.email || '—')
    ry = row(col2X, ry, colW, 'Departamento', deliverer.department || '—')
  }

  // Fechas
  const fechasY = recY + recH + 8
  const fechasH = act.acceptedAt ? 56 : 42
  let fy = card(col2X, fechasY, colW, fechasH, 'FECHAS')
  fy = rowFull(col2X, fy, colW, 'Fecha de devolución', fmtDate(act.createdAt))
  if (act.acceptedAt) {
    rowFull(col2X, fy, colW, 'Fecha de aceptación', fmtDate(act.acceptedAt))
  }

  // Firma digital + QR
  const sigY = fechasY + fechasH + 8
  const sigH = 130
  const sigW = colW - 100 - 8

  doc.roundedRect(col2X, sigY, colW, sigH, 4).fill(C.returnLight)
  doc.roundedRect(col2X, sigY, colW, 18, 4).fill(C.returnAccent)
  doc.rect(col2X, sigY + 10, colW, 8).fill(C.returnAccent)
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
    .text('FIRMA DIGITAL Y VERIFICACIÓN', col2X + 8, sigY + 5, { width: colW - 16 })

  if (act.status === 'ACCEPTED' && act.verificationHash) {
    let scy = sigY + 24
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
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }), col2X + 6, scy, { width: sigW })
    }

    const qrSize = 90
    const qrX = col2X + colW - qrSize - 6
    doc.image(qrCodeDataUrl, qrX, sigY + 22, { width: qrSize, height: qrSize })
    doc.fontSize(6).font('Helvetica').fillColor(C.muted)
      .text('Escanear para verificar', qrX, sigY + 22 + qrSize + 2, { width: qrSize, align: 'center' })
  } else {
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

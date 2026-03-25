import { loadPDFKit } from '@/lib/utils/load-pdfkit'
import fs from 'fs'
import { getUploadDir } from '@/lib/upload-path'

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
}

const C = {
  primary: '#991B1B',   // rojo oscuro para actas de baja
  accent: '#DC2626',
  light: '#FEF2F2',
  text: '#1E293B',
  muted: '#64748B',
  white: '#FFFFFF',
}

function loadImageBuffer(filePath: string): Buffer | null {
  try {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath)
    return null
  } catch {
    return null
  }
}

export interface DecommissionActPDFData {
  folio: string
  approvedAt: Date
  request: {
    reason: string
    condition?: string | null
    assetType: 'EQUIPMENT' | 'LICENSE'
    requester: { name: string; email: string; department?: string | null }
  }
  equipment?: {
    code: string
    brand: string
    model: string
    serialNumber?: string | null
    type?: string | null
  } | null
  license?: {
    name: string
    vendor?: string | null
  } | null
  approvedBy: { name: string; email: string }
  attachmentPaths: string[]
  systemInfo?: { logoUrl?: string | null; logoDarkUrl?: string | null; companyName?: string }
}

export async function generateDecommissionActPDF(data: DecommissionActPDFData): Promise<any> {
  const PDFDocument = loadPDFKit()

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: `Acta de Baja - ${data.folio}`,
      Author: data.systemInfo?.companyName || 'Sistema de Inventario',
      Subject: 'Acta de Baja de Activo',
    },
  })

  const W = doc.page.width
  const H = doc.page.height
  const ML = 32
  const CW = W - ML * 2

  // ── HEADER ───────────────────────────────────────────────────────────────
  doc.rect(0, 0, W, 72).fill(C.primary)

  const companyName = data.systemInfo?.companyName || 'Sistema de Inventario'
  const logoUrl = data.systemInfo?.logoDarkUrl || data.systemInfo?.logoUrl
  if (logoUrl) {
    const relativePath = logoUrl.replace('/api/uploads/', '')
    const logoBuffer = loadImageBuffer(getUploadDir(relativePath))
    if (logoBuffer) {
      doc.image(logoBuffer, ML, 11, { fit: [120, 50], align: 'left' })
    } else {
      doc.fontSize(13).font('Helvetica-Bold').fillColor(C.white).text(companyName, ML, 22, { width: 160 })
    }
  } else {
    doc.fontSize(13).font('Helvetica-Bold').fillColor(C.white).text(companyName, ML, 22, { width: 160 })
  }

  doc.fontSize(15).font('Helvetica-Bold').fillColor(C.white)
    .text('ACTA DE BAJA', ML + 160, 16, { width: CW - 160, align: 'right' })
  doc.fontSize(10).font('Helvetica').fillColor('#FECACA')
    .text(data.folio, ML + 160, 36, { width: CW - 160, align: 'right' })

  // Badge BAJA
  doc.roundedRect(W - ML - 60, 48, 60, 16, 4).fill(C.accent)
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.white)
    .text('BAJA', W - ML - 60, 52, { width: 60, align: 'center' })

  let y = 82
  const colW = (CW - 12) / 2
  const col1X = ML
  const col2X = ML + colW + 12

  const card = (x: number, cardY: number, w: number, h: number, title: string) => {
    doc.roundedRect(x, cardY, w, h, 4).fill(C.light)
    doc.roundedRect(x, cardY, w, 18, 4).fill(C.accent)
    doc.rect(x, cardY + 10, w, 8).fill(C.accent)
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

  const fmtDate = (d: Date) => new Date(d).toLocaleString('es-EC', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  // ── COLUMNA IZQUIERDA ────────────────────────────────────────────────────

  // Activo dado de baja
  const assetH = data.request.assetType === 'EQUIPMENT' ? 104 : 56
  let cy = card(col1X, y, colW, assetH, data.request.assetType === 'EQUIPMENT' ? 'EQUIPO DADO DE BAJA' : 'LICENCIA DADA DE BAJA')
  if (data.equipment) {
    cy = row(col1X, cy, colW, 'Código', data.equipment.code)
    cy = row(col1X, cy, colW, 'Marca / Modelo', `${data.equipment.brand} ${data.equipment.model}`)
    cy = row(col1X, cy, colW, 'N° de Serie', data.equipment.serialNumber || '—')
    if (data.request.condition) {
      cy = row(col1X, cy, colW, 'Condición', CONDITION_LABELS[data.request.condition] || data.request.condition)
    }
  } else if (data.license) {
    cy = row(col1X, cy, colW, 'Nombre', data.license.name)
    cy = row(col1X, cy, colW, 'Proveedor', data.license.vendor || '—')
  }

  // Motivo de baja
  const motivoY = y + assetH + 8
  const motivoH = 22 + 36
  let my = card(col1X, motivoY, colW, motivoH, 'MOTIVO DE BAJA')
  doc.fontSize(8).font('Helvetica').fillColor(C.text)
    .text(data.request.reason, col1X + 6, my, { width: colW - 12, height: 34, ellipsis: true })

  // Imágenes de evidencia
  const validImages = data.attachmentPaths
    .map(p => ({ path: p, buffer: loadImageBuffer(p) }))
    .filter(i => i.buffer !== null)

  if (validImages.length > 0) {
    const imgY = motivoY + motivoH + 8
    const imgH = 22 + 120
    card(col1X, imgY, colW, imgH, 'EVIDENCIA FOTOGRÁFICA')
    const imgContentY = imgY + 22
    const maxImgW = colW - 12
    const maxImgH = 110
    // Mostrar primera imagen
    try {
      doc.image(validImages[0].buffer!, col1X + 6, imgContentY, { fit: [maxImgW, maxImgH] })
    } catch {
      // ignorar si la imagen no se puede renderizar
    }
  }

  // ── COLUMNA DERECHA ──────────────────────────────────────────────────────

  // Solicitante
  const solH = 68
  let sy = card(col2X, y, colW, solH, 'SOLICITADO POR')
  sy = row(col2X, sy, colW, 'Nombre', data.request.requester.name)
  sy = row(col2X, sy, colW, 'Email', data.request.requester.email)
  sy = row(col2X, sy, colW, 'Departamento', data.request.requester.department || '—')

  // Aprobado por
  const aprobY = y + solH + 8
  const aprobH = 56
  let ay = card(col2X, aprobY, colW, aprobH, 'APROBADO POR')
  ay = row(col2X, ay, colW, 'Nombre', data.approvedBy.name)
  ay = row(col2X, ay, colW, 'Email', data.approvedBy.email)

  // Fechas
  const fechasY = aprobY + aprobH + 8
  const fechasH = 42
  let fy = card(col2X, fechasY, colW, fechasH, 'FECHA DE BAJA')
  rowFull(col2X, fy, colW, 'Fecha de aprobación', fmtDate(data.approvedAt))

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = H - 28
  doc.rect(0, footerY, W, 28).fill(C.primary)
  doc.fontSize(7).font('Helvetica').fillColor('#FECACA')
    .text(
      `Documento generado electrónicamente · ${companyName} · ${new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      ML, footerY + 10,
      { width: CW, align: 'center' }
    )

  return doc
}

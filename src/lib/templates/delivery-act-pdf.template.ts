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
      client
        .get(url, res => {
          const chunks: Buffer[] = []
          res.on('data', c => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        })
        .on('error', reject)
    })
  } catch {
    return null
  }
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

// Paleta profesional: neutros + acento mínimo
const C = {
  dark: '#1a1a1a', // encabezados y texto principal
  text: '#333333', // texto cuerpo
  muted: '#6b7280', // texto secundario
  border: '#d1d5db', // bordes
  light: '#f9fafb', // fondo alternado secciones
  accent: '#374151', // gris oscuro para títulos de sección
  white: '#ffffff',
}

export async function generateDeliveryActPDF(
  act: DeliveryAct,
  qrCodeDataUrl: string,
  systemInfo?: { logoUrl?: string | null; logoDarkUrl?: string | null; companyName?: string }
): Promise<any> {
  const PDFDocument = loadPDFKit()

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'portrait',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    info: {
      Title: `Acta de Entrega - ${act.folio}`,
      Author: systemInfo?.companyName || 'Sistema de Gestión',
      Subject: 'Acta de Entrega de Equipo',
    },
  })

  const W = doc.page.width // 595
  const ML = 40
  const MR = 40
  const CW = W - ML - MR // ancho útil ~515

  let y = 40

  // ── HEADER ──────────────────────────────────────────────────────────────
  const companyName = systemInfo?.companyName || 'Sistema de Gestión'
  // Fondo blanco → usar logo claro (versión para fondos claros)
  const logoUrl = systemInfo?.logoUrl
  let logoBuffer: Buffer | null = null
  if (logoUrl) logoBuffer = await fetchImageBuffer(logoUrl)

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, ML, y, { fit: [130, 40], align: 'left' })
    } catch {
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(C.dark)
        .text(companyName, ML, y + 10)
    }
  } else {
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .fillColor(C.dark)
      .text(companyName, ML, y + 10)
  }

  // Título del documento a la derecha
  const actTypeLabels: Record<string, string> = {
    EQUIPMENT_ASSIGNMENT: 'ACTA DE ENTREGA',
    MRO_DELIVERY: 'ACTA DE ENTREGA — MATERIALES',
    SERVICE_COMPLETION: 'ACTA DE SERVICIO',
    ASSET_TRANSFER: 'ACTA DE TRANSFERENCIA',
  }
  const actTypeLabel =
    actTypeLabels[(act as any).actType ?? 'EQUIPMENT_ASSIGNMENT'] ?? 'ACTA DE ENTREGA'

  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor(C.dark)
    .text(actTypeLabel, ML, y, { width: CW, align: 'right' })
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.muted)
    .text(act.folio, ML, y + 18, { width: CW, align: 'right' })

  // Estado como badge discreto
  const statusLabel =
    act.status === 'ACCEPTED' ? 'Firmada' : act.status === 'REJECTED' ? 'Rechazada' : 'Pendiente'
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(C.muted)
    .text(`Estado: ${statusLabel}`, ML, y + 32, { width: CW, align: 'right' })

  y += 56

  // Línea separadora
  doc
    .moveTo(ML, y)
    .lineTo(W - MR, y)
    .strokeColor(C.border)
    .lineWidth(0.5)
    .stroke()
  y += 16

  // ── Helper functions ─────────────────────────────────────────────────────
  const sectionTitle = (title: string, startY: number): number => {
    doc.fontSize(9).font('Helvetica-Bold').fillColor(C.accent).text(title.toUpperCase(), ML, startY)
    return startY + 14
  }

  const fieldRow = (
    label: string,
    value: string,
    startY: number,
    opts?: { halfWidth?: boolean; xOffset?: number }
  ): number => {
    const x = ML + (opts?.xOffset || 0)
    const w = opts?.halfWidth ? CW / 2 - 8 : CW
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.muted).text(label, x, startY, { width: w })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(value || '—', x, startY + 9, { width: w })
    return startY + 22
  }

  const separator = (startY: number): number => {
    doc
      .moveTo(ML, startY)
      .lineTo(W - MR, startY)
      .strokeColor('#e5e7eb')
      .lineWidth(0.3)
      .stroke()
    return startY + 10
  }

  // ── DATOS DEL EQUIPO ────────────────────────────────────────────────────
  y = sectionTitle('Datos del Equipo', y)

  // Fila 1: Código y N° Serie
  const halfW = CW / 2 - 8
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('CÓDIGO', ML, y, { width: halfW })
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('N° DE SERIE', ML + CW / 2, y, { width: halfW })
  y += 9
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(act.equipmentSnapshot.code, ML, y, { width: halfW })
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(act.equipmentSnapshot.serialNumber || '—', ML + CW / 2, y, { width: halfW })
  y += 16

  // Fila 2: Marca/Modelo y Tipo
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('MARCA / MODELO', ML, y, { width: halfW })
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('TIPO', ML + CW / 2, y, { width: halfW })
  y += 9
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(`${act.equipmentSnapshot.brand} ${act.equipmentSnapshot.model}`, ML, y, { width: halfW })
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(act.equipmentSnapshot.typeName || act.equipmentSnapshot.type || '—', ML + CW / 2, y, {
      width: halfW,
    })
  y += 16

  // Fila 3: Condición
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('CONDICIÓN', ML, y, { width: halfW })
  y += 9
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(
      CONDITION_LABELS[act.equipmentSnapshot.condition] || act.equipmentSnapshot.condition,
      ML,
      y,
      { width: halfW }
    )
  y += 18

  y = separator(y)

  // ── IMAGEN DEL EQUIPO (si existe) ──────────────────────────────────────
  const snap = act.equipmentSnapshot as any
  if (snap.equipmentImagePath) {
    const imgBuffer = await fetchImageBuffer(snap.equipmentImagePath)
    if (imgBuffer) {
      y = sectionTitle('Imagen del Equipo', y)
      try {
        doc.image(imgBuffer, ML, y, { fit: [180, 120] })
        y += 128
      } catch {
        // imagen inválida — omitir
      }
      y = separator(y)
    }
  }

  // ── ACCESORIOS ──────────────────────────────────────────────────────────
  const accList = act.accessories?.length ? act.accessories : []
  y = sectionTitle('Accesorios Incluidos', y)
  if (accList.length > 0) {
    accList.forEach(a => {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(C.text)
        .text(`•  ${a}`, ML + 4, y, { width: CW - 8 })
      y += 13
    })
  } else {
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.muted)
      .text('Sin accesorios registrados', ML + 4, y, { width: CW })
    y += 13
  }
  y += 6
  y = separator(y)

  // ── PARTES INVOLUCRADAS ─────────────────────────────────────────────────
  y = sectionTitle('Entregado por', y)
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('NOMBRE', ML, y, { width: halfW })
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('CORREO', ML + CW / 2, y, { width: halfW })
  y += 9
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(act.delivererInfo.name, ML, y, { width: halfW })
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(act.delivererInfo.email, ML + CW / 2, y, { width: halfW })
  y += 13
  if (act.delivererInfo.department) {
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor(C.muted)
      .text(`Departamento: ${act.delivererInfo.department}`, ML, y, { width: CW })
    y += 12
  }
  y += 6

  y = sectionTitle('Recibido por', y)
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('NOMBRE', ML, y, { width: halfW })
  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('CORREO', ML + CW / 2, y, { width: halfW })
  y += 9
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(act.receiverInfo.name, ML, y, { width: halfW })
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(act.receiverInfo.email, ML + CW / 2, y, { width: halfW })
  y += 13
  if (act.receiverInfo.department) {
    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor(C.muted)
      .text(`Departamento: ${act.receiverInfo.department}`, ML, y, { width: CW })
    y += 12
  }
  y += 6
  y = separator(y)

  // ── INFORMACIÓN FINANCIERA (condicional) ─────────────────────────────────
  const hasFinancial = !!(
    snap.supplierName ||
    snap.purchasePrice ||
    snap.purchaseDate ||
    snap.invoiceNumber ||
    snap.purchaseOrderNumber
  )

  if (hasFinancial) {
    y = sectionTitle('Información Financiera', y)
    if (snap.supplierName) {
      y = fieldRow(
        'Proveedor',
        snap.supplierName + (snap.supplierTaxId ? ` (${snap.supplierTaxId})` : ''),
        y
      )
    }
    if (snap.purchasePrice != null) {
      y = fieldRow(
        'Costo de Adquisición',
        `$${Number(snap.purchasePrice).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`,
        y
      )
    }
    if (snap.purchaseDate) {
      y = fieldRow(
        'Fecha de Compra',
        new Date(snap.purchaseDate).toLocaleDateString('es-EC', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
        y
      )
    }
    if (snap.invoiceNumber) y = fieldRow('N° Factura', snap.invoiceNumber, y)
    if (snap.purchaseOrderNumber) y = fieldRow('N° Orden de Compra', snap.purchaseOrderNumber, y)
    y = separator(y)
  }

  // ── OBSERVACIONES ───────────────────────────────────────────────────────
  if (act.observations) {
    y = sectionTitle('Observaciones', y)
    doc.fontSize(9).font('Helvetica').fillColor(C.text).text(act.observations, ML, y, { width: CW })
    y += doc.heightOfString(act.observations, { width: CW, fontSize: 9 }) + 10
    y = separator(y)
  }

  // ── FECHAS ──────────────────────────────────────────────────────────────
  y = sectionTitle('Fechas', y)
  const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleString('es-EC', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  doc
    .fontSize(7.5)
    .font('Helvetica-Bold')
    .fillColor(C.muted)
    .text('FECHA DE EMISIÓN', ML, y, { width: halfW })
  if (act.acceptedAt) {
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('FECHA DE ACEPTACIÓN', ML + CW / 2, y, { width: halfW })
  }
  y += 9
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(C.text)
    .text(fmtDate(act.createdAt), ML, y, { width: halfW })
  if (act.acceptedAt) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(fmtDate(act.acceptedAt), ML + CW / 2, y, { width: halfW })
  }
  y += 20

  // ── FIRMA DIGITAL + QR ──────────────────────────────────────────────────
  // Verificar si necesitamos nueva página
  if (y > 680) {
    doc.addPage()
    y = 40
  }

  y = separator(y)
  y = sectionTitle('Verificación Digital', y)

  if (act.status === 'ACCEPTED' && act.verificationHash) {
    // Firma + QR lado a lado
    const qrSize = 80
    const sigW = CW - qrSize - 20

    const shortHash = act.verificationHash.substring(0, 40) + '...'
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('HASH DE VERIFICACIÓN', ML, y, { width: sigW })
    y += 9
    doc.fontSize(7).font('Helvetica').fillColor(C.text).text(shortHash, ML, y, { width: sigW })
    y += 14

    if (act.signatureTimestamp) {
      doc
        .fontSize(7.5)
        .font('Helvetica-Bold')
        .fillColor(C.muted)
        .text('FIRMADO', ML, y, { width: sigW })
      y += 9
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(C.text)
        .text(fmtDate(act.signatureTimestamp), ML, y, { width: sigW })
      y += 14
    }

    if (act.signatureIp) {
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.muted).text('IP', ML, y, { width: sigW })
      y += 9
      doc.fontSize(8).font('Helvetica').fillColor(C.text).text(act.signatureIp, ML, y, {
        width: sigW,
      })
    }

    // QR a la derecha
    const qrX = W - MR - qrSize
    const qrY = y - 46
    doc.image(qrCodeDataUrl, qrX, qrY, { width: qrSize, height: qrSize })
    doc
      .fontSize(6.5)
      .font('Helvetica')
      .fillColor(C.muted)
      .text('Escanear para verificar', qrX, qrY + qrSize + 2, { width: qrSize, align: 'center' })
  } else {
    // Acta pendiente — QR centrado
    const qrSize = 80
    doc.image(qrCodeDataUrl, ML, y, { width: qrSize, height: qrSize })
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(C.muted)
      .text('Pendiente de firma digital', ML + qrSize + 12, y + 30, { width: CW - qrSize - 12 })
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 30
  doc
    .fontSize(7)
    .font('Helvetica')
    .fillColor(C.muted)
    .text(
      `Documento generado electrónicamente · ${companyName} · ${new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })}`,
      ML,
      footerY,
      { width: CW, align: 'center' }
    )

  return doc
}

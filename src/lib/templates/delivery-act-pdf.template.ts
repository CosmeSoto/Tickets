// PDFKit se carga via helper para evitar análisis estático de Turbopack
import { loadPDFKit } from '@/lib/utils/load-pdfkit'
import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import type { DeliveryAct } from '@/types/inventory/delivery-act'
import { getUploadDir } from '@/lib/upload-path'
import { DEFAULT_SYSTEM_NAME } from '@/lib/branding-constants'
import { getAppTimezone } from '@/lib/utils/date-utils'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  if (!url) return null
  try {
    if (url.startsWith('/')) {
      // Rutas /api/uploads/... → leer desde filesystem directamente
      if (url.startsWith('/api/uploads/')) {
        const relativePath = url.replace('/api/uploads/', '')
        const localPath = getUploadDir(relativePath)
        if (fs.existsSync(localPath)) return fs.readFileSync(localPath)
        // Fallback: intentar también con public/uploads (desarrollo local)
        const fallbackPath = path.join(process.cwd(), 'public', 'uploads', relativePath)
        if (fs.existsSync(fallbackPath)) return fs.readFileSync(fallbackPath)
        console.warn(`[PDF] Imagen no encontrada en filesystem: ${localPath}`)
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
          if (res.statusCode && res.statusCode >= 400) {
            console.warn(`[PDF] Error HTTP ${res.statusCode} al obtener imagen: ${url}`)
            resolve(null)
            return
          }
          const chunks: Buffer[] = []
          res.on('data', c => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
          res.on('error', reject)
        })
        .on('error', reject)
    })
  } catch (err) {
    console.warn(`[PDF] No se pudo cargar imagen (${url}):`, err)
    return null
  }
}

const CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  USED: 'Usado',
  DAMAGED: 'Dañado',
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
      Author: systemInfo?.companyName || DEFAULT_SYSTEM_NAME,
      Subject: 'Acta de Entrega de Equipo',
    },
  })

  const W = doc.page.width // 595
  const ML = 40
  const MR = 40
  const CW = W - ML - MR // ancho útil ~515

  let y = 40

  // ── HEADER ──────────────────────────────────────────────────────────────
  const companyName = systemInfo?.companyName || DEFAULT_SYSTEM_NAME
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

  // ── SECCIÓN DE ACTIVO — layout condicional por tipo de acta ────────────
  const snap = act.equipmentSnapshot as any
  // La columna `act.actType` (no `snap.actType`) es la fuente de verdad: el snapshot de
  // suscripción (buildContractSnapshot) nunca escribe `actType` dentro del JSON, así que
  // leerlo del snapshot hacía que toda acta de suscripción cayera en el layout de "Datos
  // del Equipo" con Código/N° Serie/Marca/Modelo vacíos.
  const actType: string = (act as { actType?: string }).actType ?? 'EQUIPMENT_ASSIGNMENT'
  const halfW = CW / 2 - 8

  if (actType === 'SUBSCRIPTION_ASSIGNMENT' || actType === 'CONTRACT_RENEWAL') {
    // ── Suscripción / contrato ────────────────────────────────────────────
    y = sectionTitle('Servicio / Suscripción', y)

    y = fieldRow('CONTRATO', snap.name || '—', y)
    y = fieldRow('PROVEEDOR', snap.supplier?.name || '—', y)

    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('MÉTODO DE PAGO', ML, y, { width: halfW })
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('COSTO MENSUAL', ML + CW / 2, y, { width: halfW })
    y += 9
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(
        (snap.paymentMethodType &&
          PAYMENT_METHOD_TYPE_LABELS[snap.paymentMethodType as PaymentMethodType]) ||
          '—',
        ML,
        y,
        { width: halfW }
      )
    const monthlyCost =
      snap.monthlyCost != null ? `${snap.monthlyCost} ${snap.currency ?? ''}`.trim() : '—'
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(monthlyCost, ML + CW / 2, y, { width: halfW })
    y += 18

    y = fieldRow('CUSTODIO', snap.custodian?.name || '—', y)
    y = fieldRow('EMAIL DE FACTURACIÓN', snap.billingAccountEmail || '—', y)

    y = separator(y)
  } else if (actType === 'MRO_DELIVERY') {
    // ── Suministros ─────────────────────────────────────────────────────
    y = sectionTitle('Suministro Entregado', y)

    // Nombre completo del suministro
    y = fieldRow('NOMBRE DEL SUMINISTRO', snap.name || snap.code || '—', y)

    // Categoría | Cantidad entregada
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('CATEGORÍA', ML, y, { width: halfW })
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('CANTIDAD ENTREGADA', ML + CW / 2, y, { width: halfW })
    y += 9
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(snap.brand || '—', ML, y, { width: halfW })
    const qtyLabel = snap.quantity != null ? `${snap.quantity} ${snap.unit ?? ''}`.trim() : '—'
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(qtyLabel, ML + CW / 2, y, { width: halfW })
    y += 20

    y = separator(y)
  } else if (actType === 'SERVICE_COMPLETION') {
    // ── Servicio / Mantenimiento ─────────────────────────────────────────
    y = sectionTitle('Equipo Intervenido', y)

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
      .text(snap.code || '—', ML, y, { width: halfW })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(snap.serialNumber || '—', ML + CW / 2, y, { width: halfW })
    y += 16

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
      .text(`${snap.brand || ''} ${snap.model || ''}`.trim() || '—', ML, y, { width: halfW })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(snap.typeName || '—', ML + CW / 2, y, { width: halfW })
    y += 18

    y = separator(y)

    // Descripción del servicio realizado
    y = sectionTitle('Descripción del Servicio Realizado', y)
    const serviceDesc = snap.serviceDescription || '—'
    doc.fontSize(9).font('Helvetica').fillColor(C.text).text(serviceDesc, ML, y, { width: CW })
    y += doc.heightOfString(serviceDesc, { width: CW }) + 10

    y = separator(y)
  } else if (actType === 'ASSET_TRANSFER') {
    // ── Transferencia entre bodegas ──────────────────────────────────────
    y = sectionTitle('Activo Transferido', y)

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
      .text(snap.code || '—', ML, y, { width: halfW })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(snap.serialNumber || '—', ML + CW / 2, y, { width: halfW })
    y += 16

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
      .text(`${snap.brand || ''} ${snap.model || ''}`.trim() || '—', ML, y, { width: halfW })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(snap.typeName || '—', ML + CW / 2, y, { width: halfW })
    y += 18

    y = separator(y)

    // Origen → Destino de bodega
    y = sectionTitle('Movimiento de Bodega', y)
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('BODEGA ORIGEN', ML, y, { width: halfW })
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('BODEGA DESTINO', ML + CW / 2, y, { width: halfW })
    y += 9
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(snap.originWarehouse || '—', ML, y, { width: halfW })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(snap.destinationWarehouse || snap.warehouseDestId || '—', ML + CW / 2, y, {
        width: halfW,
      })
    y += 20

    y = separator(y)
  } else {
    // ── EQUIPMENT_ASSIGNMENT (flujo estándar de asignación) ──────────────
    y = sectionTitle('Datos del Equipo', y)

    // Pre-cargar imagen para calcular el ancho disponible para los datos de texto
    const imgBuffer = snap.equipmentImagePath
      ? await fetchImageBuffer(snap.equipmentImagePath)
      : null
    const IMG_W = 90 // ancho de la miniatura
    const IMG_H = 90 // alto máximo
    const IMG_GAP = 12 // espacio entre texto e imagen
    const dataW = imgBuffer ? CW - IMG_W - IMG_GAP : CW

    // Guardar Y de inicio del bloque de datos para anclar la imagen
    const blockStartY = y

    // Fila 1: Código | N° Serie
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('CÓDIGO', ML, y, { width: dataW / 2 })
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('N° DE SERIE', ML + dataW / 2, y, { width: dataW / 2 })
    y += 9
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(act.equipmentSnapshot.code || '—', ML, y, { width: dataW / 2 })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(act.equipmentSnapshot.serialNumber || '—', ML + dataW / 2, y, { width: dataW / 2 })
    y += 14

    // Fila 2: Marca/Modelo | Tipo
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('MARCA / MODELO', ML, y, { width: dataW / 2 })
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('TIPO', ML + dataW / 2, y, { width: dataW / 2 })
    y += 9
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(`${act.equipmentSnapshot.brand} ${act.equipmentSnapshot.model}`, ML, y, {
        width: dataW / 2,
      })
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(
        act.equipmentSnapshot.typeName || act.equipmentSnapshot.type || '—',
        ML + dataW / 2,
        y,
        { width: dataW / 2 }
      )
    y += 14

    // Fila 3: Condición
    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor(C.muted)
      .text('CONDICIÓN', ML, y, { width: dataW / 2 })
    y += 9
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(C.text)
      .text(
        CONDITION_LABELS[act.equipmentSnapshot.condition] || act.equipmentSnapshot.condition || '—',
        ML,
        y,
        { width: dataW / 2 }
      )
    y += 14

    // Imagen: anclada al blockStartY, columna derecha
    if (imgBuffer) {
      const imgX = ML + dataW + IMG_GAP
      try {
        doc.image(imgBuffer, imgX, blockStartY, { fit: [IMG_W, IMG_H] })
      } catch {
        /* imagen inválida — ignorar silenciosamente */
      }
      // Asegurar que y no quede por encima del borde inferior de la imagen
      y = Math.max(y, blockStartY + IMG_H + 4)
    }

    // Accesorios en línea
    const accList = act.accessories?.length ? act.accessories : []
    if (accList.length > 0) {
      y += 2
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(C.muted).text('ACCESORIOS', ML, y)
      y += 9
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor(C.text)
        .text(accList.join('  ·  '), ML, y, { width: CW })
      y += 13
    }

    y += 4
    y = separator(y)

    // Atributos personalizados — grid de 3 columnas compacto
    const customVals: Array<{ fieldName: string; fieldValue: string; label?: string }> =
      snap.customValues ?? []
    if (customVals.length > 0) {
      y = sectionTitle('Atributos', y)
      const colW = Math.floor(CW / 3) - 6
      let col = 0
      customVals.forEach(cv => {
        const xPos = ML + col * (colW + 6)
        const label = (cv as any).label ?? cv.fieldName
        doc
          .fontSize(7)
          .font('Helvetica-Bold')
          .fillColor(C.muted)
          .text(label.toUpperCase(), xPos, y, { width: colW })
        doc
          .fontSize(8.5)
          .font('Helvetica')
          .fillColor(C.text)
          .text(cv.fieldValue || '—', xPos, y + 8, { width: colW })
        col++
        if (col >= 3) {
          col = 0
          y += 22
        }
      })
      if (col > 0) y += 22
      y = separator(y)
    }
  }

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
          timeZone: getAppTimezone(),
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
      timeZone: getAppTimezone(),
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

  // ── FIRMA DIGITAL + QR — siempre en la misma página (pie compacto) ──────
  // Solo agregar página si queda muy poco espacio (<120px)
  const pageH = doc.page.height
  const footerReserve = 120
  if (y > pageH - footerReserve - 40) {
    doc.addPage()
    y = 40
  }

  y = separator(y)

  // QR pequeño a la derecha + datos de firma a la izquierda, en una sola fila compacta
  const qrSize = 64
  const sigW = CW - qrSize - 16
  const sigStartY = y

  doc.fontSize(8).font('Helvetica-Bold').fillColor(C.accent).text('VERIFICACIÓN DIGITAL', ML, y)
  y += 12

  if (act.status === 'ACCEPTED' && act.verificationHash) {
    const shortHash = act.verificationHash.substring(0, 36) + '...'
    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor(C.muted)
      .text('Hash: ' + shortHash, ML, y, { width: sigW })
    y += 10
    if (act.signatureTimestamp) {
      const fmtSig = new Date(act.signatureTimestamp).toLocaleString('es-EC', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: getAppTimezone(),
      })
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor(C.muted)
        .text('Firmado: ' + fmtSig, ML, y, { width: sigW })
      y += 10
    }
    if (act.signatureIp) {
      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor(C.muted)
        .text('IP: ' + act.signatureIp, ML, y, { width: sigW })
      y += 10
    }
  } else {
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(C.muted)
      .text('Pendiente de firma digital', ML, y, { width: sigW })
    y += 10
  }

  // QR a la derecha del bloque de firma
  const qrX = W - MR - qrSize
  const qrY = sigStartY
  doc.image(qrCodeDataUrl, qrX, qrY, { width: qrSize, height: qrSize })
  doc
    .fontSize(6)
    .font('Helvetica')
    .fillColor(C.muted)
    .text('Escanear para verificar', qrX, qrY + qrSize + 2, { width: qrSize, align: 'center' })

  y = Math.max(y, qrY + qrSize + 10)

  // ── FOOTER ───────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 30
  doc
    .fontSize(7)
    .font('Helvetica')
    .fillColor(C.muted)
    .text(
      `Documento generado electrónicamente · ${companyName} · ${new Date().toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric', timeZone: getAppTimezone() })}`,
      ML,
      footerY,
      { width: CW, align: 'center' }
    )

  return doc
}

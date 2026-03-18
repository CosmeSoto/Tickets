// PDFKit se carga via helper para evitar análisis estático de Turbopack
import { loadPDFKit } from '@/lib/utils/load-pdfkit'
import type { DeliveryAct } from '@/types/inventory/delivery-act'

const EQUIPMENT_TYPE_LABELS: Record<string, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Desktop',
  MONITOR: 'Monitor',
  PRINTER: 'Impresora',
  PHONE: 'Teléfono',
  TABLET: 'Tablet',
  KEYBOARD: 'Teclado',
  MOUSE: 'Mouse',
  HEADSET: 'Audífonos',
  WEBCAM: 'Webcam',
  DOCKING_STATION: 'Docking Station',
  UPS: 'UPS',
  ROUTER: 'Router',
  SWITCH: 'Switch',
  OTHER: 'Otro',
}

const EQUIPMENT_CONDITION_LABELS: Record<string, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

export async function generateDeliveryActPDF(act: DeliveryAct, qrCodeDataUrl: string): Promise<any> {
  const PDFDocument = loadPDFKit()
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Acta de Entrega - ${act.folio}`,
      Author: 'Sistema de Gestión de Inventario',
      Subject: 'Acta de Entrega de Equipo',
      Keywords: 'acta, entrega, equipo, inventario',
    },
  })

  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const margin = 50
  const contentWidth = pageWidth - 2 * margin

  let yPosition = margin

  // Helper function to add text
  const addText = (text: string, options: any = {}) => {
    doc.text(text, margin, yPosition, { width: contentWidth, ...options })
    yPosition += doc.heightOfString(text, { width: contentWidth, ...options }) + (options.lineGap || 5)
  }

  // Helper function to add section
  const addSection = (title: string) => {
    yPosition += 10
    doc.fontSize(12).font('Helvetica-Bold')
    addText(title, { lineGap: 8 })
    doc.fontSize(10).font('Helvetica')
  }

  // Helper function to add field
  const addField = (label: string, value: string) => {
    doc.font('Helvetica-Bold').text(label + ': ', margin, yPosition, { continued: true, width: contentWidth })
    doc.font('Helvetica').text(value, { width: contentWidth })
    yPosition += doc.heightOfString(value, { width: contentWidth }) + 5
  }

  // Header
  doc.fontSize(18).font('Helvetica-Bold')
  addText('ACTA DE ENTREGA DE EQUIPO', { align: 'center', lineGap: 10 })

  doc.fontSize(14).font('Helvetica')
  addText(act.folio, { align: 'center', lineGap: 15 })

  // Línea separadora
  doc.moveTo(margin, yPosition).lineTo(pageWidth - margin, yPosition).stroke()
  yPosition += 15

  // Información del Equipo
  addSection('INFORMACIÓN DEL EQUIPO')
  addField('Código', act.equipmentSnapshot.code)
  addField('Número de Serie', act.equipmentSnapshot.serialNumber)
  addField('Marca', act.equipmentSnapshot.brand)
  addField('Modelo', act.equipmentSnapshot.model)
  addField('Tipo', EQUIPMENT_TYPE_LABELS[act.equipmentSnapshot.type] || act.equipmentSnapshot.type)
  addField('Condición', EQUIPMENT_CONDITION_LABELS[act.equipmentSnapshot.condition] || act.equipmentSnapshot.condition)

  // Especificaciones Técnicas
  if (act.equipmentSnapshot.specifications && Object.keys(act.equipmentSnapshot.specifications).length > 0) {
    addSection('ESPECIFICACIONES TÉCNICAS')
    Object.entries(act.equipmentSnapshot.specifications).forEach(([key, value]) => {
      addField(key, value as string)
    })
  }

  // Accesorios
  if (act.accessories && act.accessories.length > 0) {
    addSection('ACCESORIOS INCLUIDOS')
    act.accessories.forEach((accessory, index) => {
      addText(`${index + 1}. ${accessory}`)
    })
  }

  // Información de Entrega
  addSection('INFORMACIÓN DE ENTREGA')
  
  doc.font('Helvetica-Bold').text('Entregado por:', margin, yPosition)
  yPosition += 15
  doc.font('Helvetica')
  addField('Nombre', act.delivererInfo.name)
  addField('Email', act.delivererInfo.email)
  if (act.delivererInfo.department) {
    addField('Departamento', act.delivererInfo.department)
  }
  yPosition += 5

  doc.font('Helvetica-Bold').text('Recibido por:', margin, yPosition)
  yPosition += 15
  doc.font('Helvetica')
  addField('Nombre', act.receiverInfo.name)
  addField('Email', act.receiverInfo.email)
  if (act.receiverInfo.department) {
    addField('Departamento', act.receiverInfo.department)
  }

  // Fechas
  addSection('FECHAS')
  addField('Fecha de Creación', new Date(act.createdAt).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }))
  
  if (act.acceptedAt) {
    addField('Fecha de Aceptación', new Date(act.acceptedAt).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }))
  }

  // Observaciones
  if (act.observations) {
    addSection('OBSERVACIONES')
    addText(act.observations, { lineGap: 10 })
  }

  // Firma Digital
  if (act.status === 'ACCEPTED' && act.verificationHash) {
    addSection('FIRMA DIGITAL')
    addField('Hash de Verificación', act.verificationHash)
    
    if (act.signatureTimestamp) {
      addField('Fecha y Hora de Firma', new Date(act.signatureTimestamp).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }))
    }
    
    if (act.signatureIp) {
      addField('Dirección IP', act.signatureIp)
    }
  }

  // QR Code
  yPosition += 20
  if (yPosition > pageHeight - 200) {
    doc.addPage()
    yPosition = margin
  }

  doc.fontSize(12).font('Helvetica-Bold')
  addText('CÓDIGO QR DE VERIFICACIÓN', { align: 'center', lineGap: 10 })
  
  // Agregar QR code
  const qrSize = 150
  const qrX = (pageWidth - qrSize) / 2
  doc.image(qrCodeDataUrl, qrX, yPosition, { width: qrSize, height: qrSize })
  yPosition += qrSize + 10

  doc.fontSize(9).font('Helvetica')
  addText('Escanea este código para verificar la autenticidad del acta', { align: 'center', lineGap: 5 })
  addText(`URL: ${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/inventory/acts/${act.id}/verify`, { 
    align: 'center', 
    lineGap: 15,
    fontSize: 8,
  })

  // Footer
  const footerY = pageHeight - margin - 30
  doc.fontSize(8).font('Helvetica')
  doc.text(
    'Este documento ha sido generado electrónicamente y es válido sin firma manuscrita.',
    margin,
    footerY,
    { width: contentWidth, align: 'center' }
  )
  doc.text(
    `Generado el ${new Date().toLocaleString('es-ES')}`,
    margin,
    footerY + 12,
    { width: contentWidth, align: 'center' }
  )

  return doc
}

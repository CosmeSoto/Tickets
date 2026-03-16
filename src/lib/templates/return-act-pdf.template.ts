import PDFDocument from 'pdfkit'

// Placeholder para actas de devolución
// Se implementará completamente en Task 5.1
export function generateReturnActPDF(act: any, qrCodeDataUrl: string): PDFDocument {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Acta de Devolución - ${act.folio}`,
      Author: 'Sistema de Gestión de Inventario',
      Subject: 'Acta de Devolución de Equipo',
    },
  })

  doc.fontSize(18).font('Helvetica-Bold')
  doc.text('ACTA DE DEVOLUCIÓN DE EQUIPO', { align: 'center' })
  doc.moveDown()
  
  doc.fontSize(14).font('Helvetica')
  doc.text(act.folio, { align: 'center' })
  doc.moveDown(2)

  doc.fontSize(10).font('Helvetica')
  doc.text('Este template será implementado en la Fase 5 (Return Acts and Maintenance)')

  return doc
}

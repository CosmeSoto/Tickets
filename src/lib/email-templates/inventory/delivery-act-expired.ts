import type { DeliveryAct } from '@/types/inventory/delivery-act'

interface DeliveryActExpiredEmailData {
  act: DeliveryAct
  recipientName: string
  equipmentCode: string
  equipmentDescription: string
  expirationDate: Date
}

export function generateDeliveryActExpiredEmail(data: DeliveryActExpiredEmailData): {
  subject: string
  html: string
  text: string
} {
  const { act, recipientName, equipmentCode, equipmentDescription, expirationDate } = data

  const expirationDateStr = new Date(expirationDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const subject = `Acta de Entrega Expirada - ${act.folio}`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #6b7280; color: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <h1 style="margin: 0;">⏰ Acta Expirada</h1>
    <p style="margin: 10px 0 0 0;">${act.folio}</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
    <h2 style="color: #1f2937; font-size: 18px; margin-top: 0;">Hola ${recipientName},</h2>
    
    <p>El acta de entrega ha <strong>expirado</strong> sin ser aceptada.</p>
    
    <div style="background-color: #f3f4f6; border-left: 4px solid #6b7280; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Acta:</strong> ${act.folio}</p>
      <p style="margin: 0 0 8px 0;"><strong>Equipo:</strong> ${equipmentCode}</p>
      <p style="margin: 0 0 8px 0;"><strong>Descripción:</strong> ${equipmentDescription}</p>
      <p style="margin: 0;"><strong>Expiró el:</strong> ${expirationDateStr}</p>
    </div>

    <p>La asignación ha sido cancelada automáticamente. Por favor, contacta al departamento de TI si necesitas que se genere una nueva acta.</p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; color: #6b7280; font-size: 12px;">
    <p><strong>Sistema de Gestión de Inventario</strong></p>
  </div>
</body>
</html>
  `

  const text = `
⏰ ACTA DE ENTREGA EXPIRADA
${act.folio}

Hola ${recipientName},

El acta de entrega ha EXPIRADO sin ser aceptada.

Acta: ${act.folio}
Equipo: ${equipmentCode}
Descripción: ${equipmentDescription}
Expiró el: ${expirationDateStr}

La asignación ha sido cancelada automáticamente. Por favor, contacta al departamento de TI si necesitas que se genere una nueva acta.

---
Sistema de Gestión de Inventario
  `

  return { subject, html, text }
}

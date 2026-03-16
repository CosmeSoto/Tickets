import type { DeliveryAct } from '@/types/inventory/delivery-act'

interface DeliveryActRejectedEmailData {
  act: DeliveryAct
  recipientName: string
  equipmentCode: string
  equipmentDescription: string
  rejectionReason: string
  rejectedAt: Date
}

export function generateDeliveryActRejectedEmail(data: DeliveryActRejectedEmailData): {
  subject: string
  html: string
  text: string
} {
  const { act, recipientName, equipmentCode, equipmentDescription, rejectionReason, rejectedAt } = data

  const rejectedAtStr = new Date(rejectedAt).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const subject = `Acta de Entrega Rechazada - ${act.folio}`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #dc2626; color: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <h1 style="margin: 0;">✗ Acta Rechazada</h1>
    <p style="margin: 10px 0 0 0;">${act.folio}</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
    <h2 style="color: #1f2937; font-size: 18px; margin-top: 0;">Hola ${recipientName},</h2>
    
    <p>El acta de entrega ha sido <strong>rechazada</strong>.</p>
    
    <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Acta:</strong> ${act.folio}</p>
      <p style="margin: 0 0 8px 0;"><strong>Equipo:</strong> ${equipmentCode}</p>
      <p style="margin: 0 0 8px 0;"><strong>Descripción:</strong> ${equipmentDescription}</p>
      <p style="margin: 0;"><strong>Rechazada el:</strong> ${rejectedAtStr}</p>
    </div>

    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Motivo del Rechazo:</strong></p>
      <p style="margin: 0;">${rejectionReason}</p>
    </div>

    <p>La asignación ha sido cancelada y el equipo está nuevamente disponible. Por favor, contacta al departamento de TI para coordinar una nueva entrega si es necesario.</p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; color: #6b7280; font-size: 12px;">
    <p><strong>Sistema de Gestión de Inventario</strong></p>
  </div>
</body>
</html>
  `

  const text = `
✗ ACTA DE ENTREGA RECHAZADA
${act.folio}

Hola ${recipientName},

El acta de entrega ha sido RECHAZADA.

Acta: ${act.folio}
Equipo: ${equipmentCode}
Descripción: ${equipmentDescription}
Rechazada el: ${rejectedAtStr}

MOTIVO DEL RECHAZO:
${rejectionReason}

La asignación ha sido cancelada y el equipo está nuevamente disponible. Por favor, contacta al departamento de TI para coordinar una nueva entrega si es necesario.

---
Sistema de Gestión de Inventario
  `

  return { subject, html, text }
}

import type { DeliveryAct } from '@/types/inventory/delivery-act'

interface DeliveryActCreatedEmailData {
  act: DeliveryAct
  acceptanceUrl: string
  receiverName: string
  delivererName: string
  equipmentCode: string
  equipmentDescription: string
  expirationDate: Date
}

export function generateDeliveryActCreatedEmail(data: DeliveryActCreatedEmailData): {
  subject: string
  html: string
  text: string
} {
  const { act, acceptanceUrl, receiverName, delivererName, equipmentCode, equipmentDescription, expirationDate } = data

  const expirationDateStr = new Date(expirationDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const subject = `Acta de Entrega - ${act.folio}`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h1 style="color: #2563eb; margin: 0 0 10px 0; font-size: 24px;">Acta de Entrega</h1>
    <p style="color: #6b7280; margin: 0; font-size: 16px;">${act.folio}</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; font-size: 18px; margin-top: 0;">Hola ${receiverName},</h2>
    
    <p>Se ha generado un acta de entrega para el siguiente equipo:</p>
    
    <div style="background-color: #f3f4f6; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Equipo:</strong> ${equipmentCode}</p>
      <p style="margin: 0 0 8px 0;"><strong>Descripción:</strong> ${equipmentDescription}</p>
      <p style="margin: 0;"><strong>Entregado por:</strong> ${delivererName}</p>
    </div>

    <p><strong>⚠️ Acción Requerida:</strong></p>
    <p>Debes revisar y aceptar esta acta antes del <strong>${expirationDateStr}</strong>.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptanceUrl}" 
         style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Revisar y Aceptar Acta
      </a>
    </div>

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      Si no aceptas el acta antes de la fecha de expiración, la asignación será cancelada automáticamente.
    </p>
  </div>

  <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 14px;">
      <strong>📋 Importante:</strong> Al aceptar el acta, confirmas que has recibido el equipo en las condiciones descritas y te comprometes a cuidarlo según las políticas de la empresa.
    </p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; color: #6b7280; font-size: 12px;">
    <p>Si tienes alguna pregunta, contacta a ${delivererName} o al departamento de TI.</p>
    <p style="margin-top: 10px;">
      <strong>Sistema de Gestión de Inventario</strong><br>
      Este es un correo automático, por favor no respondas a este mensaje.
    </p>
  </div>
</body>
</html>
  `

  const text = `
ACTA DE ENTREGA
${act.folio}

Hola ${receiverName},

Se ha generado un acta de entrega para el siguiente equipo:

Equipo: ${equipmentCode}
Descripción: ${equipmentDescription}
Entregado por: ${delivererName}

⚠️ ACCIÓN REQUERIDA:
Debes revisar y aceptar esta acta antes del ${expirationDateStr}.

Para revisar y aceptar el acta, visita:
${acceptanceUrl}

Si no aceptas el acta antes de la fecha de expiración, la asignación será cancelada automáticamente.

📋 IMPORTANTE: Al aceptar el acta, confirmas que has recibido el equipo en las condiciones descritas y te comprometes a cuidarlo según las políticas de la empresa.

Si tienes alguna pregunta, contacta a ${delivererName} o al departamento de TI.

---
Sistema de Gestión de Inventario
Este es un correo automático, por favor no respondas a este mensaje.
  `

  return { subject, html, text }
}

import type { DeliveryAct } from '@/types/inventory/delivery-act'

interface DeliveryActReminderEmailData {
  act: DeliveryAct
  acceptanceUrl: string
  receiverName: string
  equipmentCode: string
  equipmentDescription: string
  expirationDate: Date
  daysRemaining: number
}

export function generateDeliveryActReminderEmail(data: DeliveryActReminderEmailData): {
  subject: string
  html: string
  text: string
} {
  const { act, acceptanceUrl, receiverName, equipmentCode, equipmentDescription, expirationDate, daysRemaining } = data

  const expirationDateStr = new Date(expirationDate).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const urgencyColor = daysRemaining === 1 ? '#dc2626' : '#f59e0b'
  const urgencyText = daysRemaining === 1 ? '¡URGENTE!' : 'Recordatorio'

  const subject = `${urgencyText} - Acta de Entrega Pendiente - ${act.folio}`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: ${urgencyColor}; color: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <h1 style="margin: 0 0 10px 0; font-size: 24px;">${urgencyText}</h1>
    <p style="margin: 0; font-size: 18px; font-weight: bold;">
      ${daysRemaining === 1 ? 'Expira mañana' : `Expira en ${daysRemaining} días`}
    </p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; font-size: 18px; margin-top: 0;">Hola ${receiverName},</h2>
    
    <p>Tienes un acta de entrega pendiente que <strong>expira el ${expirationDateStr}</strong>.</p>
    
    <div style="background-color: #f3f4f6; border-left: 4px solid ${urgencyColor}; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Acta:</strong> ${act.folio}</p>
      <p style="margin: 0 0 8px 0;"><strong>Equipo:</strong> ${equipmentCode}</p>
      <p style="margin: 0;"><strong>Descripción:</strong> ${equipmentDescription}</p>
    </div>

    <p><strong>⏰ Tiempo restante: ${daysRemaining === 1 ? '1 día' : `${daysRemaining} días`}</strong></p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${acceptanceUrl}" 
         style="background-color: ${urgencyColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        Aceptar Acta Ahora
      </a>
    </div>

    <p style="color: #dc2626; font-weight: bold;">
      Si no aceptas el acta antes de la fecha de expiración, la asignación será cancelada automáticamente y deberás devolver el equipo.
    </p>
  </div>

  <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px; color: #6b7280; font-size: 12px;">
    <p>
      <strong>Sistema de Gestión de Inventario</strong><br>
      Este es un correo automático, por favor no respondas a este mensaje.
    </p>
  </div>
</body>
</html>
  `

  const text = `
${urgencyText} - ACTA DE ENTREGA PENDIENTE
${act.folio}

Hola ${receiverName},

Tienes un acta de entrega pendiente que EXPIRA EL ${expirationDateStr}.

Acta: ${act.folio}
Equipo: ${equipmentCode}
Descripción: ${equipmentDescription}

⏰ TIEMPO RESTANTE: ${daysRemaining === 1 ? '1 DÍA' : `${daysRemaining} DÍAS`}

Para aceptar el acta, visita:
${acceptanceUrl}

⚠️ IMPORTANTE: Si no aceptas el acta antes de la fecha de expiración, la asignación será cancelada automáticamente y deberás devolver el equipo.

---
Sistema de Gestión de Inventario
Este es un correo automático, por favor no respondas a este mensaje.
  `

  return { subject, html, text }
}

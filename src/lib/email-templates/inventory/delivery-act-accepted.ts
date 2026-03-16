import type { DeliveryAct } from '@/types/inventory/delivery-act'

interface DeliveryActAcceptedEmailData {
  act: DeliveryAct
  recipientName: string
  recipientRole: 'deliverer' | 'receiver'
  equipmentCode: string
  equipmentDescription: string
  acceptedAt: Date
  pdfUrl?: string
}

export function generateDeliveryActAcceptedEmail(data: DeliveryActAcceptedEmailData): {
  subject: string
  html: string
  text: string
} {
  const { act, recipientName, recipientRole, equipmentCode, equipmentDescription, acceptedAt, pdfUrl } = data

  const acceptedAtStr = new Date(acceptedAt).toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const roleText = recipientRole === 'deliverer' ? 'entregador' : 'receptor'
  const otherParty = recipientRole === 'deliverer' ? act.receiverInfo.name : act.delivererInfo.name

  const subject = `Acta de Entrega Aceptada - ${act.folio}`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #10b981; color: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
    <h1 style="margin: 0 0 10px 0; font-size: 24px;">✓ Acta Aceptada</h1>
    <p style="margin: 0; font-size: 16px;">${act.folio}</p>
  </div>

  <div style="background-color: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h2 style="color: #1f2937; font-size: 18px; margin-top: 0;">Hola ${recipientName},</h2>
    
    <p>El acta de entrega ha sido <strong>aceptada exitosamente</strong> por ${otherParty}.</p>
    
    <div style="background-color: #f3f4f6; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Acta:</strong> ${act.folio}</p>
      <p style="margin: 0 0 8px 0;"><strong>Equipo:</strong> ${equipmentCode}</p>
      <p style="margin: 0 0 8px 0;"><strong>Descripción:</strong> ${equipmentDescription}</p>
      <p style="margin: 0;"><strong>Aceptada el:</strong> ${acceptedAtStr}</p>
    </div>

    ${pdfUrl ? `
    <div style="background-color: #dbeafe; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>📄 Documento Disponible</strong></p>
      <p style="margin: 0 0 15px 0; font-size: 14px;">El acta firmada digitalmente está disponible para descarga:</p>
      <div style="text-align: center;">
        <a href="${pdfUrl}" 
           style="background-color: #3b82f6; color: white; padding: 10px 25px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
          Descargar PDF
        </a>
      </div>
    </div>
    ` : ''}

    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
      ${recipientRole === 'receiver' 
        ? 'Recuerda cuidar el equipo y reportar cualquier problema inmediatamente.' 
        : 'La entrega ha sido completada exitosamente.'}
    </p>
  </div>

  <div style="background-color: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
    <p style="margin: 0; font-size: 14px;">
      <strong>✓ Firma Digital Registrada</strong><br>
      Este acta ha sido firmada digitalmente y puede ser verificada en cualquier momento.
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
✓ ACTA DE ENTREGA ACEPTADA
${act.folio}

Hola ${recipientName},

El acta de entrega ha sido ACEPTADA EXITOSAMENTE por ${otherParty}.

Acta: ${act.folio}
Equipo: ${equipmentCode}
Descripción: ${equipmentDescription}
Aceptada el: ${acceptedAtStr}

${pdfUrl ? `
📄 DOCUMENTO DISPONIBLE
El acta firmada digitalmente está disponible para descarga en:
${pdfUrl}
` : ''}

${recipientRole === 'receiver' 
  ? 'Recuerda cuidar el equipo y reportar cualquier problema inmediatamente.' 
  : 'La entrega ha sido completada exitosamente.'}

✓ FIRMA DIGITAL REGISTRADA
Este acta ha sido firmada digitalmente y puede ser verificada en cualquier momento.

---
Sistema de Gestión de Inventario
Este es un correo automático, por favor no respondas a este mensaje.
  `

  return { subject, html, text }
}

/**
 * Template: Ticket Resuelto
 * Se envía al cliente cuando su ticket es resuelto
 */

export default function ticketResolvedTemplate(data: {
  ticketId: string
  ticketTitle: string
  ticketNumber: string
  clientName: string
  technicianName: string
  resolution: string
  ticketUrl: string
  ratingUrl: string
}) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Resuelto</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">✅ Ticket Resuelto</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                Hola <strong>${data.clientName}</strong>,
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                ¡Buenas noticias! Tu ticket <strong>#${data.ticketNumber}</strong> ha sido resuelto por ${data.technicianName}.
              </p>
              
              <!-- Ticket Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 6px; margin: 20px 0; border: 2px solid #10b981;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #065f46; font-size: 14px; font-weight: bold; margin: 0 0 10px 0;">
                      ${data.ticketTitle}
                    </p>
                    <p style="color: #047857; font-size: 12px; margin: 0;">
                      Ticket #${data.ticketNumber}
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Resolution -->
              <div style="background-color: #f9fafb; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: bold;">Solución Aplicada:</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${data.resolution}</p>
              </div>
              
              <!-- Rating Section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef3c7; border-radius: 6px; margin: 30px 0; padding: 20px;">
                <tr>
                  <td align="center">
                    <p style="color: #92400e; font-size: 16px; font-weight: bold; margin: 0 0 10px 0;">
                      ⭐ ¿Cómo fue tu experiencia?
                    </p>
                    <p style="color: #78350f; font-size: 14px; margin: 0 0 20px 0;">
                      Tu opinión nos ayuda a mejorar nuestro servicio
                    </p>
                    <a href="${data.ratingUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: bold;">
                      Calificar Servicio
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                      Ver Detalles del Ticket
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                Si el problema persiste o tienes alguna pregunta adicional, no dudes en responder a este ticket.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Gracias por usar nuestro sistema de soporte.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
                © ${new Date().getFullYear()} Sistema de Tickets. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  const text = `
Ticket Resuelto

Hola ${data.clientName},

¡Buenas noticias! Tu ticket #${data.ticketNumber} ha sido resuelto por ${data.technicianName}.

Ticket: ${data.ticketTitle}

Solución Aplicada:
${data.resolution}

⭐ ¿Cómo fue tu experiencia?
Tu opinión nos ayuda a mejorar nuestro servicio.
Calificar servicio: ${data.ratingUrl}

Ver detalles: ${data.ticketUrl}

Si el problema persiste o tienes alguna pregunta adicional, no dudes en responder a este ticket.

---
Gracias por usar nuestro sistema de soporte.
© ${new Date().getFullYear()} Sistema de Tickets
  `.trim()

  return { html, text }
}

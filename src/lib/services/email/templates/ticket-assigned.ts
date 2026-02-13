/**
 * Template: Ticket Asignado
 * Se envía al técnico cuando se le asigna un ticket
 */

export default function ticketAssignedTemplate(data: {
  ticketId: string
  ticketTitle: string
  ticketNumber: string
  technicianName: string
  clientName: string
  category: string
  priority: string
  description: string
  ticketUrl: string
}) {
  const priorityColors = {
    LOW: '#10B981',
    MEDIUM: '#F59E0B',
    HIGH: '#EF4444',
    URGENT: '#DC2626'
  }

  const priorityLabels = {
    LOW: 'Baja',
    MEDIUM: 'Media',
    HIGH: 'Alta',
    URGENT: 'Urgente'
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Asignado</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎯 Nuevo Ticket Asignado</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                Hola <strong>${data.technicianName}</strong>,
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                Se te ha asignado un nuevo ticket que requiere tu atención.
              </p>
              
              <!-- Ticket Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin: 20px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Ticket:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: bold; padding: 8px 0; text-align: right;">#${data.ticketNumber}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Título:</td>
                        <td style="color: #111827; font-size: 14px; font-weight: bold; padding: 8px 0; text-align: right;">${data.ticketTitle}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Cliente:</td>
                        <td style="color: #111827; font-size: 14px; padding: 8px 0; text-align: right;">${data.clientName}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Categoría:</td>
                        <td style="color: #111827; font-size: 14px; padding: 8px 0; text-align: right;">${data.category}</td>
                      </tr>
                      <tr>
                        <td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Prioridad:</td>
                        <td style="text-align: right; padding: 8px 0;">
                          <span style="background-color: ${priorityColors[data.priority as keyof typeof priorityColors]}; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                            ${priorityLabels[data.priority as keyof typeof priorityLabels]}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Description -->
              <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: bold;">Descripción del Problema:</p>
                <p style="color: #374151; font-size: 14px; line-height: 1.6; margin: 0;">${data.description}</p>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${data.ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: bold;">
                      Trabajar en Ticket
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                Por favor, responde al cliente lo antes posible para mantener un buen nivel de servicio.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Este es un email automático, por favor no respondas a este mensaje.
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
Nuevo Ticket Asignado

Hola ${data.technicianName},

Se te ha asignado un nuevo ticket que requiere tu atención.

Detalles del Ticket:
- Número: #${data.ticketNumber}
- Título: ${data.ticketTitle}
- Cliente: ${data.clientName}
- Categoría: ${data.category}
- Prioridad: ${priorityLabels[data.priority as keyof typeof priorityLabels]}

Descripción del Problema:
${data.description}

Trabajar en ticket: ${data.ticketUrl}

Por favor, responde al cliente lo antes posible para mantener un buen nivel de servicio.

---
Este es un email automático, por favor no respondas a este mensaje.
© ${new Date().getFullYear()} Sistema de Tickets
  `.trim()

  return { html, text }
}

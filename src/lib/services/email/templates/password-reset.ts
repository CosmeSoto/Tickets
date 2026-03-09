/**
 * Template de Email: Recuperación de Contraseña
 */

interface PasswordResetData {
  userName: string
  resetUrl: string
  expiryTime: string
}

export default function passwordResetTemplate(data: PasswordResetData) {
  const { userName, resetUrl, expiryTime } = data

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperación de Contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <div style="width: 60px; height: 60px; background-color: white; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" fill="#667eea"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 600;">Recuperación de Contraseña</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Hola <strong>${userName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en el Sistema de Tickets.
              </p>

              <p style="margin: 0 0 30px; color: #374151; font-size: 16px; line-height: 1.6;">
                Haz clic en el botón de abajo para crear una nueva contraseña:
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 0 0 30px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      Restablecer Contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Info Box -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 0 0 30px; border-radius: 4px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>⏰ Importante:</strong> Este enlace expirará en <strong>${expiryTime}</strong> por razones de seguridad.
                </p>
              </div>

              <p style="margin: 0 0 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>

              <div style="background-color: #f3f4f6; padding: 12px; border-radius: 4px; margin: 0 0 30px; word-break: break-all;">
                <a href="${resetUrl}" style="color: #667eea; text-decoration: none; font-size: 13px;">
                  ${resetUrl}
                </a>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 0 0 20px; border-radius: 4px;">
                <p style="margin: 0 0 10px; color: #991b1b; font-size: 14px; font-weight: 600;">
                  🔒 Aviso de Seguridad
                </p>
                <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.6;">
                  Si no solicitaste restablecer tu contraseña, ignora este email. Tu cuenta permanecerá segura.
                </p>
              </div>

              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Si tienes problemas o necesitas ayuda, contacta a nuestro equipo de soporte.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 13px; text-align: center;">
                Sistema de Tickets - Gestión Profesional de Soporte
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                Este es un email automático, por favor no respondas a este mensaje.
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
Recuperación de Contraseña - Sistema de Tickets

Hola ${userName},

Recibimos una solicitud para restablecer la contraseña de tu cuenta.

Para crear una nueva contraseña, visita el siguiente enlace:
${resetUrl}

⏰ IMPORTANTE: Este enlace expirará en ${expiryTime} por razones de seguridad.

🔒 AVISO DE SEGURIDAD:
Si no solicitaste restablecer tu contraseña, ignora este email. Tu cuenta permanecerá segura.

Si tienes problemas, contacta a nuestro equipo de soporte.

---
Sistema de Tickets - Gestión Profesional de Soporte
Este es un email automático, por favor no respondas a este mensaje.
  `

  return { html, text }
}

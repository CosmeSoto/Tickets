import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'
import { z } from 'zod'

const testEmailSchema = z.object({
  smtpHost: z.string().min(1, 'El servidor SMTP es requerido'),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string().min(1, 'El usuario SMTP es requerido'),
  smtpPassword: z.string().min(1, 'La contraseña SMTP es requerida'),
  smtpSecure: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Validar con mensajes claros
    const parsed = testEmailSchema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return NextResponse.json(
        { error: `Datos incompletos: ${firstError.message}` },
        { status: 422 }
      )
    }

    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure } = parsed.data

    // Para puerto 587 (STARTTLS), smtpSecure debe ser false aunque el usuario active SSL/TLS
    // Para puerto 465 (SSL directo), smtpSecure debe ser true
    const useSecure = smtpPort === 465 ? true : smtpPort === 587 ? false : smtpSecure

    const transportConfig: nodemailer.TransportOptions = {
      host: smtpHost,
      port: smtpPort,
      secure: useSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Para STARTTLS (puerto 587) forzar upgrade aunque secure=false
      ...(smtpPort === 587 && { requireTLS: true }),
      // Timeout razonable
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    } as nodemailer.TransportOptions

    const transporter = nodemailer.createTransport(transportConfig)

    // Verificar conexión
    await transporter.verify()

    // Enviar email de prueba
    await transporter.sendMail({
      from: smtpUser,
      to: session.user.email,
      subject: 'Prueba de Configuración SMTP - Sistema de Tickets',
      html: `
        <h2>Configuración SMTP Exitosa</h2>
        <p>Este es un email de prueba para confirmar que la configuración SMTP está funcionando correctamente.</p>
        <p><strong>Servidor:</strong> ${smtpHost}:${smtpPort}</p>
        <p><strong>Usuario:</strong> ${smtpUser}</p>
        <p><strong>Modo:</strong> ${smtpPort === 465 ? 'SSL directo' : smtpPort === 587 ? 'STARTTLS' : smtpSecure ? 'SSL/TLS' : 'Sin cifrado'}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <hr>
        <p><small>Sistema de Tickets - Configuración de Email</small></p>
      `,
      text: `Configuración SMTP Exitosa\n\nServidor: ${smtpHost}:${smtpPort}\nUsuario: ${smtpUser}\nFecha: ${new Date().toLocaleString('es-ES')}`,
    })

    return NextResponse.json({
      success: true,
      message: `Email de prueba enviado a ${session.user.email}`,
    })
  } catch (error) {
    console.error('Error al probar configuración de email:', error)

    let errorMessage = 'Error desconocido al conectar con el servidor SMTP'

    if (error instanceof Error) {
      if (error.message.includes('EAUTH') || error.message.includes('535') || error.message.includes('534')) {
        errorMessage = 'Error de autenticación. Verifica usuario y contraseña.'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'No se pudo conectar al servidor SMTP. Verifica host y puerto.'
      } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
        errorMessage = 'Tiempo de conexión agotado. Verifica host, puerto y firewall.'
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Servidor SMTP no encontrado. Verifica el nombre del host.'
      } else if (error.message.includes('certificate') || error.message.includes('SSL') || error.message.includes('TLS')) {
        errorMessage = 'Error de certificado SSL/TLS. Intenta cambiar el puerto o la configuración de seguridad.'
      } else if (error.message.includes('ZodError') || error.message.includes('invalid')) {
        errorMessage = 'Datos de configuración inválidos. Completa todos los campos.'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }
}

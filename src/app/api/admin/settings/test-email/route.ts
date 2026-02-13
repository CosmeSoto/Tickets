import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import nodemailer from 'nodemailer'
import { z } from 'zod'

const testEmailSchema = z.object({
  smtpHost: z.string().min(1),
  smtpPort: z.number(),
  smtpUser: z.string().min(1),
  smtpPassword: z.string().min(1),
  smtpSecure: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure } = testEmailSchema.parse(body)

    // Crear transporter de nodemailer
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    })

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
        <p><strong>Seguro:</strong> ${smtpSecure ? 'Sí' : 'No'}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <hr>
        <p><small>Sistema de Tickets - Configuración de Email</small></p>
      `,
      text: `
        Configuración SMTP Exitosa
        
        Este es un email de prueba para confirmar que la configuración SMTP está funcionando correctamente.
        
        Servidor: ${smtpHost}:${smtpPort}
        Usuario: ${smtpUser}
        Seguro: ${smtpSecure ? 'Sí' : 'No'}
        Fecha: ${new Date().toLocaleString('es-ES')}
        
        Sistema de Tickets - Configuración de Email
      `,
    })

    return NextResponse.json({
      success: true,
      message: `Email de prueba enviado a ${session.user.email}`,
    })
  } catch (error) {
    console.error('Error al probar configuración de email:', error)

    let errorMessage = 'Error desconocido'

    if (error instanceof Error) {
      if (error.message.includes('EAUTH')) {
        errorMessage = 'Error de autenticación. Verifica usuario y contraseña.'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'No se pudo conectar al servidor SMTP. Verifica host y puerto.'
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Tiempo de conexión agotado. Verifica la configuración de red.'
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }
}

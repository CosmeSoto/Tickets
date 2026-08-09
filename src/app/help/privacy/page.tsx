'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicPageLayout } from '@/components/auth/auth-layout'
import { ArrowLeft, Shield } from 'lucide-react'

interface PrivacyContact {
  companyName?: string
  supportEmail?: string | null
  companyAddress?: string | null
}

export default function PrivacyPage() {
  const [contact, setContact] = useState<PrivacyContact>({})

  useEffect(() => {
    fetch('/api/config/help')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.data) {
          setContact({
            companyName: data.data.companyName,
            supportEmail: data.data.supportEmail,
          })
        }
      })
      .catch(() => {})
  }, [])

  const orgName = contact.companyName || 'la organización responsable del sistema'
  const supportEmail = contact.supportEmail

  return (
    <PublicPageLayout>
      <Button variant='outline' size='sm' asChild>
        <Link href='/login'>
          <ArrowLeft className='h-4 w-4 mr-2' />
          Volver al inicio de sesión
        </Link>
      </Button>

      <div className='bg-card border border-border rounded-2xl p-8 space-y-6'>
        <div className='flex items-center gap-3 pb-4 border-b border-border'>
          <Shield className='h-6 w-6 text-primary' />
          <h1 className='text-2xl font-semibold text-foreground'>Política de Privacidad</h1>
        </div>

        <div className='space-y-6 text-sm text-muted-foreground'>
          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              1. Identidad del Responsable del Tratamiento
            </h2>
            <p>
              <strong>Organización:</strong> {orgName}
            </p>
            {supportEmail && (
              <p>
                <strong>Email de contacto:</strong> {supportEmail}
              </p>
            )}
            <p>
              En cumplimiento con la{' '}
              <strong>Ley Orgánica de Protección de Datos Personales (LOPD) del Ecuador</strong>,
              somos responsables del tratamiento de sus datos personales en el uso de este sistema.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              2. Información que Recopilamos
            </h2>
            <p>Podemos tratar, según el módulo habilitado:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Datos de cuenta: nombre, correo, rol y preferencias de notificación</li>
              <li>Contenido operativo: tickets, comentarios y adjuntos que usted envíe</li>
              <li>Inventario/rondas/documentos: solo si su organización activa esos módulos</li>
              <li>Registros técnicos de seguridad y auditoría de acciones relevantes</li>
            </ul>
            <p>
              Aplicamos el principio de minimización: no pedimos ni mostramos más datos de los
              necesarios para la finalidad del servicio.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>3. Finalidades del Tratamiento</h2>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Autenticación, autorización y prestación del servicio solicitado</li>
              <li>Gestión de soporte, inventario, rondas u otros módulos contratados</li>
              <li>Notificaciones in-app y por correo según sus preferencias</li>
              <li>Seguridad, prevención de abuso y cumplimiento de obligaciones legales</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>4. Base Legítima</h2>
            <p>
              El tratamiento se fundamenta en la ejecución del servicio, el cumplimiento de
              obligaciones legales y, cuando corresponda, el consentimiento o el interés legítimo de
              la organización para la seguridad y continuidad operativa.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>5. Destinatarios y Acceso</h2>
            <p>
              El acceso a datos personales está restringido por rol y módulos habilitados.
              Administradores y personal técnico autorizados solo ven lo necesario para su función.
              Secretos de la bóveda de credenciales se almacenan cifrados.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>6. Derechos del Titular</h2>
            <p>De acuerdo con la LOPD ecuatoriana, usted tiene derecho a:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Acceso, rectificación, actualización y eliminación cuando proceda</li>
              <li>Oposición y limitación del tratamiento en los casos previstos</li>
              <li>Portabilidad cuando sea técnicamente aplicable</li>
            </ul>
            <p>
              Para ejercerlos, contacte al responsable mediante el correo de soporte configurado o
              un ticket interno, identificándose adecuadamente.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              7. Plazo de Conservación de Datos
            </h2>
            <p>
              Conservaremos sus datos personales durante el tiempo necesario para cumplir con los
              fines para los que se recopilaron y con las obligaciones legales aplicables en Ecuador.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              8. Transferencias Internacionales de Datos
            </h2>
            <p>
              No realizamos transferencias internacionales de datos personales fuera del Ecuador,
              excepto cuando sea necesario para la prestación del servicio y siempre que se
              garantice un nivel adecuado de protección de datos.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>9. Contacto</h2>
            <p>
              Si tiene preguntas sobre esta política o desea ejercer sus derechos, puede
              contactarnos a través de:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>El sistema de tickets de soporte</li>
              {supportEmail ? (
                <li>Email: {supportEmail}</li>
              ) : (
                <li>El correo de soporte publicado por su organización en el Centro de Ayuda</li>
              )}
            </ul>
            <p>
              También tiene derecho a presentar una queja ante la{' '}
              <strong>Autoridad de Protección de Datos Personales del Ecuador</strong> si considera
              que sus derechos han sido vulnerados.
            </p>
          </section>
        </div>

        <div className='pt-4 border-t border-border'>
          <p className='text-xs text-muted-foreground'>
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>
      </div>
    </PublicPageLayout>
  )
}

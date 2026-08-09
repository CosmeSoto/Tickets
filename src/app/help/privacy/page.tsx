'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicPageLayout } from '@/components/auth/auth-layout'
import { LegalDocumentBackButton } from '@/features/help/components/legal-document-back-button'
import { Shield } from 'lucide-react'

interface OrgContact {
  companyName?: string
  supportEmail?: string | null
}

/**
 * Política de Privacidad alineada a LOPD Ecuador y al uso real del sistema
 * (tickets, inventario, rondas, documentos, credenciales, auditoría, notificaciones).
 */
export default function PrivacyPage() {
  const [contact, setContact] = useState<OrgContact>({})

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
      <LegalDocumentBackButton />

      <div className='bg-card border border-border rounded-2xl p-8 space-y-6'>
        <div className='flex items-center gap-3 pb-4 border-b border-border'>
          <Shield className='h-6 w-6 text-primary' />
          <h1 className='text-2xl font-semibold text-foreground'>Política de Privacidad</h1>
        </div>

        <p className='text-xs text-muted-foreground'>
          Esta política describe el tratamiento de datos personales en el sistema de gestión de
          operaciones ({orgName}), de conformidad con la{' '}
          <strong className='text-foreground'>
            Ley Orgánica de Protección de Datos Personales (LOPD) de la República del Ecuador
          </strong>{' '}
          y su normativa aplicable.
        </p>

        <div className='space-y-6 text-sm text-muted-foreground'>
          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              1. Responsable del tratamiento
            </h2>
            <p>
              <strong className='text-foreground'>Organización:</strong> {orgName}
            </p>
            {supportEmail && (
              <p>
                <strong className='text-foreground'>Canal de contacto (privacidad/soporte):</strong>{' '}
                {supportEmail}
              </p>
            )}
            <p>
              El responsable determina las finalidades y medios del tratamiento de los datos
              personales tratados a través de esta plataforma.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              2. Datos personales que tratamos
            </h2>
            <p>
              Aplicamos <strong className='text-foreground'>minimización</strong>: solo lo necesario
              según módulos habilitados y el rol del usuario. En general:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>
                <strong className='text-foreground'>Cuenta:</strong> nombre, correo electrónico, rol,
                familia/área, preferencias de notificación y datos de autenticación.
              </li>
              <li>
                <strong className='text-foreground'>Tickets / soporte:</strong> títulos, descripciones,
                categorías, comentarios y archivos que usted o el personal carguen.
              </li>
              <li>
                <strong className='text-foreground'>Inventario:</strong> datos de activos asignados,
                mantenimientos, actas, contratos/proveedores vinculados a la operación (según
                permisos).
              </li>
              <li>
                <strong className='text-foreground'>Rondas:</strong> agenda, checkpoints e incidentes
                reportados.
              </li>
              <li>
                <strong className='text-foreground'>Documentos / formularios y noticias:</strong>{' '}
                contenidos y respuestas asociados a su área, si el módulo está activo.
              </li>
              <li>
                <strong className='text-foreground'>Credenciales:</strong> metadatos de entradas; los
                secretos se almacenan cifrados y el acceso está restringido y auditado.
              </li>
              <li>
                <strong className='text-foreground'>Seguridad y auditoría:</strong> registros de
                acciones relevantes (quién, cuándo, qué recurso) para trazabilidad y prevención de
                abuso.
              </li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>3. Finalidades</h2>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Autenticar usuarios y aplicar control de acceso por rol y módulo</li>
              <li>Prestar soporte, inventario, rondas y demás funcionalidades contratadas</li>
              <li>Enviar notificaciones in-app y por correo según preferencias configuradas</li>
              <li>Mantener seguridad, continuidad operativa y cumplimiento de obligaciones legales</li>
              <li>Atender solicitudes de derechos ARCO y comunicaciones de soporte</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>4. Base de legitimación</h2>
            <p>El tratamiento se sustenta, según el caso, en:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Ejecución de la relación laboral/contractual o prestación del servicio</li>
              <li>Cumplimiento de obligaciones legales aplicables en Ecuador</li>
              <li>
                Interés legítimo del responsable en seguridad, auditoría y continuidad del servicio,
                respetando derechos de los titulares
              </li>
              <li>Consentimiento, cuando la normativa lo exija para un tratamiento concreto</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              5. Destinatarios y acceso interno
            </h2>
            <p>
              No vendemos datos personales. El acceso interno está limitado por rol (cliente,
              técnico, administrador) y por módulos/familias habilitados. Personal autorizado solo
              ve lo necesario para su función. Proveedores tecnológicos (p. ej. correo o
              infraestructura) pueden tratar datos como encargados, bajo instrucciones y medidas de
              seguridad adecuadas.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>6. Derechos del titular</h2>
            <p>
              Conforme a la LOPD, usted puede solicitar acceso, rectificación, actualización,
              eliminación, oposición, suspensión y portabilidad cuando proceda, así como no ser
              objeto de decisiones basadas únicamente en valoraciones automatizadas en los términos
              de la ley.
            </p>
            <p>
              Para ejercerlos, contacte al responsable por el correo de soporte configurado o
              mediante un ticket interno, acreditando su identidad. También puede presentar una
              reclamación ante la{' '}
              <strong className='text-foreground'>
                Autoridad de Protección de Datos Personales del Ecuador
              </strong>
              .
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>7. Conservación</h2>
            <p>
              Conservamos los datos el tiempo necesario para las finalidades descritas, plazos de
              auditoría/seguridad y obligaciones legales o contractuales. Luego se eliminan o
              anonimizan cuando corresponda.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              8. Transferencias internacionales
            </h2>
            <p>
              Preferimos el tratamiento en entornos bajo control de la organización. Si un servicio
              implica transferencia fuera del Ecuador, se adoptarán salvaguardas adecuadas conforme
              a la LOPD.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>9. Medidas de seguridad</h2>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Control de acceso por rol y módulos</li>
              <li>Cifrado de secretos en la bóveda de credenciales</li>
              <li>Auditoría de acciones sensibles</li>
              <li>Sesiones autenticadas y buenas prácticas de contraseña/recuperación</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>10. Contacto</h2>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>
                <Link href='/help/center' className='underline underline-offset-2'>
                  Centro de Ayuda
                </Link>{' '}
                / tickets de soporte
              </li>
              {supportEmail ? <li>Email: {supportEmail}</li> : null}
            </ul>
          </section>
        </div>

        <div className='pt-4 border-t border-border flex flex-wrap gap-3 items-center justify-between'>
          <p className='text-xs text-muted-foreground'>
            Última actualización: {new Date().toLocaleDateString('es-EC')}
          </p>
          <Button variant='link' size='sm' className='h-auto p-0' asChild>
            <Link href='/help/terms'>Ver Términos y Condiciones</Link>
          </Button>
        </div>
      </div>
    </PublicPageLayout>
  )
}

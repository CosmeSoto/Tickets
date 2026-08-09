'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicPageLayout } from '@/components/auth/auth-layout'
import { LegalDocumentBackButton } from '@/features/help/components/legal-document-back-button'
import { FileText } from 'lucide-react'

interface OrgContact {
  companyName?: string
  supportEmail?: string | null
}

/**
 * Términos de uso alineados al sistema real (multi-módulo) y marco legal ecuatoriano.
 */
export default function TermsPage() {
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

  const orgName = contact.companyName || 'la organización responsable'
  const supportEmail = contact.supportEmail

  return (
    <PublicPageLayout>
      <LegalDocumentBackButton guestHref='/login' guestLabel='Volver al inicio de sesión' />

      <div className='bg-card border border-border rounded-2xl p-8 space-y-6'>
        <div className='flex items-center gap-3 pb-4 border-b border-border'>
          <FileText className='h-6 w-6 text-primary' />
          <h1 className='text-2xl font-semibold text-foreground'>Términos y Condiciones de Uso</h1>
        </div>

        <p className='text-xs text-muted-foreground'>
          Estos términos regulan el uso del sistema de gestión de operaciones de{' '}
          <strong className='text-foreground'>{orgName}</strong>. El tratamiento de datos personales
          se detalla en la{' '}
          <Link href='/help/privacy' className='underline underline-offset-2'>
            Política de Privacidad
          </Link>
          , conforme a la LOPD del Ecuador.
        </p>

        <div className='space-y-6 text-sm text-muted-foreground'>
          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>1. Aceptación</h2>
            <p>
              Al acceder o utilizar la plataforma usted acepta estos términos y las políticas
              internas que la organización publique en el sistema. Si no está de acuerdo, no debe
              usar el servicio.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>2. Descripción del servicio</h2>
            <p>
              La plataforma permite, según módulos habilitados por la organización y permisos de su
              usuario:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Gestión de tickets / soporte técnico</li>
              <li>Inventario de activos, mantenimientos, contratos, proveedores y actas</li>
              <li>Rondas, checkpoints e incidentes</li>
              <li>Base de conocimientos, documentos/formularios y noticias</li>
              <li>Bóveda de credenciales (acceso restringido y auditado)</li>
              <li>Centro de ayuda, notificaciones y herramientas de administración/auditoría</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>3. Cuentas y acceso</h2>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>El acceso es personal e intransferible según el rol asignado</li>
              <li>Debe mantener la confidencialidad de sus credenciales</li>
              <li>Notifique de inmediato cualquier uso no autorizado de su cuenta</li>
              <li>
                La organización puede habilitar o restringir módulos y familias/áreas según política
                interna
              </li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>4. Uso aceptable</h2>
            <p>Usted se compromete a:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Proporcionar información veraz y actualizada</li>
              <li>Usar el sistema solo para fines operativos autorizados</li>
              <li>No intentar acceder a datos o funciones fuera de su permiso</li>
              <li>No sobrecargar, alterar ni comprometer la seguridad del sistema</li>
              <li>
                Respetar la minimización de datos personales al crear tickets, comentarios o
                adjuntos
              </li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>5. Contenido del usuario</h2>
            <p>
              Usted es responsable del contenido que ingresa (tickets, adjuntos, formularios,
              incidentes, etc.). La organización puede revisar, moderar o eliminar contenido que
              vulnere la ley, la seguridad o estos términos.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>6. Propiedad intelectual</h2>
            <p>
              El software, diseño, marcas y documentación del sistema son propiedad de {orgName} o
              de sus licenciantes, protegidos por la legislación ecuatoriana aplicable. No está
              permitida la reproducción o explotación no autorizada.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              7. Disponibilidad y limitación de responsabilidad
            </h2>
            <p>
              El servicio se ofrece según disponibilidad operativa. En la medida permitida por la
              ley ecuatoriana, {orgName} no garantiza disponibilidad ininterrumpida ni se hace
              responsable de daños indirectos derivados del uso, salvo dolo o negligencia grave.
              Nada en estos términos limita derechos irrenunciables del consumidor o trabajador
              cuando apliquen.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>8. Suspensión</h2>
            <p>
              La organización puede suspender o restringir el acceso ante incumplimiento de estos
              términos, uso fraudulento, riesgo de seguridad o requerimiento de autoridad
              competente.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>9. Modificaciones</h2>
            <p>
              Estos términos pueden actualizarse. Los cambios relevantes se publicarán en el sistema
              o se comunicarán por los canales habituales. El uso continuado tras la publicación
              implica aceptación de la versión vigente.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              10. Ley aplicable y jurisdicción
            </h2>
            <p>
              Estos términos se rigen por las leyes de la República del Ecuador. Cualquier
              controversia se someterá a los tribunales competentes del Ecuador, sin perjuicio de
              fueros especiales que la ley reserve.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>11. Contacto</h2>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>
                <Link href='/help/center' className='underline underline-offset-2'>
                  Centro de Ayuda
                </Link>
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
            <Link href='/help/privacy'>Ver Política de Privacidad</Link>
          </Button>
        </div>
      </div>
    </PublicPageLayout>
  )
}

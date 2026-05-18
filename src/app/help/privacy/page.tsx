'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicPageLayout } from '@/components/auth/auth-layout'
import { ArrowLeft, Shield } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <PublicPageLayout>
      <Button variant='outline' size='sm' asChild>
        <Link href='/register'>
          <ArrowLeft className='h-4 w-4 mr-2' />
          Volver al Registro
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
              <strong>Nombre de la Empresa:</strong> [Nombre del Centro Comercial]
            </p>
            <p>
              <strong>RUC:</strong> [Número de RUC]
            </p>
            <p>
              <strong>Dirección:</strong> [Dirección completa del centro comercial]
            </p>
            <p>
              <strong>Email de contacto:</strong> [correo@empresa.com]
            </p>
            <p>
              En cumplimiento con la{' '}
              <strong>Ley Orgánica de Protección de Datos Personales (LOPD) del Ecuador</strong>,
              somos responsables del tratamiento de sus datos personales.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              2. Información que Recopilamos
            </h2>
            <p>Recopilamos información que usted nos proporciona directamente, como:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Nombre completo, cédula de identidad o pasaporte</li>
              <li>Información de contacto (email, teléfono, dirección)</li>
              <li>Credenciales de acceso (email y contraseña encriptada)</li>
              <li>
                Información relacionada con tickets de soporte técnico y mantenimiento del centro
                comercial
              </li>
              <li>Datos de uso del sistema para mejorar el servicio</li>
              <li>Información de visitas al centro comercial (si aplica)</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              3. Finalidad del Tratamiento de Datos
            </h2>
            <p>Utilizamos su información personal para:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Gestionar y dar seguimiento a tickets de soporte técnico y mantenimiento</li>
              <li>
                Proporcionar y mantener nuestro servicio de gestión de operaciones del centro
                comercial
              </li>
              <li>
                Comunicarnos con usted sobre el servicio, notificaciones y actualizaciones
                importantes
              </li>
              <li>Mejorar y personalizar su experiencia en el sistema y en el centro comercial</li>
              <li>Cumplir con obligaciones legales, tributarias y regulatorias en Ecuador</li>
              <li>
                Garantizar la seguridad de las instalaciones y las personas en el centro comercial
              </li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>4. Compartir Información</h2>
            <p>No vendemos ni transferimos su información personal a terceros, excepto:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>
                Con proveedores de servicios que nos ayudan a operar (ej: hosting, servicios de
                pago), siempre sujetos a contratos de confidencialidad
              </li>
              <li>Con autoridades competentes del Ecuador, cuando exista una obligación legal</li>
              <li>Con su consentimiento explícito previo</li>
              <li>
                Para proteger nuestros derechos, propiedad o seguridad, y la de los usuarios del
                centro comercial
              </li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>5. Seguridad de los Datos</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger
              su información personal contra:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Acceso no autorizado</li>
              <li>Divulgación indebida</li>
              <li>Alteración o destrucción</li>
            </ul>
            <p>
              Entre estas medidas se incluyen el cifrado de datos, controles de acceso y auditorías
              periódicas de seguridad.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              6. Sus Derechos como Titular de Datos
            </h2>
            <p>De acuerdo con la LOPD ecuatoriana, usted tiene derecho a:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>
                <strong>Acceder:</strong> Obtener información sobre el tratamiento de sus datos
                personales
              </li>
              <li>
                <strong>Rectificar:</strong> Corregir información inexacta o incompleta
              </li>
              <li>
                <strong>Cancelar:</strong> Solicitar la eliminación de sus datos cuando no sean
                necesarios para los fines para los que se recopilaron
              </li>
              <li>
                <strong>Oponerse:</strong> Objecionar al tratamiento de sus datos por motivos
                legítimos
              </li>
              <li>
                <strong>Portabilidad:</strong> Recibir sus datos en un formato estructurado y de uso
                común
              </li>
              <li>
                <strong>Revocar consentimiento:</strong> Anular el consentimiento otorgado para el
                tratamiento de sus datos
              </li>
            </ul>
            <p>
              Para ejercer estos derechos, puede contactarnos a través del sistema de tickets o al
              email: [correo@empresa.com]. Responderemos a su solicitud dentro de los plazos
              establecidos por la ley.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              7. Plazo de Conservación de Datos
            </h2>
            <p>
              Conservaremos sus datos personales durante el tiempo necesario para cumplir con los
              fines para los que se recopilaron y para cumplir con las obligaciones legales
              aplicables en Ecuador.
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
              Si tiene preguntas sobre esta política de privacidad o desea ejercer sus derechos,
              puede contactarnos a través de:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>El sistema de tickets de soporte</li>
              <li>Email: [correo@empresa.com]</li>
              <li>Dirección: [Dirección del centro comercial]</li>
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

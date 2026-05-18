'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicPageLayout } from '@/components/auth/auth-layout'
import { ArrowLeft, FileText } from 'lucide-react'

export default function TermsPage() {
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
          <FileText className='h-6 w-6 text-primary' />
          <h1 className='text-2xl font-semibold text-foreground'>Términos y Condiciones de Uso</h1>
        </div>

        <div className='space-y-6 text-sm text-muted-foreground'>
          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              1. Aceptación de los Términos
            </h2>
            <p>
              Al acceder y utilizar este sistema de gestión de operaciones del centro comercial
              [Nombre del Centro Comercial], usted acepta estar sujeto a estos términos y
              condiciones, así como a todas las leyes y regulaciones aplicables del Ecuador.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>2. Descripción del Servicio</h2>
            <p>
              Este sistema está diseñado para la gestión integral de operaciones del centro
              comercial, incluyendo:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Gestión de tickets de soporte técnico y mantenimiento</li>
              <li>Control de inventario de activos</li>
              <li>Gestión de rondas de seguridad</li>
              <li>Otras funcionalidades relacionadas con la operación del centro comercial</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>3. Uso del Servicio</h2>
            <p>Los usuarios se comprometen a:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Proporcionar información precisa, veraz y actualizada</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso</li>
              <li>Utilizar el sistema de manera responsable, ética y conforme a su finalidad</li>
              <li>No intentar acceder a información o funcionalidades no autorizadas</li>
              <li>
                No realizar actividades que puedan dañar, sobrecargar o impair el funcionamiento del
                sistema
              </li>
              <li>Cumplir con las políticas y reglamentos internos del centro comercial</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              4. Responsabilidades del Usuario
            </h2>
            <p>Los usuarios son responsables de:</p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Mantener la seguridad de su cuenta y credenciales de acceso</li>
              <li>Todas las actividades que ocurran bajo su cuenta</li>
              <li>Notificar inmediatamente cualquier uso no autorizado de su cuenta</li>
              <li>El uso adecuado de los recursos del centro comercial y del sistema</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>5. Propiedad Intelectual</h2>
            <p>
              Todo el contenido del sistema, incluyendo pero no limitado a software, diseño,
              logotipos, textos y gráficos, es propiedad exclusiva de [Nombre del Centro Comercial]
              y está protegido por las leyes de propiedad intelectual del Ecuador y tratados
              internacionales.
            </p>
            <p>
              No está permitida la reproducción, distribución, modificación o uso de estos elementos
              sin el consentimiento expreso y por escrito de la empresa.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              6. Limitación de Responsabilidad
            </h2>
            <p>
              El servicio se proporciona &quot;tal como está&quot; y &quot; según
              disponibilidad&quot;. En la máxima medida permitida por la ley ecuatoriana:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>No garantizamos que el servicio esté libre de interrupciones o errores</li>
              <li>No nos hacemos responsables de daños indirectos, incidentales o consecuentes</li>
              <li>
                Nuestra responsabilidad total se limita al monto pagado por el servicio en los
                últimos 12 meses (si aplica)
              </li>
            </ul>
            <p>Esta limitación no aplica en casos de dolo o negligencia grave.</p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>7. Suspensión y Terminación</h2>
            <p>
              Nos reservamos el derecho de suspender o terminar su acceso al sistema en cualquier
              momento y sin previo aviso, en caso de:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>Violación de estos términos y condiciones</li>
              <li>Uso no autorizado o fraudulento del sistema</li>
              <li>
                Conducta que ponga en riesgo la seguridad del centro comercial, del sistema o de
                otros usuarios
              </li>
              <li>Solicitud de las autoridades competentes</li>
            </ul>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>8. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos términos y condiciones en cualquier
              momento. Los cambios entrarán en vigor inmediatamente después de su publicación en el
              sistema.
            </p>
            <p>
              Le notificaremos sobre cambios importantes a través del sistema o por email. Su uso
              continuado del servicio después de la publicación de los cambios constituye su
              aceptación de los mismos.
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>
              9. Ley Aplicable y Jurisdicción
            </h2>
            <p>Estos términos y condiciones se rigen por las leyes de la República del Ecuador.</p>
            <p>
              Para cualquier controversia derivada de estos términos, las partes se someten a la
              jurisdicción de los tribunales de [Ciudad, Ecuador].
            </p>
          </section>

          <section className='space-y-2'>
            <h2 className='text-base font-semibold text-foreground'>10. Contacto</h2>
            <p>
              Si tiene preguntas sobre estos términos y condiciones, puede contactarnos a través de:
            </p>
            <ul className='list-disc list-inside space-y-1 ml-2'>
              <li>El sistema de tickets de soporte</li>
              <li>Email: [correo@empresa.com]</li>
              <li>Dirección: [Dirección del centro comercial]</li>
            </ul>
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

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicPageLayout } from '@/components/auth/auth-layout'
import { ArrowLeft, FileText } from 'lucide-react'

export default function TermsPage() {
  return (
    <PublicPageLayout>
      <Button variant="outline" size="sm" asChild>
        <Link href="/register">
          <ArrowLeft className="h-4 w-4 mr-2" />Volver al Registro
        </Link>
      </Button>

      <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Términos de Servicio</h1>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Aceptación de los Términos</h2>
            <p>Al acceder y utilizar este sistema de tickets, usted acepta estar sujeto a estos términos de servicio y todas las leyes y regulaciones aplicables.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Uso del Servicio</h2>
            <p>Este sistema está diseñado para la gestión de tickets de soporte técnico. Los usuarios se comprometen a:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Proporcionar información precisa y actualizada</li>
              <li>Mantener la confidencialidad de sus credenciales de acceso</li>
              <li>Utilizar el sistema de manera responsable y ética</li>
              <li>No intentar acceder a información no autorizada</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Responsabilidades del Usuario</h2>
            <p>Los usuarios son responsables de mantener la seguridad de su cuenta y de todas las actividades que ocurran bajo su cuenta.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Limitación de Responsabilidad</h2>
            <p>El servicio se proporciona "tal como está" sin garantías de ningún tipo. No nos hacemos responsables de daños directos, indirectos, incidentales o consecuentes.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Modificaciones</h2>
            <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Contacto</h2>
            <p>Si tiene preguntas sobre estos términos, puede contactarnos a través del sistema de tickets.</p>
          </section>
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>
      </div>
    </PublicPageLayout>
  )
}

'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicPageLayout } from '@/components/auth/auth-layout'
import { ArrowLeft, Shield } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <PublicPageLayout>
      <Button variant="outline" size="sm" asChild>
        <Link href="/register">
          <ArrowLeft className="h-4 w-4 mr-2" />Volver al Registro
        </Link>
      </Button>

      <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Política de Privacidad</h1>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">1. Información que Recopilamos</h2>
            <p>Recopilamos información que usted nos proporciona directamente, como:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Nombre y información de contacto</li>
              <li>Credenciales de acceso (email y contraseña encriptada)</li>
              <li>Información de tickets y comunicaciones</li>
              <li>Datos de uso del sistema para mejorar el servicio</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">2. Cómo Utilizamos su Información</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Proporcionar y mantener nuestro servicio</li>
              <li>Procesar y responder a sus tickets de soporte</li>
              <li>Comunicarnos con usted sobre el servicio</li>
              <li>Mejorar y personalizar su experiencia</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">3. Compartir Información</h2>
            <p>No vendemos ni transferimos su información personal a terceros, excepto:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Con su consentimiento explícito</li>
              <li>Para cumplir con la ley o procesos legales</li>
              <li>Para proteger nuestros derechos y seguridad</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">4. Seguridad de los Datos</h2>
            <p>Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger su información personal contra acceso no autorizado.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">5. Sus Derechos</h2>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Acceder a su información personal</li>
              <li>Corregir información inexacta</li>
              <li>Solicitar la eliminación de su información</li>
              <li>Portabilidad de sus datos</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">6. Contacto</h2>
            <p>Si tiene preguntas sobre esta política, puede contactarnos a través del sistema de tickets.</p>
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

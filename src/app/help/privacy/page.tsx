'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <Button variant="outline" asChild>
            <Link href="/register">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al Registro
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              <Shield className="h-6 w-6 mr-3 text-green-600" />
              Política de Privacidad
            </CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-3">1. Información que Recopilamos</h3>
                <p className="text-muted-foreground">
                  Recopilamos información que usted nos proporciona directamente, como:
                </p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                  <li>Nombre y información de contacto</li>
                  <li>Credenciales de acceso (email y contraseña encriptada)</li>
                  <li>Información de tickets y comunicaciones</li>
                  <li>Datos de uso del sistema para mejorar el servicio</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">2. Cómo Utilizamos su Información</h3>
                <p className="text-muted-foreground">
                  Utilizamos la información recopilada para:
                </p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                  <li>Proporcionar y mantener nuestro servicio</li>
                  <li>Procesar y responder a sus tickets de soporte</li>
                  <li>Comunicarnos con usted sobre el servicio</li>
                  <li>Mejorar y personalizar su experiencia</li>
                  <li>Cumplir con obligaciones legales</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">3. Compartir Información</h3>
                <p className="text-muted-foreground">
                  No vendemos, intercambiamos ni transferimos su información personal a terceros, excepto:
                </p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                  <li>Con su consentimiento explícito</li>
                  <li>Para cumplir con la ley o procesos legales</li>
                  <li>Para proteger nuestros derechos y seguridad</li>
                  <li>Con proveedores de servicios que nos ayudan a operar el sistema</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">4. Seguridad de los Datos</h3>
                <p className="text-muted-foreground">
                  Implementamos medidas de seguridad técnicas y organizativas apropiadas para proteger su información personal contra acceso no autorizado, alteración, divulgación o destrucción.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">5. Sus Derechos</h3>
                <p className="text-muted-foreground">
                  Usted tiene derecho a:
                </p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                  <li>Acceder a su información personal</li>
                  <li>Corregir información inexacta</li>
                  <li>Solicitar la eliminación de su información</li>
                  <li>Oponerse al procesamiento de su información</li>
                  <li>Portabilidad de sus datos</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">6. Retención de Datos</h3>
                <p className="text-muted-foreground">
                  Conservamos su información personal solo durante el tiempo necesario para los fines descritos en esta política o según lo requiera la ley.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">7. Contacto</h3>
                <p className="text-muted-foreground">
                  Si tiene preguntas sobre esta política de privacidad o desea ejercer sus derechos, puede contactarnos a través del sistema de tickets.
                </p>
              </section>
            </div>

            <div className="mt-8 pt-6 border-t">
              <p className="text-sm text-muted-foreground">
                Última actualización: {new Date().toLocaleDateString('es-ES')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
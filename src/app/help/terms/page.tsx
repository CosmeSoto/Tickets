'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText } from 'lucide-react'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
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
              <FileText className="h-6 w-6 mr-3 text-blue-600" />
              Términos de Servicio
            </CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div className="space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-3">1. Aceptación de los Términos</h3>
                <p className="text-muted-foreground">
                  Al acceder y utilizar este sistema de tickets, usted acepta estar sujeto a estos términos de servicio y todas las leyes y regulaciones aplicables.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">2. Uso del Servicio</h3>
                <p className="text-muted-foreground">
                  Este sistema está diseñado para la gestión de tickets de soporte técnico. Los usuarios se comprometen a:
                </p>
                <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                  <li>Proporcionar información precisa y actualizada</li>
                  <li>Mantener la confidencialidad de sus credenciales de acceso</li>
                  <li>Utilizar el sistema de manera responsable y ética</li>
                  <li>No intentar acceder a información no autorizada</li>
                </ul>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">3. Responsabilidades del Usuario</h3>
                <p className="text-muted-foreground">
                  Los usuarios son responsables de mantener la seguridad de su cuenta y de todas las actividades que ocurran bajo su cuenta.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">4. Limitación de Responsabilidad</h3>
                <p className="text-muted-foreground">
                  El servicio se proporciona "tal como está" sin garantías de ningún tipo. No nos hacemos responsables de daños directos, indirectos, incidentales o consecuentes.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">5. Modificaciones</h3>
                <p className="text-muted-foreground">
                  Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación.
                </p>
              </section>

              <section>
                <h3 className="text-lg font-semibold mb-3">6. Contacto</h3>
                <p className="text-muted-foreground">
                  Si tiene preguntas sobre estos términos, puede contactarnos a través del sistema de tickets o por correo electrónico.
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
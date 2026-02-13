'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert, Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function UnauthorizedPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const getDashboardUrl = () => {
    if (!session) return '/login'
    
    switch (session.user.role) {
      case 'ADMIN':
        return '/admin'
      case 'TECHNICIAN':
        return '/technician'
      case 'CLIENT':
        return '/client'
      default:
        return '/'
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Acceso No Autorizado</CardTitle>
          <CardDescription>
            No tienes permisos para acceder a esta página
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Esta página está restringida a usuarios con permisos específicos.
            </p>
            {session && (
              <p className="mt-2">
                Tu rol actual es: <span className="font-semibold">{session.user.role}</span>
              </p>
            )}
          </div>

          <div className="flex flex-col space-y-2">
            <Button asChild className="w-full">
              <Link href={getDashboardUrl()}>
                <Home className="h-4 w-4 mr-2" />
                Ir al Dashboard
              </Link>
            </Button>
            
            <Button variant="outline" onClick={() => router.back()} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver Atrás
            </Button>
          </div>

          <div className="text-xs text-center text-muted-foreground pt-4 border-t">
            Si crees que esto es un error, contacta al administrador del sistema.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

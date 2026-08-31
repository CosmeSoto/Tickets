'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Home, RotateCw } from 'lucide-react'

/**
 * Boundary de error para todo el área autenticada — sin esto, cualquier
 * excepción de render en una página del dashboard (p. ej. un campo
 * inesperadamente null en datos reales) tumbaba toda la app con la pantalla
 * genérica de Next.js ("Application error: a client-side exception has
 * occurred"). Ahora se recupera in-place con "Reintentar" sin perder la
 * sesión ni tener que recargar todo, y deja algo reportable en consola.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[DashboardError]', error)
  }, [error])

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10'>
            <AlertTriangle className='h-8 w-8 text-destructive' />
          </div>
          <CardTitle className='text-2xl'>Ocurrió un error</CardTitle>
          <CardDescription>
            Algo falló al cargar esta página. Puedes intentar de nuevo o volver al inicio.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {error.digest && (
            <p className='text-center text-xs text-muted-foreground'>
              Código de referencia: <span className='font-mono'>{error.digest}</span>
            </p>
          )}
          <div className='flex flex-col space-y-2'>
            <Button className='w-full' onClick={reset}>
              <RotateCw className='mr-2 h-4 w-4' />
              Reintentar
            </Button>
            <Button variant='outline' className='w-full' onClick={() => router.push('/')}>
              <Home className='mr-2 h-4 w-4' />
              Ir al inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

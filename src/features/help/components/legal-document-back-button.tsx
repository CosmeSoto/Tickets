'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { roleHomeHref } from '@/components/layout/use-role-navigation'

/**
 * Navegación de documentos legales públicos.
 * Con sesión → vuelve al panel / Centro de Ayuda.
 * Sin sesión → login (o registro si se indica).
 */
export function LegalDocumentBackButton({
  guestHref = '/login',
  guestLabel = 'Volver al inicio de sesión',
}: {
  guestHref?: string
  guestLabel?: string
}) {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <Button variant='outline' size='sm' disabled>
        <ArrowLeft className='h-4 w-4 mr-2' />
        Cargando…
      </Button>
    )
  }

  if (status === 'authenticated' && session?.user?.role) {
    const home = roleHomeHref(session.user.role)
    return (
      <div className='flex flex-wrap gap-2'>
        <Button variant='outline' size='sm' asChild>
          <Link href={home}>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver al panel
          </Link>
        </Button>
        <Button variant='ghost' size='sm' asChild>
          <Link href='/help/center'>Centro de Ayuda</Link>
        </Button>
      </div>
    )
  }

  return (
    <Button variant='outline' size='sm' asChild>
      <Link href={guestHref}>
        <ArrowLeft className='h-4 w-4 mr-2' />
        {guestLabel}
      </Link>
    </Button>
  )
}

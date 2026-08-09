'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Compatibilidad: /client/help → hub general /help/center
 */
export default function ClientHelpRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/help/center')
  }, [router])

  return (
    <div className='flex items-center justify-center min-h-[40vh] text-muted-foreground gap-2 text-sm'>
      <Loader2 className='h-4 w-4 animate-spin' />
      Redirigiendo al Centro de Ayuda…
    </div>
  )
}

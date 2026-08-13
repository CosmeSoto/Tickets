'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wrench, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SystemLogo } from '@/components/common/system-logo'

export default function MaintenancePage() {
  const [message, setMessage] = useState(
    'El sistema está en mantenimiento programado. Vuelve a intentarlo más tarde.'
  )

  useEffect(() => {
    fetch('/api/config/maintenance', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.message) setMessage(data.message)
      })
      .catch(() => {})
  }, [])

  return (
    <div className='min-h-screen flex flex-col items-center justify-center px-4 bg-background'>
      <div className='max-w-md w-full space-y-8 text-center'>
        <div className='flex justify-center'>
          <SystemLogo size='lg' showText />
        </div>
        <div className='mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center'>
          <Wrench className='h-8 w-8 text-amber-600' />
        </div>
        <div className='space-y-3'>
          <h1 className='text-2xl font-bold text-foreground'>Sistema en mantenimiento</h1>
          <p className='text-muted-foreground text-sm leading-relaxed'>{message}</p>
        </div>
        <div className='flex flex-col sm:flex-row gap-3 justify-center'>
          <Button variant='outline' onClick={() => window.location.reload()}>
            Reintentar
          </Button>
          <Button asChild>
            <Link href='/login'>
              <LogIn className='h-4 w-4 mr-2' />
              Iniciar sesión (administradores)
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

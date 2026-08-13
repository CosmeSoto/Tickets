'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Wrench, LogIn, Loader2, LogOut, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SystemLogo } from '@/components/common/system-logo'

type MaintenanceConfig = {
  enabled: boolean
  message: string
  allowAdmins: boolean
}

function canBypassMaintenance(
  user: { role?: string; isSuperAdmin?: boolean } | undefined,
  allowAdmins: boolean
): boolean {
  if (!user || !allowAdmins) return false
  if (user.isSuperAdmin) return true
  return user.role === 'ADMIN'
}

function dashboardForRole(role?: string): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'TECHNICIAN') return '/technician'
  return '/client'
}

export default function MaintenancePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [config, setConfig] = useState<MaintenanceConfig | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    fetch('/api/config/maintenance', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) {
          setConfig({
            enabled: Boolean(data.enabled),
            message:
              data.message ||
              'El sistema está en mantenimiento programado. Vuelve a intentarlo más tarde.',
            allowAdmins: data.allowAdmins !== false,
          })
        } else {
          setConfig({
            enabled: true,
            message:
              'El sistema está en mantenimiento programado. Vuelve a intentarlo más tarde.',
            allowAdmins: true,
          })
        }
      })
      .catch(() => {
        setConfig({
          enabled: true,
          message:
            'El sistema está en mantenimiento programado. Vuelve a intentarlo más tarde.',
            allowAdmins: true,
        })
      })
  }, [])

  useEffect(() => {
    if (status === 'loading' || !config) return

    if (!config.enabled) {
      setRedirecting(true)
      const role = (session?.user as { role?: string } | undefined)?.role
      router.replace(session?.user ? dashboardForRole(role) : '/login')
      return
    }

    const user = session?.user as { role?: string; isSuperAdmin?: boolean; name?: string } | undefined
    if (canBypassMaintenance(user, config.allowAdmins)) {
      setRedirecting(true)
      router.replace('/admin')
    }
  }, [status, session, config, router])

  const isAuthenticated = status === 'authenticated' && !!session?.user
  const user = session?.user as { name?: string; role?: string } | undefined
  const message =
    config?.message ||
    'El sistema está en mantenimiento programado. Vuelve a intentarlo más tarde.'

  if (status === 'loading' || !config || redirecting) {
    return (
      <div className='min-h-screen flex flex-col items-center justify-center px-4 bg-background'>
        <Loader2 className='h-8 w-8 animate-spin text-primary' />
      </div>
    )
  }

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
          {isAuthenticated && (
            <p className='text-muted-foreground text-xs'>
              Sesión activa{user?.name ? ` como ${user.name}` : ''}.
              {config.allowAdmins
                ? ' Solo administradores pueden continuar usando el sistema.'
                : ' El acceso está restringido para todos los usuarios.'}
            </p>
          )}
        </div>
        <div className='flex flex-col sm:flex-row gap-3 justify-center'>
          <Button variant='outline' onClick={() => window.location.reload()}>
            Reintentar
          </Button>
          {isAuthenticated ? (
            <Button variant='outline' onClick={() => void signOut({ callbackUrl: '/maintenance' })}>
              <LogOut className='h-4 w-4 mr-2' />
              Cerrar sesión
            </Button>
          ) : (
            <Button asChild>
              <Link href='/login?callbackUrl=%2Fadmin'>
                <LogIn className='h-4 w-4 mr-2' />
                Iniciar sesión (administradores)
              </Link>
            </Button>
          )}
        </div>
        {isAuthenticated && config.allowAdmins && (
          <p className='text-xs text-muted-foreground'>
            Si eres administrador y no fuiste redirigido,{' '}
            <Link href='/admin' className='text-primary hover:underline inline-flex items-center gap-1'>
              continuar al panel
              <ArrowRight className='h-3 w-3' />
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

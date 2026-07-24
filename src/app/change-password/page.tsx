'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthLayout, AuthCard, AuthHeader } from '@/components/auth/auth-layout'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Eye, EyeOff, AlertCircle, Lock, Shield, CheckCircle } from 'lucide-react'

function ChangePasswordForm() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [minLength, setMinLength] = useState(8)

  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const mustChange = (session?.user as { mustChangePassword?: boolean } | undefined)
    ?.mustChangePassword

  useEffect(() => {
    fetch('/api/auth/password-policy')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.minLength && typeof d.minLength === 'number') setMinLength(d.minLength)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < minLength) {
      setError(`La nueva contraseña debe tener al menos ${minLength} caracteres`)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo cambiar la contraseña')
        return
      }

      // Limpiar flag en el JWT para salir del bucle de redirección del middleware
      await update({ mustChangePassword: false })

      setSuccess(true)
      toast({
        title: 'Contraseña actualizada',
        description: 'Ya puedes continuar usando el sistema.',
      })

      setTimeout(() => {
        const safeTarget =
          callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/'
        router.replace(safeTarget === '/change-password' ? '/' : safeTarget)
        router.refresh()
      }, 1200)
    } catch {
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <AuthLayout>
        <AuthCard>
          <div className='flex flex-col items-center py-8 gap-3'>
            <Loader2 className='h-10 w-10 animate-spin text-primary' />
            <p className='text-sm text-muted-foreground'>Cargando sesión...</p>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className='flex flex-col items-center gap-3 text-center py-4'>
            <div className='p-3 bg-green-500/10 rounded-full'>
              <CheckCircle className='h-10 w-10 text-green-600' />
            </div>
            <h2 className='text-lg font-semibold'>¡Contraseña actualizada!</h2>
            <p className='text-sm text-muted-foreground'>Redirigiendo...</p>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader
          title='Cambiar contraseña'
          description={
            mustChange
              ? 'Por política de seguridad debes actualizar tu contraseña para continuar.'
              : 'Ingresa tu contraseña actual y define una nueva.'
          }
        />

        {mustChange && (
          <Alert>
            <Shield className='h-4 w-4' />
            <AlertDescription>
              No podrás acceder al resto del sistema hasta completar este cambio.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant='destructive'>
            <AlertCircle className='h-4 w-4' />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='currentPassword'>Contraseña actual</Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                id='currentPassword'
                type={showCurrent ? 'text' : 'password'}
                className='pl-9 pr-10'
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                autoComplete='current-password'
              />
              <button
                type='button'
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground'
                onClick={() => setShowCurrent(v => !v)}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='newPassword'>Nueva contraseña</Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                id='newPassword'
                type={showNew ? 'text' : 'password'}
                className='pl-9 pr-10'
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={minLength}
                autoComplete='new-password'
              />
              <button
                type='button'
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground'
                onClick={() => setShowNew(v => !v)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
            <p className='text-xs text-muted-foreground'>Mínimo {minLength} caracteres</p>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='confirmPassword'>Confirmar nueva contraseña</Label>
            <div className='relative'>
              <Lock className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
              <Input
                id='confirmPassword'
                type={showConfirm ? 'text' : 'password'}
                className='pl-9 pr-10'
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete='new-password'
              />
              <button
                type='button'
                className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground'
                onClick={() => setShowConfirm(v => !v)}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
          </div>

          <Button type='submit' className='w-full' disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Guardando...
              </>
            ) : (
              'Actualizar contraseña'
            )}
          </Button>

          <Button
            type='button'
            variant='ghost'
            className='w-full'
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Cerrar sesión
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  )
}

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <AuthCard>
            <div className='flex flex-col items-center py-8 gap-3'>
              <Loader2 className='h-10 w-10 animate-spin text-primary' />
            </div>
          </AuthCard>
        </AuthLayout>
      }
    >
      <ChangePasswordForm />
    </Suspense>
  )
}

'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AuthLayout,
  AuthCard,
  AuthHeader,
  AuthStep,
  AuthAlertMotion,
  AuthPressable,
} from '@/components/auth/auth-layout'
import { DepartmentSelector } from '@/components/ui/department-selector'
import { useToast } from '@/hooks/use-toast'
import { validatePhoneInput } from '@/lib/auth/profile-completion'
import { Loader2, AlertCircle, Building2, CheckCircle, Phone, Send } from 'lucide-react'

function CompleteProfileForm() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const reduceMotion = useReducedMotion()

  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [departments, setDepartments] = useState<
    Array<{
      id: string
      name: string
      color: string
      isActive: boolean
      familyId?: string
      family?: { id: string; name: string; code: string; color?: string | null }
    }>
  >([])
  const [loadingDepts, setLoadingDepts] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const callbackUrl = searchParams.get('callbackUrl') || '/client'
  const needsProfile = (session?.user as { needsProfileCompletion?: boolean } | undefined)
    ?.needsProfileCompletion

  useEffect(() => {
    fetch('/api/departments?public=true')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.departments) setDepartments(d.departments)
      })
      .catch(() => {})
      .finally(() => setLoadingDepts(false))
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user?.departmentId) {
      setDepartmentId(prev => prev ?? session.user.departmentId ?? null)
    }
    if (session?.user?.phone) {
      setPhone(prev => prev || session.user.phone || '')
    }
  }, [session?.user?.departmentId, session?.user?.phone])

  useEffect(() => {
    if (
      status === 'authenticated' &&
      needsProfile === false &&
      session?.user?.departmentId &&
      session?.user?.phone
    ) {
      const safeTarget =
        callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/client'
      router.replace(safeTarget === '/complete-profile' ? '/client' : safeTarget)
    }
  }, [status, needsProfile, session?.user?.departmentId, session?.user?.phone, callbackUrl, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPhoneError(undefined)

    if (!departmentId) {
      setError('Debes seleccionar un departamento')
      return
    }

    const phoneValidationError = validatePhoneInput(phone)
    if (phoneValidationError) {
      setPhoneError(phoneValidationError)
      setError(phoneValidationError)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/user/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, phone: phone.trim() }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'No se pudo completar el perfil')
        return
      }

      await update({
        needsProfileCompletion: false,
        departmentId: data.department?.id ?? departmentId,
        department: data.department?.name,
        phone: data.phone ?? phone.trim(),
      })

      setSuccess(true)
      toast({
        title: 'Perfil completado',
        description: 'Tu departamento y teléfono fueron registrados correctamente.',
      })

      setTimeout(() => {
        const safeTarget =
          callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/client'
        router.replace(safeTarget === '/complete-profile' ? '/client' : safeTarget)
        router.refresh()
      }, 1200)
    } catch {
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  const viewKey = status === 'loading' ? 'loading' : success ? 'success' : 'form'

  return (
    <AuthLayout>
      <AuthCard>
        <AuthStep stepKey={viewKey}>
          {status === 'loading' && (
            <div className='flex flex-col items-center py-8 gap-3'>
              <Loader2 className='h-10 w-10 animate-spin text-primary' />
              <p className='text-sm text-muted-foreground'>Cargando sesión...</p>
            </div>
          )}

          {success && (
            <div className='flex flex-col items-center gap-4 py-4 text-center'>
              <motion.div
                className='p-4 bg-green-500/10 rounded-full'
                initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <CheckCircle className='h-12 w-12 text-green-600' />
              </motion.div>
              <p className='text-sm text-muted-foreground'>Redirigiendo al sistema...</p>
            </div>
          )}

          {status === 'authenticated' && !success && (
            <div className='space-y-6'>
              <AuthHeader
                title='Completa tu perfil'
                description='Indica tu departamento y teléfono celular para continuar'
              />

              <AuthAlertMotion show={!!error} alertKey={error ?? undefined}>
                <Alert variant='destructive'>
                  <AlertCircle className='h-4 w-4' />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </AuthAlertMotion>

              <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='space-y-1.5'>
                  <Label htmlFor='department'>
                    Departamento <span className='text-destructive'>*</span>
                  </Label>
                  <DepartmentSelector
                    value={departmentId}
                    onChange={setDepartmentId}
                    departments={departments}
                    disabled={isLoading || loadingDepts}
                    error={error && !departmentId ? error : undefined}
                    placeholder='Buscar departamento...'
                  />
                  <p className='text-xs text-muted-foreground flex items-center gap-1.5'>
                    <Building2 className='h-3.5 w-3.5 shrink-0' />
                    Necesario para crear tickets y recibir soporte de tu área.
                  </p>
                </div>

                <div className='space-y-1.5'>
                  <Label htmlFor='phone'>
                    Teléfono celular <span className='text-destructive'>*</span>
                  </Label>
                  <div className='relative'>
                    <Phone className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                    <Input
                      id='phone'
                      type='tel'
                      value={phone}
                      onChange={e => {
                        setPhone(e.target.value)
                        if (phoneError) setPhoneError(undefined)
                        setError(null)
                      }}
                      placeholder='+593 99 999 9999'
                      disabled={isLoading}
                      className='pl-9 h-11'
                    />
                  </div>
                  <p className='text-xs text-muted-foreground flex items-center gap-1.5'>
                    <Send className='h-3.5 w-3.5 shrink-0' />
                    Se usará para vincular alertas por Telegram en Configuración → Notificaciones.
                  </p>
                  {phoneError && (
                    <p className='text-xs text-destructive flex items-center gap-1'>
                      <AlertCircle className='h-3 w-3' />
                      {phoneError}
                    </p>
                  )}
                </div>

                <AuthPressable disabled={isLoading}>
                  <Button
                    type='submit'
                    className='w-full h-11'
                    disabled={isLoading || loadingDepts}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Guardando...
                      </>
                    ) : (
                      'Continuar'
                    )}
                  </Button>
                </AuthPressable>
              </form>
            </div>
          )}
        </AuthStep>
      </AuthCard>
    </AuthLayout>
  )
}

export default function CompleteProfilePage() {
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
      <CompleteProfileForm />
    </Suspense>
  )
}

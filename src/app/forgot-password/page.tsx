'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthLayout, AuthCard, AuthHeader } from '@/components/auth/auth-layout'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2, Mail, ArrowLeft, CheckCircle, AlertCircle, Shield,
} from 'lucide-react'

type Step = 'email' | 'sent' | 'oauth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<Step>('email')
  const [oauthProvider, setOauthProvider] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const check = await fetch('/api/auth/check-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const checkData = await check.json()
      if (checkData.hasOAuth) {
        setOauthProvider(checkData.provider)
        setStep('oauth')
        return
      }

      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setStep('sent')
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.message || 'No se pudo enviar el email', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const titles: Record<Step, string> = {
    email: '¿Olvidaste tu contraseña?',
    sent: 'Email enviado',
    oauth: 'Cuenta con OAuth',
  }
  const descriptions: Record<Step, string> = {
    email: 'Te ayudaremos a recuperar el acceso a tu cuenta',
    sent: 'Revisa tu bandeja de entrada',
    oauth: 'Tu cuenta está vinculada con un proveedor externo',
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader title={titles[step]} description={descriptions[step]} />

        {step === 'email' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email de tu cuenta</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="tu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required disabled={isLoading} className="pl-9 h-11" />
              </div>
              <p className="text-xs text-muted-foreground">
                Te enviaremos un link para restablecer tu contraseña
              </p>
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading || !email.trim()}>
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verificando...</>
                : <><Mail className="mr-2 h-4 w-4" />Enviar link de recuperación</>
              }
            </Button>

            {/* OAuth alternativo */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-muted-foreground">¿Tienes cuenta OAuth?</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="h-10"
                onClick={() => signIn('google', { callbackUrl: '/client' })} disabled={isLoading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </Button>
              <Button type="button" variant="outline" className="h-10"
                onClick={() => signIn('azure-ad', { callbackUrl: '/client' })} disabled={isLoading}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23">
                  <path fill="#f3f3f3" d="M0 0h23v23H0z"/><path fill="#f35325" d="M1 1h10v10H1z"/>
                  <path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/>
                  <path fill="#ffba08" d="M12 12h10v10H12z"/>
                </svg>
                Microsoft
              </Button>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-sm">
                ¿Necesitas ayuda? Contacta a un administrador del sistema.
              </AlertDescription>
            </Alert>
          </form>
        )}

        {step === 'sent' && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="p-4 bg-green-500/10 rounded-full">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Hemos enviado un email a:</p>
              <p className="font-medium text-foreground">{email}</p>
              <p className="text-xs text-muted-foreground">El link expira en 1 hora</p>
            </div>
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Revisa también tu carpeta de spam si no recibes el email.
              </AlertDescription>
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => setStep('email')}>
              Enviar otro email
            </Button>
          </div>
        )}

        {step === 'oauth' && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Tu cuenta está vinculada con{' '}
                <strong>{oauthProvider === 'google' ? 'Google' : 'Microsoft'}</strong>.
                Inicia sesión con ese proveedor.
              </AlertDescription>
            </Alert>
            <Button className="w-full h-11"
              onClick={() => signIn(oauthProvider!, { callbackUrl: '/client' })}>
              Iniciar sesión con {oauthProvider === 'google' ? 'Google' : 'Microsoft'}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setStep('email')}>
              <ArrowLeft className="mr-2 h-4 w-4" />Volver
            </Button>
          </div>
        )}

        <div className="text-center">
          <Link href="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />Volver al inicio de sesión
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}

'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Loader2, 
  Mail, 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Key,
  Shield
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [step, setStep] = useState<'email' | 'sent' | 'oauth'>('email')
  const [hasOAuth, setHasOAuth] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Verificar si el usuario tiene OAuth configurado
      const checkResponse = await fetch('/api/auth/check-oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const checkData = await checkResponse.json()

      if (checkData.hasOAuth) {
        // Usuario tiene OAuth, mostrar opción de login con OAuth
        setHasOAuth(true)
        setOauthProvider(checkData.provider)
        setStep('oauth')
        setIsLoading(false)
        return
      }

      // Enviar email de recuperación
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setStep('sent')
        toast({
          title: 'Email enviado',
          description: 'Revisa tu bandeja de entrada para restablecer tu contraseña',
        })
      } else {
        toast({
          title: 'Error',
          description: data.message || 'No se pudo enviar el email de recuperación',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al procesar tu solicitud',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    signIn(provider, { callbackUrl: '/client' })
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <Card className='w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm'>
        <CardHeader className='space-y-1 pb-8'>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Key className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className='text-2xl font-bold text-center text-foreground'>
            {step === 'email' && '¿Olvidaste tu contraseña?'}
            {step === 'sent' && 'Email Enviado'}
            {step === 'oauth' && 'Cuenta con OAuth'}
          </CardTitle>
          <CardDescription className='text-center text-muted-foreground'>
            {step === 'email' && 'Te ayudaremos a recuperar el acceso a tu cuenta'}
            {step === 'sent' && 'Revisa tu bandeja de entrada'}
            {step === 'oauth' && 'Tu cuenta está vinculada con OAuth'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-8">
          {step === 'email' && (
            <form onSubmit={handleSubmit} className='space-y-6'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='email' className="text-foreground font-medium">
                    Email de tu cuenta
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id='email'
                      type='email'
                      placeholder='tu@email.com'
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-10 h-12 border-border focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Te enviaremos un link para restablecer tu contraseña
                  </p>
                </div>
              </div>

              <Button 
                type='submit' 
                className='w-full h-12 font-medium bg-blue-600 hover:bg-blue-700'
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Link de Recuperación
                  </>
                )}
              </Button>

              {/* Opciones alternativas */}
              <div className="space-y-4 mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-muted-foreground">
                      Otras opciones
                    </span>
                  </div>
                </div>

                {/* OAuth Options */}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    ¿Tu cuenta está vinculada con OAuth?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type='button'
                      variant='outline'
                      className='h-11 font-medium border-2 hover:bg-blue-50 hover:border-blue-300'
                      onClick={() => handleOAuthLogin('google')}
                      disabled={isLoading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </Button>

                    <Button
                      type='button'
                      variant='outline'
                      className='h-11 font-medium border-2 hover:bg-blue-50 hover:border-blue-300'
                      onClick={() => handleOAuthLogin('azure-ad')}
                      disabled={isLoading}
                    >
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23">
                        <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                      </svg>
                      Microsoft
                    </Button>
                  </div>
                </div>

                {/* Contactar Admin */}
                <Alert className="border-amber-200 bg-amber-50">
                  <Shield className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-sm">
                    <strong>¿Necesitas ayuda?</strong>
                    <br />
                    Contacta a un administrador en{' '}
                    <a href="mailto:admin@tickets.com" className="underline font-medium">
                      admin@tickets.com
                    </a>
                  </AlertDescription>
                </Alert>
              </div>
            </form>
          )}

          {step === 'sent' && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="p-4 bg-green-100 rounded-full">
                  <CheckCircle className="h-12 w-12 text-green-600" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-foreground">
                  Hemos enviado un email a:
                </p>
                <p className="font-medium text-blue-600">
                  {email}
                </p>
                <p className="text-sm text-muted-foreground">
                  El link de recuperación expirará en 1 hora
                </p>
              </div>

              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>No olvides revisar tu carpeta de spam</strong>
                  <br />
                  Si no recibes el email en 5 minutos, intenta de nuevo
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => setStep('email')}
                variant="outline"
                className="w-full"
              >
                Enviar otro email
              </Button>
            </div>
          )}

          {step === 'oauth' && (
            <div className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Tu cuenta está vinculada con <strong>{oauthProvider === 'google' ? 'Google' : 'Microsoft'}</strong>.
                  No necesitas contraseña, solo inicia sesión con OAuth.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <Button
                  onClick={() => handleOAuthLogin(oauthProvider!)}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700"
                >
                  {oauthProvider === 'google' ? (
                    <>
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="white"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                      </svg>
                      Iniciar sesión con Google
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 23 23">
                        <path fill="white" d="M0 0h23v23H0z"/>
                      </svg>
                      Iniciar sesión con Microsoft
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => setStep('email')}
                  variant="outline"
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
              </div>
            </div>
          )}

          {/* Back to Login */}
          <div className="text-center mt-6">
            <Link href="/login" className="text-sm text-blue-600 hover:underline font-medium inline-flex items-center">
              <ArrowLeft className="mr-1 h-3 w-3" />
              Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

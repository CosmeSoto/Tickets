'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2, Eye, EyeOff, Shield, CheckCircle,
  AlertCircle, WifiOff, User, Lock, LogIn,
} from 'lucide-react'
import { SystemLogo } from '@/components/common/system-logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [oauthProviders, setOauthProviders] = useState({ google: false, microsoft: false })
  const [loadingProviders, setLoadingProviders] = useState(true)

  const { authState, login } = useAuth({ redirectOnSuccess: true, enableNetworkDetection: false })
  const { isLoading, error, loginStep } = authState

  useEffect(() => {
    fetch('/api/auth/oauth-providers')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.providers) setOauthProviders(d.providers) })
      .catch(() => {})
      .finally(() => setLoadingProviders(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login({ email, password })
  }

  const getLoadingContent = () => {
    switch (loginStep) {
      case 'validating':    return { icon: <Shield className="mr-2 h-4 w-4 animate-pulse" />,   text: 'Validando...' }
      case 'authenticating':return { icon: <Lock className="mr-2 h-4 w-4 animate-pulse" />,     text: 'Autenticando...' }
      case 'redirecting':   return { icon: <CheckCircle className="mr-2 h-4 w-4" />,            text: 'Acceso concedido...' }
      default:              return { icon: <Loader2 className="mr-2 h-4 w-4 animate-spin" />,   text: 'Iniciando sesión...' }
    }
  }

  const hasOAuth = !loadingProviders && (oauthProviders.google || oauthProviders.microsoft)
  const { icon: loadingIcon, text: loadingText } = getLoadingContent()

  return (
    <div className="min-h-screen flex bg-background">
      {/* Panel izquierdo decorativo — visible solo en lg+ */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Círculos decorativos usando opacidad del mismo primary */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-foreground/5" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-primary-foreground/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary-foreground/3" />

        <div className="relative z-10 text-center space-y-6 max-w-sm">
          <div className="flex justify-center">
            <SystemLogo size="xl" showText={true} className="brightness-0 invert" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-primary-foreground">
              Plataforma de Gestión
            </h2>
            <p className="text-primary-foreground/70 text-base leading-relaxed">
              Centraliza soporte técnico, inventario y operaciones en un solo lugar.
            </p>
          </div>
          {/* Feature bullets */}
          <div className="space-y-3 text-left pt-4">
            {[
              'Tickets y soporte técnico',
              'Gestión de inventario',
              'Base de conocimientos',
              'Reportes y estadísticas',
            ].map(f => (
              <div key={f} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-3 w-3 text-primary-foreground" />
                </div>
                <span className="text-sm text-primary-foreground/80">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo — visible solo en móvil (en desktop está en el panel izquierdo) */}
          <div className="flex justify-center lg:hidden">
            <SystemLogo size="lg" showText={true} />
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Bienvenido de vuelta</h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <div className="flex items-start gap-2">
                {error.type === 'network'
                  ? <WifiOff className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                }
                <div>
                  <AlertDescription className="font-medium">{error.message}</AlertDescription>
                  {error.suggestion && <p className="text-xs mt-1 opacity-80">{error.suggestion}</p>}
                </div>
              </div>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email" type="email" placeholder="tu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required disabled={isLoading}
                  className="pl-9 h-11 bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password" type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  required disabled={isLoading}
                  className="pl-9 pr-10 h-11 bg-background"
                />
                <Button type="button" variant="ghost" size="sm" tabIndex={-1}
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                  {showPassword
                    ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                    : <Eye className="h-4 w-4 text-muted-foreground" />
                  }
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-sm font-semibold"
              disabled={isLoading || !email.trim() || !password.trim()}>
              {isLoading
                ? <>{loadingIcon}{loadingText}</>
                : <><LogIn className="mr-2 h-4 w-4" />Iniciar Sesión</>
              }
            </Button>
          </form>

          {/* OAuth */}
          {hasOAuth && (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-background text-muted-foreground">O continúa con</span>
                </div>
              </div>
              <div className={`grid gap-3 ${oauthProviders.google && oauthProviders.microsoft ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {oauthProviders.google && (
                  <Button type="button" variant="outline" className="h-10 bg-background"
                    onClick={() => signIn('google', { callbackUrl: '/client' })} disabled={isLoading}>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google
                  </Button>
                )}
                {oauthProviders.microsoft && (
                  <Button type="button" variant="outline" className="h-10 bg-background"
                    onClick={() => signIn('azure-ad', { callbackUrl: '/client' })} disabled={isLoading}>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23">
                      <path fill="#f3f3f3" d="M0 0h23v23H0z"/><path fill="#f35325" d="M1 1h10v10H1z"/>
                      <path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/>
                      <path fill="#ffba08" d="M12 12h10v10H12z"/>
                    </svg>
                    Microsoft
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Register link */}
          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="text-primary hover:underline font-semibold">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

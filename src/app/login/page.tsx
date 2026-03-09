'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Loader2, 
  Eye, 
  EyeOff, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Wifi, 
  WifiOff,
  User,
  Lock,
  LogIn
} from 'lucide-react'

// Tipos para errores específicos - ahora manejados por el hook
// type LoginError = {
//   type: 'credentials' | 'network' | 'server' | 'validation' | 'account'
//   message: string
//   suggestion?: string
// }

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  // Estado para proveedores OAuth habilitados
  const [oauthProviders, setOauthProviders] = useState({
    google: false,
    microsoft: false
  })
  const [loadingProviders, setLoadingProviders] = useState(true)
  
  // Usar el hook optimizado de autenticación con detección de red deshabilitada
  const {
    authState,
    login,
    clearError,
    canLogin,
    loginProgress
  } = useAuth({
    redirectOnSuccess: true,
    enableNetworkDetection: false // Deshabilitar detección de red problemática
  })

  const { isLoading, error, loginStep, isOnline } = authState

  // Cargar proveedores OAuth habilitados
  useEffect(() => {
    const fetchOAuthProviders = async () => {
      try {
        const response = await fetch('/api/auth/oauth-providers')
        if (response.ok) {
          const data = await response.json()
          setOauthProviders(data.providers || { google: false, microsoft: false })
        }
      } catch (error) {
        console.error('Error cargando proveedores OAuth:', error)
      } finally {
        setLoadingProviders(false)
      }
    }

    fetchOAuthProviders()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const success = await login({
      email,
      password
    })

    if (success) {
      // Login exitoso, el hook maneja la redirección
      console.log('Login exitoso')
    }
  }

  // Función para obtener el icono del error
  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'network':
        return <WifiOff className="h-4 w-4" />
      case 'credentials':
        return <AlertCircle className="h-4 w-4" />
      case 'account':
        return <User className="h-4 w-4" />
      case 'validation':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  // Función para obtener el mensaje de loading
  const getLoadingMessage = () => {
    switch (loginStep) {
      case 'validating':
        return 'Validando credenciales...'
      case 'authenticating':
        return 'Autenticando usuario...'
      case 'redirecting':
        return 'Acceso concedido, redirigiendo...'
      default:
        return 'Iniciando sesión...'
    }
  }

  // Función para obtener el icono de loading
  const getLoadingIcon = () => {
    switch (loginStep) {
      case 'validating':
        return <Shield className="mr-2 h-4 w-4 animate-pulse" />
      case 'authenticating':
        return <Lock className="mr-2 h-4 w-4 animate-pulse" />
      case 'redirecting':
        return <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
      default:
        return <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <Card className='w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm'>
        <CardHeader className='space-y-1 pb-8'>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <CardTitle className='text-2xl font-bold text-center text-foreground'>
            Sistema de Tickets
          </CardTitle>
          <CardDescription className='text-center text-muted-foreground'>
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
          
          {/* Indicador de conexión - Siempre mostrar como conectado */}
          <div className="flex items-center justify-center mt-2">
            <div className="flex items-center space-x-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              <Wifi className="h-3 w-3" />
              <span>En línea</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pb-8">
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Error mejorado con iconos y sugerencias */}
            {error && (
              <Alert variant='destructive' className="border-red-200 bg-red-50">
                <div className="flex items-start space-x-2">
                  {getErrorIcon(error.type)}
                  <div className="flex-1">
                    <AlertDescription className="font-medium text-red-800">
                      {error.message}
                    </AlertDescription>
                    {error.suggestion && (
                      <p className="text-sm text-red-600 mt-1">
                        {error.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            <div className='space-y-4'>
              <div className='space-y-2'>
                <Label htmlFor='email' className="text-foreground font-medium">
                  Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
              </div>

              <div className='space-y-2'>
                <div className="flex items-center justify-between">
                  <Label htmlFor='password' className="text-foreground font-medium">
                    Contraseña
                  </Label>
                  <Link 
                    href="/forgot-password" 
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className='relative'>
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id='password'
                    type={showPassword ? 'text' : 'password'}
                    placeholder='••••••••'
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    className="pl-10 pr-12 h-12 border-border focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    {showPassword ? 
                      <EyeOff className='h-4 w-4 text-muted-foreground' /> : 
                      <Eye className='h-4 w-4 text-muted-foreground' />
                    }
                  </Button>
                </div>
              </div>
            </div>

            <Button 
              type='submit' 
              className={`w-full h-12 font-medium transition-all duration-200 ${
                loginStep === 'redirecting' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={isLoading || !email.trim() || !password.trim()}
            >
              {isLoading ? (
                <div className="flex items-center">
                  {getLoadingIcon()}
                  {getLoadingMessage()}
                </div>
              ) : (
                <div className="flex items-center">
                  <LogIn className="mr-2 h-4 w-4" />
                  Iniciar Sesión
                </div>
              )}
            </Button>

            {/* Divider - Solo mostrar si hay proveedores OAuth habilitados */}
            {!loadingProviders && (oauthProviders.google || oauthProviders.microsoft) && (
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-card text-muted-foreground">
                    O continúa con
                  </span>
                </div>
              </div>
            )}

            {/* OAuth Buttons - Solo mostrar los habilitados */}
            {!loadingProviders && (oauthProviders.google || oauthProviders.microsoft) && (
              <div className={`grid gap-3 ${oauthProviders.google && oauthProviders.microsoft ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {oauthProviders.google && (
                  <Button
                    type='button'
                    variant='outline'
                    className='h-11 font-medium border-2 hover:bg-blue-50 hover:border-blue-300'
                    onClick={() => signIn('google', { callbackUrl: '/client' })}
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
                )}

                {oauthProviders.microsoft && (
                  <Button
                    type='button'
                    variant='outline'
                    className='h-11 font-medium border-2 hover:bg-blue-50 hover:border-blue-300'
                    onClick={() => signIn('azure-ad', { callbackUrl: '/client' })}
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
                )}
              </div>
            )}

            {/* Register Link */}
            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground">
                ¿No tienes cuenta?{' '}
                <Link href="/register" className="text-blue-600 hover:underline font-medium">
                  Regístrate aquí
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

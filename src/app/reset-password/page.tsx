'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  CheckCircle, 
  AlertCircle,
  Key,
  Lock,
  Shield
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Validar token al cargar
  useEffect(() => {
    const tokenParam = searchParams.get('token')
    
    if (!tokenParam) {
      setError('Token de recuperación no encontrado')
      setIsValidating(false)
      return
    }

    setToken(tokenParam)
    validateToken(tokenParam)
  }, [searchParams])

  const validateToken = async (tokenValue: string) => {
    try {
      const response = await fetch('/api/auth/validate-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenValue })
      })

      const data = await response.json()

      if (response.ok && data.valid) {
        setIsValidToken(true)
      } else {
        setError(data.message || 'El token de recuperación es inválido o ha expirado')
      }
    } catch (error) {
      setError('Error al validar el token')
    } finally {
      setIsValidating(false)
    }
  }

  const validatePassword = (): string | null => {
    if (password.length < 8) {
      return 'La contraseña debe tener al menos 8 caracteres'
    }

    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden'
    }

    // Validación adicional de seguridad
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return 'La contraseña debe contener mayúsculas, minúsculas y números'
    }

    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validar contraseña
    const validationError = validatePassword()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: password
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        toast({
          title: 'Contraseña actualizada',
          description: 'Tu contraseña ha sido restablecida exitosamente',
        })

        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        setError(data.message || 'No se pudo restablecer la contraseña')
        toast({
          title: 'Error',
          description: data.message || 'No se pudo restablecer la contraseña',
          variant: 'destructive'
        })
      }
    } catch (error) {
      setError('Ocurrió un error al procesar tu solicitud')
      toast({
        title: 'Error',
        description: 'Ocurrió un error al procesar tu solicitud',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Indicador de fortaleza de contraseña
  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: '' }

    let strength = 0
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[a-z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[^A-Za-z0-9]/.test(password)) strength++

    if (strength <= 2) return { strength: 33, label: 'Débil', color: 'bg-red-500' }
    if (strength <= 4) return { strength: 66, label: 'Media', color: 'bg-yellow-500' }
    return { strength: 100, label: 'Fuerte', color: 'bg-green-500' }
  }

  const passwordStrength = getPasswordStrength()

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <Card className='w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm'>
        <CardHeader className='space-y-1 pb-8'>
          <div className="flex justify-center mb-4">
            <div className={`p-3 rounded-full ${
              success ? 'bg-green-100' : 
              error ? 'bg-red-100' : 
              'bg-blue-100'
            }`}>
              {success ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : error ? (
                <AlertCircle className="h-8 w-8 text-red-600" />
              ) : (
                <Key className="h-8 w-8 text-blue-600" />
              )}
            </div>
          </div>
          <CardTitle className='text-2xl font-bold text-center text-foreground'>
            {success ? '¡Contraseña Actualizada!' : 
             error ? 'Error' : 
             'Restablecer Contraseña'}
          </CardTitle>
          <CardDescription className='text-center text-muted-foreground'>
            {success ? 'Redirigiendo al inicio de sesión...' :
             error ? 'Hubo un problema con tu solicitud' :
             'Ingresa tu nueva contraseña'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-8">
          {isValidating ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              <p className="text-muted-foreground">Validando token...</p>
            </div>
          ) : success ? (
            <div className="space-y-6">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Tu contraseña ha sido restablecida exitosamente. Serás redirigido al inicio de sesión en unos segundos.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => router.push('/login')}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Ir al Inicio de Sesión
              </Button>
            </div>
          ) : !isValidToken ? (
            <div className="space-y-6">
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error || 'El enlace de recuperación es inválido o ha expirado'}
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Posibles razones:
                </p>
                <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                  <li>El enlace ha expirado (válido por 1 hora)</li>
                  <li>El enlace ya fue utilizado</li>
                  <li>El enlace es incorrecto</li>
                </ul>
              </div>

              <Button
                onClick={() => router.push('/forgot-password')}
                className="w-full"
                variant="outline"
              >
                Solicitar Nuevo Enlace
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className='space-y-6'>
              {error && (
                <Alert variant='destructive' className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='password' className="text-foreground font-medium">
                    Nueva Contraseña
                  </Label>
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

                  {/* Indicador de fortaleza */}
                  {password && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Fortaleza:</span>
                        <span className={`font-medium ${
                          passwordStrength.strength === 100 ? 'text-green-600' :
                          passwordStrength.strength === 66 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.strength}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='confirmPassword' className="text-foreground font-medium">
                    Confirmar Contraseña
                  </Label>
                  <div className='relative'>
                    <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id='confirmPassword'
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder='••••••••'
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      className="pl-10 pr-12 h-12 border-border focus:border-blue-500 focus:ring-blue-500"
                    />
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? 
                        <EyeOff className='h-4 w-4 text-muted-foreground' /> : 
                        <Eye className='h-4 w-4 text-muted-foreground' />
                      }
                    </Button>
                  </div>
                </div>
              </div>

              {/* Requisitos de contraseña */}
              <Alert className="border-blue-200 bg-blue-50">
                <Shield className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  <strong>Requisitos de contraseña:</strong>
                  <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
                    <li>Mínimo 8 caracteres</li>
                    <li>Al menos una mayúscula</li>
                    <li>Al menos una minúscula</li>
                    <li>Al menos un número</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Button 
                type='submit' 
                className='w-full h-12 font-medium bg-blue-600 hover:bg-blue-700'
                disabled={isLoading || !password.trim() || !confirmPassword.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando contraseña...
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    Restablecer Contraseña
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Back to Login */}
          <div className="text-center mt-6">
            <Link href="/login" className="text-sm text-blue-600 hover:underline font-medium">
              Volver al inicio de sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50'>
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

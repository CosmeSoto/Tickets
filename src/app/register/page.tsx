'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  UserPlus,
  Mail,
  User,
  Lock,
  Phone,
  Eye,
  EyeOff,
  Building2
} from 'lucide-react'
import { SystemLogo } from '@/components/common/system-logo'

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
  phone?: string
  departmentId?: string
}

export default function RegisterPage() {
  const router = useRouter()
  
  // Estados para formulario manual
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    departmentId: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  
  // Estados para departamentos
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  
  // Estados para proveedores OAuth habilitados
  const [oauthProviders, setOauthProviders] = useState({
    google: false,
    microsoft: false
  })
  const [loadingProviders, setLoadingProviders] = useState(true)
  
  // Estados para OAuth
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  
  // Estados generales
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Cargar departamentos al montar el componente
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await fetch('/api/departments?public=true')
        if (response.ok) {
          const data = await response.json()
          setDepartments(data.departments || [])
        }
      } catch (error) {
        console.error('Error cargando departamentos:', error)
      } finally {
        setLoadingDepartments(false)
      }
    }

    fetchDepartments()
  }, [])

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

  // Validar formulario
  const validateForm = (): boolean => {
    const errors: FormErrors = {}

    // Validar nombre
    if (!formData.name.trim()) {
      errors.name = 'El nombre es requerido'
    } else if (formData.name.trim().length < 2) {
      errors.name = 'El nombre debe tener al menos 2 caracteres'
    }

    // Validar email
    if (!formData.email.trim()) {
      errors.email = 'El email es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido'
    }

    // Validar contraseña
    if (!formData.password) {
      errors.password = 'La contraseña es requerida'
    } else if (formData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres'
    }

    // Validar confirmación de contraseña
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirma tu contraseña'
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden'
    }

    // Validar teléfono (opcional)
    if (formData.phone && formData.phone.trim()) {
      if (!/^\+?[\d\s\-()]+$/.test(formData.phone)) {
        errors.phone = 'Teléfono inválido'
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Manejar cambios en el formulario
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Limpiar error del campo cuando el usuario empieza a escribir
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }))
    }
    setError(null)
  }

  // Manejar registro manual
  const handleManualRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validar formulario
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          phone: formData.phone.trim() || null,
          departmentId: formData.departmentId || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.field === 'email') {
          setFormErrors({ email: data.error })
        } else if (data.errors) {
          const errors: FormErrors = {}
          data.errors.forEach((err: any) => {
            errors[err.field as keyof FormErrors] = err.message
          })
          setFormErrors(errors)
        } else {
          setError(data.error || 'Error al registrar usuario')
        }
        setIsSubmitting(false)
        return
      }

      // Registro exitoso
      setSuccess('¡Cuenta creada exitosamente! Redirigiendo al login...')
      
      // Esperar un momento para mostrar el mensaje
      setTimeout(() => {
        router.push('/login?registered=true')
      }, 2000)

    } catch (error) {
      console.error('Error en registro:', error)
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
      setIsSubmitting(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'azure-ad') => {
    setIsLoading(true)
    setLoadingProvider(provider)
    setError(null)

    try {
      const result = await signIn(provider, {
        callbackUrl: '/client',
        redirect: true,
      })

      if (result?.error) {
        setError('Error al conectar con el proveedor. Intenta de nuevo.')
        setIsLoading(false)
        setLoadingProvider(null)
      }
    } catch (error) {
      console.error('OAuth error:', error)
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
      setIsLoading(false)
      setLoadingProvider(null)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8'>
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <Card className='w-full max-w-md shadow-xl border-0 bg-card/80 backdrop-blur-sm'>
        <CardHeader className='space-y-1 pb-8'>
          <div className="flex justify-center mb-4">
            <SystemLogo size="md" showText={true} />
          </div>
          <CardTitle className='text-2xl font-bold text-center text-foreground'>
            Crear Cuenta
          </CardTitle>
          <CardDescription className='text-center text-muted-foreground'>
            Regístrate para crear tickets de soporte técnico
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-8">
          {/* Error message */}
          {error && (
            <Alert variant='destructive' className="mb-6 border-red-200 bg-red-50">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <AlertDescription className="font-medium text-red-800">
                  {error}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Success message */}
          {success && (
            <Alert className="mb-6 border-green-200 bg-green-50">
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
                <AlertDescription className="font-medium text-green-800">
                  {success}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Manual Registration Form */}
          <form onSubmit={handleManualRegister} className="space-y-4 mb-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-foreground">
                Nombre completo
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Juan Pérez"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={isSubmitting}
                  className={`pl-10 h-11 ${formErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
              </div>
              {formErrors.name && (
                <p className="text-xs text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {formErrors.name}
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={isSubmitting}
                  className={`pl-10 h-11 ${formErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
              </div>
              {formErrors.email && (
                <p className="text-xs text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {formErrors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={isSubmitting}
                  className={`pl-10 pr-10 h-11 ${formErrors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formErrors.password && (
                <p className="text-xs text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {formErrors.password}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                Confirmar contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  disabled={isSubmitting}
                  className={`pl-10 pr-10 h-11 ${formErrors.confirmPassword ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formErrors.confirmPassword && (
                <p className="text-xs text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Phone Field (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                Teléfono <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+52 123 456 7890"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={isSubmitting}
                  className={`pl-10 h-11 ${formErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
              </div>
              {formErrors.phone && (
                <p className="text-xs text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {formErrors.phone}
                </p>
              )}
            </div>

            {/* Department Field (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="department" className="text-sm font-medium text-foreground">
                Departamento <span className="text-muted-foreground text-xs">(opcional)</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <select
                  id="department"
                  value={formData.departmentId}
                  onChange={(e) => handleInputChange('departmentId', e.target.value)}
                  disabled={isSubmitting || loadingDepartments}
                  className={`w-full h-11 pl-10 pr-4 rounded-md border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.departmentId ? 'border-red-500' : 'border-input'
                  } ${loadingDepartments ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">Selecciona un departamento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              {loadingDepartments && (
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Cargando departamentos...
                </p>
              )}
              {formErrors.departmentId && (
                <p className="text-xs text-red-600 flex items-center mt-1">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {formErrors.departmentId}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Selecciona el departamento al que perteneces para una mejor atención
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 font-medium bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-5 w-5" />
                  Crear Cuenta
                </>
              )}
            </Button>
          </form>

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
            <div className='space-y-4'>
              {/* Google Sign In */}
              {oauthProviders.google && (
                <Button
                  type='button'
                  variant='outline'
                  className='w-full h-12 font-medium border-2 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200'
                  onClick={() => handleOAuthSignIn('google')}
                  disabled={isLoading}
                >
                  {loadingProvider === 'google' ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Conectando con Google...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
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
                      Continuar con Google
                    </>
                  )}
                </Button>
              )}

              {/* Microsoft/Outlook Sign In */}
              {oauthProviders.microsoft && (
                <Button
                  type='button'
                  variant='outline'
                  className='w-full h-12 font-medium border-2 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200'
                  onClick={() => handleOAuthSignIn('azure-ad')}
                  disabled={isLoading}
                >
                  {loadingProvider === 'azure-ad' ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Conectando con Microsoft...
                    </>
                  ) : (
                    <>
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 23 23">
                        <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                        <path fill="#f35325" d="M1 1h10v10H1z"/>
                        <path fill="#81bc06" d="M12 1h10v10H12z"/>
                        <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                        <path fill="#ffba08" d="M12 12h10v10H12z"/>
                      </svg>
                      Continuar con Microsoft
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Inicia sesión aquí
              </Link>
            </p>
          </div>

          {/* Benefits Section */}
          <div className='mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200'>
            <div className='text-sm space-y-3'>
              <p className='font-medium text-blue-900 flex items-center'>
                <CheckCircle className="h-4 w-4 mr-2 text-blue-600" />
                Beneficios de registrarte:
              </p>
              <ul className='space-y-2 text-xs text-blue-800 ml-6'>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Crea y gestiona tickets de soporte técnico</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Seguimiento en tiempo real de tus solicitudes</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Historial completo de tickets y soluciones</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Notificaciones de actualizaciones</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Acceso rápido y seguro con tu cuenta de Google o Microsoft</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className='mt-6 text-center'>
            <p className='text-xs text-muted-foreground'>
              Al registrarte, aceptas nuestros{' '}
              <Link href='/help/terms' className='text-blue-600 hover:underline'>
                Términos de Servicio
              </Link>{' '}
              y{' '}
              <Link href='/help/privacy' className='text-blue-600 hover:underline'>
                Política de Privacidad
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

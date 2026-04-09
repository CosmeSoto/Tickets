'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthLayout, AuthCard, AuthHeader } from '@/components/auth/auth-layout'
import {
  Loader2, CheckCircle, AlertCircle, UserPlus,
  Mail, User, Lock, Phone, Eye, EyeOff, Building2,
} from 'lucide-react'

interface FormErrors {
  name?: string; email?: string; password?: string
  confirmPassword?: string; phone?: string; departmentId?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: '', phone: '', departmentId: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([])
  const [loadingDepts, setLoadingDepts] = useState(true)
  const [oauthProviders, setOauthProviders] = useState({ google: false, microsoft: false })
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [isOAuthLoading, setIsOAuthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/departments?public=true')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.departments) setDepartments(d.departments) })
      .catch(() => {})
      .finally(() => setLoadingDepts(false))

    fetch('/api/auth/oauth-providers')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.providers) setOauthProviders(d.providers) })
      .catch(() => {})
      .finally(() => setLoadingProviders(false))
  }, [])

  const validate = (): boolean => {
    const errors: FormErrors = {}
    if (!formData.name.trim() || formData.name.trim().length < 2)
      errors.name = 'El nombre debe tener al menos 2 caracteres'
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errors.email = 'Email inválido'
    if (!formData.password || formData.password.length < 6)
      errors.password = 'Mínimo 6 caracteres'
    if (formData.password !== formData.confirmPassword)
      errors.confirmPassword = 'Las contraseñas no coinciden'
    if (formData.phone && !/^\+?[\d\s\-()]+$/.test(formData.phone))
      errors.phone = 'Teléfono inválido'
    if (!formData.departmentId)
      errors.departmentId = 'Selecciona un departamento'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) setFormErrors(prev => ({ ...prev, [field]: undefined }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          phone: formData.phone.trim() || null,
          departmentId: formData.departmentId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.field === 'email') setFormErrors({ email: data.error })
        else setError(data.error || 'Error al registrar usuario')
        return
      }
      setSuccess(true)
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'azure-ad') => {
    setIsOAuthLoading(true)
    await signIn(provider, { callbackUrl: '/client', redirect: true })
    setIsOAuthLoading(false)
  }

  const hasOAuth = !loadingProviders && (oauthProviders.google || oauthProviders.microsoft)

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
        <AlertCircle className="h-3 w-3" />{msg}
      </p>
    ) : null

  return (
    <AuthLayout>
      <AuthCard>
        {/* ── Estado de éxito — reemplaza todo el formulario ── */}
        {success ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="p-4 bg-green-500/10 rounded-full">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">¡Cuenta creada exitosamente!</h2>
              <p className="text-sm text-muted-foreground">
                Tu cuenta ha sido registrada. Serás redirigido al inicio de sesión en unos segundos.
              </p>
            </div>
            <div className="w-full pt-2">
              <Button className="w-full" onClick={() => router.push('/login')}>
                Ir al inicio de sesión
              </Button>
            </div>
          </div>
        ) : (
          <>
            <AuthHeader
              title="Crear Cuenta"
              description="Regístrate para crear tickets de soporte técnico"
            />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre completo</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="name" placeholder="Juan Pérez" value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                disabled={isSubmitting} className="pl-9 h-11" />
            </div>
            <FieldError msg={formErrors.name} />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" placeholder="tu@email.com" value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                disabled={isSubmitting} className="pl-9 h-11" />
            </div>
            <FieldError msg={formErrors.email} />
          </div>

          {/* Contraseña */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres" value={formData.password}
                onChange={e => handleChange('password', e.target.value)}
                disabled={isSubmitting} className="pl-9 pr-10 h-11" />
              <button type="button" tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError msg={formErrors.password} />
          </div>

          {/* Confirmar contraseña */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repite tu contraseña" value={formData.confirmPassword}
                onChange={e => handleChange('confirmPassword', e.target.value)}
                disabled={isSubmitting} className="pl-9 pr-10 h-11" />
              <button type="button" tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError msg={formErrors.confirmPassword} />
          </div>

          {/* Teléfono (opcional) */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Teléfono <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="phone" type="tel" placeholder="+593 99 999 9999" value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                disabled={isSubmitting} className="pl-9 h-11" />
            </div>
            <FieldError msg={formErrors.phone} />
          </div>

          {/* Departamento (obligatorio) */}
          <div className="space-y-1.5">
            <Label htmlFor="department">Departamento *</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
              <select id="department" value={formData.departmentId}
                onChange={e => handleChange('departmentId', e.target.value)}
                disabled={isSubmitting || loadingDepts}
                required
                className="w-full h-11 pl-9 pr-4 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                <option value="">Selecciona un departamento</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <FieldError msg={formErrors.departmentId} />
          </div>

          <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
            {isSubmitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando cuenta...</>
              : <><UserPlus className="mr-2 h-4 w-4" />Crear Cuenta</>
            }
          </Button>
        </form>

        {/* OAuth */}
        {hasOAuth && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-card text-muted-foreground">O continúa con</span>
              </div>
            </div>
            <div className={`grid gap-3 ${oauthProviders.google && oauthProviders.microsoft ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {oauthProviders.google && (
                <Button variant="outline" className="h-10" onClick={() => handleOAuth('google')} disabled={isOAuthLoading}>
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
                <Button variant="outline" className="h-10" onClick={() => handleOAuth('azure-ad')} disabled={isOAuthLoading}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 23 23">
                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/><path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                  Microsoft
                </Button>
              )}
            </div>
          </>
        )}

        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">Inicia sesión</Link>
          </p>
          <p className="text-xs text-muted-foreground">
            Al registrarte aceptas nuestros{' '}
            <Link href="/help/terms" className="text-primary hover:underline">Términos</Link>
            {' '}y{' '}
            <Link href="/help/privacy" className="text-primary hover:underline">Privacidad</Link>
          </p>
        </div>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  )
}

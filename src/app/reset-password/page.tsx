'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AuthLayout, AuthCard, AuthHeader } from '@/components/auth/auth-layout'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle, Key, Lock, Shield } from 'lucide-react'

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  const pct = score <= 2 ? 33 : score <= 4 ? 66 : 100
  const label = pct === 33 ? 'Débil' : pct === 66 ? 'Media' : 'Fuerte'
  const color = pct === 33 ? 'bg-destructive' : pct === 66 ? 'bg-yellow-500' : 'bg-green-500'
  const textColor = pct === 33 ? 'text-destructive' : pct === 66 ? 'text-yellow-600' : 'text-green-600'

  return (
    <div className="space-y-1 mt-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Fortaleza:</span>
        <span className={`font-medium ${textColor}`}>{label}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const t = searchParams.get('token')
    if (!t) { setError('Token no encontrado'); setIsValidating(false); return }
    setToken(t)
    fetch('/api/auth/validate-reset-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: t }),
    })
      .then(r => r.json())
      .then(d => { if (d.valid) setIsValidToken(true); else setError(d.message || 'Token inválido o expirado') })
      .catch(() => setError('Error al validar el token'))
      .finally(() => setIsValidating(false))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Debe contener mayúsculas, minúsculas y números'); return
    }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        toast({ title: 'Contraseña actualizada', description: 'Redirigiendo al login...' })
        setTimeout(() => router.push('/login'), 3000)
      } else {
        setError(data.message || 'No se pudo restablecer la contraseña')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setIsLoading(false)
    }
  }

  if (isValidating) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Validando enlace...</p>
          </div>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (success) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <div className="p-3 bg-green-500/10 rounded-full">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold">¡Contraseña actualizada!</h2>
            <p className="text-sm text-muted-foreground">Redirigiendo al inicio de sesión...</p>
          </div>
          <Button className="w-full" onClick={() => router.push('/login')}>
            Ir al inicio de sesión
          </Button>
        </AuthCard>
      </AuthLayout>
    )
  }

  if (!isValidToken) {
    return (
      <AuthLayout>
        <AuthCard>
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Enlace inválido</h2>
          </div>
          <Alert variant="destructive">
            <AlertDescription>{error || 'El enlace es inválido o ha expirado'}</AlertDescription>
          </Alert>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>El enlace expira en 1 hora</li>
            <li>El enlace ya fue utilizado</li>
            <li>El enlace es incorrecto</li>
          </ul>
          <Button variant="outline" className="w-full" onClick={() => router.push('/forgot-password')}>
            Solicitar nuevo enlace
          </Button>
        </AuthCard>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <AuthCard>
        <AuthHeader title="Restablecer contraseña" description="Ingresa tu nueva contraseña" />

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="password" type={showPassword ? 'text' : 'password'}
                placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)}
                required disabled={isLoading} className="pl-9 pr-10 h-11" />
              <button type="button" tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required disabled={isLoading} className="pl-9 pr-10 h-11" />
              <button type="button" tabIndex={-1}
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Mínimo 8 caracteres con mayúsculas, minúsculas y números.
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full h-11"
            disabled={isLoading || !password || !confirmPassword}>
            {isLoading
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Actualizando...</>
              : <><Key className="mr-2 h-4 w-4" />Restablecer contraseña</>
            }
          </Button>
        </form>

        <div className="text-center">
          <Link href="/login" className="text-sm text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}

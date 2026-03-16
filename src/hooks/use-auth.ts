/**
 * Hook optimizado para autenticación con mejor UX y error handling
 * Complementa NextAuth con funcionalidades adicionales
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export interface AuthError {
  type: 'credentials' | 'network' | 'server' | 'validation' | 'account' | 'session'
  message: string
  suggestion?: string
  code?: string
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface AuthState {
  isLoading: boolean
  error: AuthError | null
  loginStep: 'idle' | 'validating' | 'authenticating' | 'redirecting'
  isOnline: boolean
}

interface UseAuthOptions {
  redirectOnSuccess?: boolean
  enableRememberMe?: boolean
  enableNetworkDetection?: boolean
}

interface UseAuthReturn {
  // Estados
  authState: AuthState
  session: any
  isAuthenticated: boolean
  
  // Funciones principales
  login: (credentials: LoginCredentials) => Promise<boolean>
  logout: (options?: { redirect?: boolean }) => Promise<void>
  
  // Funciones de utilidad
  clearError: () => void
  validateCredentials: (credentials: LoginCredentials) => AuthError | null
  getRedirectUrl: (role?: string) => string
  
  // Estados específicos
  canLogin: boolean
  loginProgress: number
}

export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const {
    redirectOnSuccess = true,
    enableRememberMe = false,
    enableNetworkDetection = true
  } = options

  const { data: session, status } = useSession()
  const router = useRouter()

  // Estados principales
  const [authState, setAuthState] = useState<AuthState>({
    isLoading: false,
    error: null,
    loginStep: 'idle',
    isOnline: true
  })

  // Detectar estado de conexión
  useEffect(() => {
    if (!enableNetworkDetection) {
      setAuthState(prev => ({ ...prev, isOnline: true }))
      return
    }

    // Función para verificar conectividad real
    const checkConnectivity = async () => {
      try {
        const response = await fetch('/api/health', { 
          method: 'HEAD',
          cache: 'no-cache'
        })
        return response.ok
      } catch {
        return false
      }
    }

    const handleOnline = async () => {
      const isConnected = await checkConnectivity()
      setAuthState(prev => ({ ...prev, isOnline: isConnected }))
    }
    
    const handleOffline = () => {
      setAuthState(prev => ({ ...prev, isOnline: false }))
    }
    
    // Verificar estado inicial
    checkConnectivity().then(isConnected => {
      setAuthState(prev => ({ ...prev, isOnline: isConnected }))
    })
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [enableNetworkDetection])

  // Función para crear errores específicos
  const createAuthError = useCallback((error: any, result?: any): AuthError => {
    if (!authState.isOnline) {
      return {
        type: 'network',
        message: 'Sin conexión a internet',
        suggestion: 'Verifica tu conexión y vuelve a intentar',
        code: 'NETWORK_OFFLINE'
      }
    }

    if (result?.error) {
      switch (result.error) {
        case 'CredentialsSignin':
          return {
            type: 'credentials',
            message: 'Email o contraseña incorrectos',
            suggestion: 'Verifica tus credenciales e intenta de nuevo',
            code: 'INVALID_CREDENTIALS'
          }
        case 'AccessDenied':
          return {
            type: 'account',
            message: 'Cuenta desactivada o sin permisos',
            suggestion: 'Contacta al administrador del sistema',
            code: 'ACCESS_DENIED'
          }
        case 'Configuration':
          return {
            type: 'server',
            message: 'Error de configuración del servidor',
            suggestion: 'Contacta al soporte técnico',
            code: 'SERVER_CONFIG'
          }
        case 'OAuthSignin':
        case 'OAuthCallback':
        case 'OAuthCreateAccount':
          return {
            type: 'server',
            message: 'Error en autenticación OAuth',
            suggestion: 'Intenta con otro método de inicio de sesión',
            code: result.error
          }
        default:
          return {
            type: 'server',
            message: 'Error de autenticación',
            suggestion: 'Intenta de nuevo en unos momentos',
            code: result.error
          }
      }
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: 'network',
        message: 'Error de conexión',
        suggestion: 'Verifica tu conexión a internet',
        code: 'NETWORK_ERROR'
      }
    }

    if (error?.message?.includes('timeout')) {
      return {
        type: 'network',
        message: 'Tiempo de espera agotado',
        suggestion: 'La conexión es lenta, intenta de nuevo',
        code: 'TIMEOUT'
      }
    }

    return {
      type: 'server',
      message: 'Error interno del servidor',
      suggestion: 'Intenta de nuevo en unos momentos',
      code: 'INTERNAL_ERROR'
    }
  }, [authState.isOnline])

  // Función para validar credenciales
  const validateCredentials = useCallback((credentials: LoginCredentials): AuthError | null => {
    const { email, password } = credentials

    if (!email?.trim() || !password?.trim()) {
      return {
        type: 'validation',
        message: 'Email y contraseña son requeridos',
        suggestion: 'Completa todos los campos',
        code: 'MISSING_FIELDS'
      }
    }

    if (!email.includes('@') || !email.includes('.')) {
      return {
        type: 'validation',
        message: 'Email no válido',
        suggestion: 'Ingresa un email válido',
        code: 'INVALID_EMAIL'
      }
    }

    if (password.length < 6) {
      return {
        type: 'validation',
        message: 'Contraseña muy corta',
        suggestion: 'La contraseña debe tener al menos 6 caracteres',
        code: 'PASSWORD_TOO_SHORT'
      }
    }

    return null
  }, [])

  // Función para obtener URL de redirección
  const getRedirectUrl = useCallback((role?: string): string => {
    const userRole = role || session?.user?.role

    switch (userRole) {
      case 'ADMIN':
        return '/admin'
      case 'TECHNICIAN':
        return '/technician'
      case 'CLIENT':
        return '/client'
      default:
        return '/'
    }
  }, [session])

  // Función principal de login
  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    // Validar credenciales
    const validationError = validateCredentials(credentials)
    if (validationError) {
      setAuthState(prev => ({ ...prev, error: validationError }))
      return false
    }

    setAuthState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      loginStep: 'validating'
    }))

    try {
      setAuthState(prev => ({ ...prev, loginStep: 'authenticating' }))

      const result = await signIn('credentials', {
        email: credentials.email.trim(),
        password: credentials.password,
        redirect: false,
      })

      console.log('[AUTH] signIn result:', JSON.stringify(result))

      // Si hay un error explícito o ok es false
      if (!result?.ok || result?.error) {
        const authError = createAuthError(null, result)
        setAuthState(prev => ({ 
          ...prev, 
          error: authError,
          loginStep: 'idle',
          isLoading: false
        }))
        return false
      }

      // Login exitoso
      setAuthState(prev => ({ ...prev, loginStep: 'redirecting' }))

      if (redirectOnSuccess) {
        // Obtener la sesión actualizada para determinar el rol
        let userRole: string | undefined
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 400))
          try {
            const response = await fetch('/api/auth/session', { cache: 'no-store' })
            const sessionData = await response.json()
            console.log(`[AUTH] Session attempt ${i + 1}:`, JSON.stringify(sessionData?.user))
            userRole = sessionData?.user?.role
            if (userRole) break
          } catch (e) {
            console.warn(`[AUTH] Session fetch attempt ${i + 1} failed:`, e)
          }
        }
        
        const redirectUrl = getRedirectUrl(userRole)
        console.log('[AUTH] Redirecting to:', redirectUrl)
        
        // Hard navigation para forzar recarga completa de sesión
        window.location.href = redirectUrl
        return true
      }

      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        loginStep: 'idle',
        error: null
      }))

      return true

    } catch (error) {
      console.error('[AUTH] Login error:', error)
      const authError = createAuthError(error)
      setAuthState(prev => ({
        ...prev,
        error: authError,
        loginStep: 'idle',
        isLoading: false
      }))

      return false
    }
  }, [validateCredentials, createAuthError, redirectOnSuccess, getRedirectUrl])

  // Función de logout optimizada
  const logout = useCallback(async (options: { redirect?: boolean } = {}) => {
    const { redirect = true } = options

    setAuthState(prev => ({ ...prev, isLoading: true }))

    try {
      await signOut({ 
        redirect: false,
        callbackUrl: '/login'
      })

      if (redirect) {
        router.push('/login')
      }

      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: null,
        loginStep: 'idle'
      }))

    } catch (error) {
      // En caso de error, forzar redirect
      if (redirect) {
        router.push('/login')
      }
      
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }, [router])

  // Función para limpiar errores
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }))
  }, [])

  // Computed values
  const isAuthenticated = status === 'authenticated' && !!session
  const canLogin = !authState.isLoading && authState.isOnline
  
  const loginProgress = (() => {
    switch (authState.loginStep) {
      case 'validating': return 25
      case 'authenticating': return 50
      case 'redirecting': return 100
      default: return 0
    }
  })()

  return {
    // Estados
    authState,
    session,
    isAuthenticated,
    
    // Funciones principales
    login,
    logout,
    
    // Funciones de utilidad
    clearError,
    validateCredentials,
    getRedirectUrl,
    
    // Estados específicos
    canLogin,
    loginProgress
  }
}

// Utilidades adicionales
export const AUTH_ERROR_MESSAGES = {
  NETWORK_OFFLINE: 'Sin conexión a internet',
  NETWORK_ERROR: 'Error de conexión',
  TIMEOUT: 'Tiempo de espera agotado',
  INVALID_CREDENTIALS: 'Credenciales incorrectas',
  ACCESS_DENIED: 'Acceso denegado',
  MISSING_FIELDS: 'Campos requeridos',
  INVALID_EMAIL: 'Email no válido',
  PASSWORD_TOO_SHORT: 'Contraseña muy corta',
  SERVER_CONFIG: 'Error de configuración',
  INTERNAL_ERROR: 'Error interno'
} as const

export const AUTH_SUGGESTIONS = {
  NETWORK_OFFLINE: 'Verifica tu conexión a internet',
  NETWORK_ERROR: 'Revisa tu conexión y vuelve a intentar',
  TIMEOUT: 'La conexión es lenta, intenta de nuevo',
  INVALID_CREDENTIALS: 'Verifica tu email y contraseña',
  ACCESS_DENIED: 'Contacta al administrador',
  MISSING_FIELDS: 'Completa todos los campos',
  INVALID_EMAIL: 'Ingresa un email válido',
  PASSWORD_TOO_SHORT: 'Usa al menos 6 caracteres',
  SERVER_CONFIG: 'Contacta al soporte técnico',
  INTERNAL_ERROR: 'Intenta de nuevo en unos momentos'
} as const

// Hook para detectar estado de sesión
export function useSessionStatus() {
  const { data: session, status } = useSession()
  
  return {
    session,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    isUnauthenticated: status === 'unauthenticated',
    user: session?.user,
    role: session?.user?.role
  }
}
/**
 * Hook para protección de rutas por rol
 * Verifica que el usuario tenga el rol correcto para acceder a una ruta
 */

'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

type Role = 'ADMIN' | 'TECHNICIAN' | 'CLIENT'

interface UseRoleProtectionOptions {
  allowedRoles: Role[]
  redirectTo?: string
  onUnauthorized?: () => void
}

interface UseRoleProtectionReturn {
  session: any
  status: 'loading' | 'authenticated' | 'unauthenticated'
  isAuthorized: boolean
  isLoading: boolean
  userRole: Role | null
}

/**
 * Hook para proteger rutas según el rol del usuario
 * 
 * @example
 * ```tsx
 * function AdminPage() {
 *   const { isAuthorized, isLoading } = useRoleProtection({ 
 *     allowedRoles: ['ADMIN'] 
 *   })
 *   
 *   if (isLoading) return <Loading />
 *   if (!isAuthorized) return null // Ya redirigió
 *   
 *   return <div>Admin Content</div>
 * }
 * ```
 */
export function useRoleProtection({
  allowedRoles,
  redirectTo = '/unauthorized',
  onUnauthorized,
}: UseRoleProtectionOptions): UseRoleProtectionReturn {
  const { data: session, status } = useSession()
  const router = useRouter()

  const userRole = session?.user?.role as Role | null
  const isAuthorized = userRole ? allowedRoles.includes(userRole) : false
  const isLoading = status === 'loading'

  useEffect(() => {
    // No hacer nada mientras está cargando
    if (status === 'loading') return

    // Si no hay sesión, redirigir a login
    if (!session) {
      router.push('/login')
      return
    }

    // Si el rol no está permitido, ejecutar callback y redirigir
    if (!isAuthorized) {
      if (onUnauthorized) {
        onUnauthorized()
      }
      router.push(redirectTo)
      return
    }
  }, [session, status, isAuthorized, router, redirectTo, onUnauthorized])

  return {
    session,
    status,
    isAuthorized,
    isLoading,
    userRole,
  }
}

/**
 * Hook simplificado para proteger rutas de admin
 */
export function useAdminProtection() {
  return useRoleProtection({ allowedRoles: ['ADMIN'] })
}

/**
 * Hook simplificado para proteger rutas de técnico
 */
export function useTechnicianProtection() {
  return useRoleProtection({ allowedRoles: ['TECHNICIAN', 'ADMIN'] })
}

/**
 * Hook simplificado para proteger rutas de cliente
 */
export function useClientProtection() {
  return useRoleProtection({ allowedRoles: ['CLIENT'] })
}

/**
 * Hook para verificar si el usuario tiene un rol específico
 */
export function useHasRole(role: Role): boolean {
  const { data: session } = useSession()
  return session?.user?.role === role
}

/**
 * Hook para verificar si el usuario tiene alguno de los roles especificados
 */
export function useHasAnyRole(roles: Role[]): boolean {
  const { data: session } = useSession()
  const userRole = session?.user?.role as Role | null
  return userRole ? roles.includes(userRole) : false
}

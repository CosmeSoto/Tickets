'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'

const BYPASS_PATHS = [
  '/maintenance',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/help/',
]

function isBypassPath(path: string): boolean {
  if (path === '/') return false
  return BYPASS_PATHS.some(p => path.startsWith(p))
}

/**
 * Redirige a /maintenance cuando el modo mantenimiento está activo
 * y el usuario no es administrador con acceso permitido.
 */
export function MaintenanceGuard() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const checkedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!pathname || isBypassPath(pathname)) return
    if (status === 'loading') return

    const checkKey = `${pathname}:${status}:${session?.user?.id ?? 'anon'}`
    if (checkedRef.current === checkKey) return

    void (async () => {
      try {
        const res = await fetch('/api/config/maintenance', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!data.enabled) {
          checkedRef.current = checkKey
          return
        }

        const user = session?.user as
          | { role?: string; isSuperAdmin?: boolean }
          | undefined

        const isSuperAdmin = user?.isSuperAdmin === true
        const isAdmin = user?.role === 'ADMIN'

        if (isSuperAdmin) {
          checkedRef.current = checkKey
          return
        }

        if (data.allowAdmins && isAdmin) {
          checkedRef.current = checkKey
          return
        }

        if (pathname.startsWith('/admin/settings')) {
          checkedRef.current = checkKey
          return
        }

        checkedRef.current = checkKey
        router.replace('/maintenance')
      } catch {
        /* no bloquear si falla la consulta */
      }
    })()
  }, [pathname, status, session?.user?.id, session?.user?.role, router, (session?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin])

  return null
}

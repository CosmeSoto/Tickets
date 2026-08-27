'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Envuelve useSession() para blindar páginas/formularios del "parpadeo" que produce
 * NextAuth cada vez que revalida el JWT en segundo plano: el poll de sesión (cada 5 min),
 * el refetch al enfocar la ventana, y sobre todo los `update()` de SessionTimeoutMonitor
 * (cada ~1-2 min mientras hay actividad — ver role-dashboard-layout.tsx) ponen
 * `status: 'loading'` en TODA la app durante la revalidación, no solo la primera vez.
 *
 * Sin este blindaje, cualquier página que hace `if (status === 'loading') return <Skeleton/>`
 * remonta su contenido cada vez que eso ocurre — perdiendo el formulario en curso y dando
 * la sensación de que "la página se refresca sola" mientras se trabaja.
 *
 * Con este hook, `status` solo es 'loading' antes de la primera autenticación exitosa;
 * después queda fijo en 'authenticated' (u 'unauthenticated' si la sesión de verdad se
 * pierde) aunque NextAuth revalide en segundo plano.
 *
 * Uso: reemplazo directo de `useSession()` — misma forma de retorno.
 */
export function useAuthReady() {
  const session = useSession()
  const hasAuthenticated = useRef(false)

  useEffect(() => {
    if (session.status === 'authenticated') hasAuthenticated.current = true
  }, [session.status])

  const status =
    session.status === 'loading' && hasAuthenticated.current ? 'authenticated' : session.status

  return { ...session, status } as typeof session
}

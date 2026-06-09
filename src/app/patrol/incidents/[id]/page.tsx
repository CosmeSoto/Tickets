'use client'

import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

/**
 * Redirige al detalle de ticket correspondiente según el rol del usuario.
 * - CLIENT → /client/tickets/[id]
 * - TECHNICIAN/ADMIN → /admin/tickets/[id]
 */
export default function PatrolIncidentDetailRedirect() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    const role = session.user.role
    if (role === 'CLIENT') {
      router.replace(`/client/tickets/${id}`)
    } else {
      router.replace(`/admin/tickets/${id}`)
    }
  }, [session, status, router, id])

  return null
}

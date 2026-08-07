'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirección a la página de perfil unificada
 * Todos los usuarios (clientes, técnicos, admins) usan /profile
 */
export default function ClientProfilePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/profile')
  }, [router])

  return (
    <div className='flex items-center justify-center h-screen'>
      <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
    </div>
  )
}

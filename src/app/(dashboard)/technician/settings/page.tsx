'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirección a la página de configuración unificada
 * Todas las configuraciones de usuario están centralizadas en /settings
 */
export default function TechnicianSettingsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/settings')
  }, [router])

  return (
    <div className='flex items-center justify-center h-screen'>
      <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
    </div>
  )
}

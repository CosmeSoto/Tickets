'use client'

// Las estadísticas del técnico ahora están integradas en la página de Categorías
// como un panel colapsable "Mi Rendimiento". Esta ruta redirige para evitar duplicidad.
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function TechnicianStatsRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/technician/categories')
  }, [router])
  return null
}

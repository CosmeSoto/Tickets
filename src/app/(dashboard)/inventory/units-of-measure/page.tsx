'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Catálogos viven en Configuración de Inventario (Por área → Catálogos/Bodegas). */
export default function UnitsOfMeasureRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/settings/inventory')
  }, [router])
  return null
}

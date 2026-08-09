'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function EquipmentTypesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/admin/settings/inventory')
  }, [router])
  return null
}

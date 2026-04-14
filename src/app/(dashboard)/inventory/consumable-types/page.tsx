'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ConsumableTypesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/inventory/catalogs?tab=consumable-types') }, [router])
  return null
}

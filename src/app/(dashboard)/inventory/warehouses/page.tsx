'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function WarehousesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/inventory/settings')
  }, [router])
  return null
}

'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LicenseTypesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/inventory/catalogs?tab=license-types') }, [router])
  return null
}

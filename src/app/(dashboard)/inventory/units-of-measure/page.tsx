'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UnitsOfMeasureRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/inventory/catalogs?tab=units-of-measure') }, [router])
  return null
}

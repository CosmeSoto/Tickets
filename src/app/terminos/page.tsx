'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RedirectToTerms() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/help/terms')
  }, [router])

  return null
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RedirectToPrivacy() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/help/privacy')
  }, [router])

  return null
}

'use client'

import { useEffect } from 'react'

interface DynamicFaviconProps {
  faviconUrl?: string
}

export function DynamicFavicon({ faviconUrl }: DynamicFaviconProps) {
  useEffect(() => {
    if (!faviconUrl) return

    // Remove existing favicons
    const existingLinks = document.querySelectorAll('link[rel*="icon"]')
    existingLinks.forEach(link => link.remove())

    // Add new favicon
    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = faviconUrl
    document.head.appendChild(link)

    // Also add apple touch icon for iOS
    const appleLink = document.createElement('link')
    appleLink.rel = 'apple-touch-icon'
    appleLink.href = faviconUrl
    document.head.appendChild(appleLink)
  }, [faviconUrl])

  return null
}

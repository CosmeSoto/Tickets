'use client'

import { useEffect, useState } from 'react'

interface LandingContent {
  faviconUrl?: string
}

export function GlobalFavicon() {
  const [faviconUrl, setFaviconUrl] = useState<string | undefined>()

  useEffect(() => {
    console.log('[GlobalFavicon] Fetching landing page...')
    fetch('/api/public/landing-page')
      .then(res => res.json())
      .then(data => {
        console.log('[GlobalFavicon] Data received:', data)
        console.log('[GlobalFavicon] Content:', data.content)
        if (data.content?.faviconUrl) {
          console.log('[GlobalFavicon] Setting favicon URL:', data.content.faviconUrl)
          setFaviconUrl(data.content.faviconUrl)
        } else {
          console.log('[GlobalFavicon] No favicon URL found in content')
        }
      })
      .catch(err => console.error('[GlobalFavicon] Error loading favicon:', err))
  }, [])

  useEffect(() => {
    console.log('[GlobalFavicon] faviconUrl changed:', faviconUrl)
    if (!faviconUrl) return

    console.log('[GlobalFavicon] Updating favicon...')
    const existingLinks = document.querySelectorAll(
      'link[rel*="icon"], link[rel*="apple-touch-icon"]'
    )
    console.log('[GlobalFavicon] Removing existing favicon links:', existingLinks.length)
    existingLinks.forEach(link => link.remove())

    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = faviconUrl
    link.type = 'image/x-icon'
    document.head.appendChild(link)

    const appleLink = document.createElement('link')
    appleLink.rel = 'apple-touch-icon'
    appleLink.href = faviconUrl
    document.head.appendChild(appleLink)

    const shortcutLink = document.createElement('link')
    shortcutLink.rel = 'shortcut icon'
    shortcutLink.href = faviconUrl
    document.head.appendChild(shortcutLink)

    console.log('[GlobalFavicon] Favicon links added successfully')
  }, [faviconUrl])

  return null
}

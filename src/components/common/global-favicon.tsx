'use client'

import { useEffect, useState } from 'react'

interface LandingContent {
  faviconUrl?: string
}

export function GlobalFavicon() {
  const [faviconUrl, setFaviconUrl] = useState<string | undefined>()

  useEffect(() => {
    fetch('/api/public/landing-page')
      .then(res => res.json())
      .then(data => {
        if (data.content?.faviconUrl) {
          setFaviconUrl(data.content.faviconUrl)
        }
      })
      .catch(err => console.error('Error loading favicon:', err))
  }, [])

  useEffect(() => {
    if (!faviconUrl) return

    const existingLinks = document.querySelectorAll(
      'link[rel*="icon"], link[rel*="apple-touch-icon"]'
    )
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
  }, [faviconUrl])

  return null
}

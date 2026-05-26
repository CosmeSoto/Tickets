'use client'

import { useEffect, useState } from 'react'

interface DynamicPageTitleProps {
  defaultTitle?: string
}

export function DynamicPageTitle({
  defaultTitle = 'Sistema de Tickets - Soporte Técnico',
}: DynamicPageTitleProps) {
  const [title, setTitle] = useState<string>(defaultTitle)

  useEffect(() => {
    fetch('/api/public/landing-page')
      .then(res => res.json())
      .then(data => {
        if (data.content?.metaTitle) {
          setTitle(data.content.metaTitle)
        }
      })
      .catch(err => console.error('Error loading page title:', err))
  }, [])

  useEffect(() => {
    document.title = title
  }, [title])

  return null
}

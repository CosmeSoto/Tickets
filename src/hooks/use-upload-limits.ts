'use client'

import { useEffect, useState } from 'react'

const DEFAULT_MAX_MB = 10
const DEFAULT_PERSONAL_IMAGE_MAX_MB = 5

/**
 * Tamaño máximo de archivo (MB) desde Admin → Seguridad.
 */
export function useUploadLimits() {
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(DEFAULT_MAX_MB)
  const [maxPersonalImageSizeMB, setMaxPersonalImageSizeMB] = useState(
    DEFAULT_PERSONAL_IMAGE_MAX_MB
  )
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/config/upload-limits')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (typeof d?.maxFileSizeMB === 'number' && d.maxFileSizeMB > 0) {
          setMaxFileSizeMB(d.maxFileSizeMB)
        }
        if (typeof d?.maxPersonalImageSizeMB === 'number' && d.maxPersonalImageSizeMB > 0) {
          setMaxPersonalImageSizeMB(d.maxPersonalImageSizeMB)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  return { maxFileSizeMB, maxPersonalImageSizeMB, loaded }
}

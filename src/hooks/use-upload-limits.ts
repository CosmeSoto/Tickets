'use client'

import { useEffect, useState } from 'react'

const DEFAULT_MAX_MB = 10

/**
 * Tamaño máximo de archivo (MB) desde Admin → Seguridad.
 */
export function useUploadLimits() {
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(DEFAULT_MAX_MB)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/config/upload-limits')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (typeof d?.maxFileSizeMB === 'number' && d.maxFileSizeMB > 0) {
          setMaxFileSizeMB(d.maxFileSizeMB)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  return { maxFileSizeMB, loaded }
}

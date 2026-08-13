'use client'

import { useEffect, useState } from 'react'

const DEFAULT_MIN = 8

/**
 * Longitud mínima de contraseña desde Admin → Seguridad (/api/auth/password-policy).
 */
export function usePasswordPolicy() {
  const [minLength, setMinLength] = useState(DEFAULT_MIN)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/auth/password-policy')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (typeof d?.minLength === 'number' && d.minLength > 0) {
          setMinLength(d.minLength)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  return { minLength, loaded }
}

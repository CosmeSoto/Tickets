'use client'

import { useEffect } from 'react'

/**
 * Último respaldo — solo se activa si el layout raíz mismo falla (muy poco
 * común; el boundary normal es (dashboard)/error.tsx). Al reemplazar el
 * layout raíz, Next exige que este archivo traiga su propio <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang='es'>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Ocurrió un error
            </h1>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              La aplicación no pudo cargar. Intenta de nuevo o recarga la página.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: 6,
                border: 'none',
                background: '#111827',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}

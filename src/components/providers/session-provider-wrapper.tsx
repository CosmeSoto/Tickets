'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect } from 'react'

/**
 * Wrapper del SessionProvider que suprime errores cosméticos de NextAuth
 * durante el desarrollo con Hot Reload
 */
export function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Suprimir errores cosméticos de NextAuth en desarrollo
    if (process.env.NODE_ENV === 'development') {
      const originalError = console.error
      console.error = (...args: any[]) => {
        // Filtrar errores conocidos de NextAuth + Hot Reload
        const errorString = args.join(' ')
        
        // Lista de errores cosméticos a suprimir
        const cosmeticErrors = [
          'CLIENT_FETCH_ERROR',
          'Cannot convert undefined or null to object',
          '[next-auth][error]',
        ]
        
        // Si el error contiene alguno de los patrones cosméticos, no mostrarlo
        if (cosmeticErrors.some(pattern => errorString.includes(pattern))) {
          return
        }
        
        // Para otros errores, mostrarlos normalmente
        originalError.apply(console, args)
      }
      
      // Cleanup: restaurar console.error original al desmontar
      return () => {
        console.error = originalError
      }
    }
    return undefined
  }, [])

  return (
    <SessionProvider
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
    >
      {children}
    </SessionProvider>
  )
}

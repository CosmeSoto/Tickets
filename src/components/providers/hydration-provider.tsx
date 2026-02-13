'use client'

import { useEffect, useState } from 'react'

interface HydrationProviderProps {
  children: React.ReactNode
}

export function HydrationProvider({ children }: HydrationProviderProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Renderizar inmediatamente en el servidor y cliente
  // Solo usar el estado para evitar warnings de hidratación
  return <div suppressHydrationWarning>{children}</div>
}

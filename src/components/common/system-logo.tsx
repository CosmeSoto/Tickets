'use client'

import { useEffect, useState } from 'react'
import { useSystemLogo } from '@/hooks/use-system-logo'
import { Building2 } from 'lucide-react'

interface SystemLogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () => {
      const theme = localStorage.getItem('theme') || 'system'
      if (theme === 'dark') { setIsDark(true); return }
      if (theme === 'light') { setIsDark(false); return }
      // system
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    }

    check()

    // Escuchar cambios de tema del sistema
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', check)

    // Escuchar cambios manuales de tema (el hook useTheme guarda en localStorage)
    const onStorage = (e: StorageEvent) => { if (e.key === 'theme') check() }
    window.addEventListener('storage', onStorage)

    // También escuchar el evento custom que dispara el cambio de tema en la misma pestaña
    const onThemeChange = () => check()
    window.addEventListener('theme-changed', onThemeChange)

    return () => {
      mq.removeEventListener('change', check)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('theme-changed', onThemeChange)
    }
  }, [])

  return isDark
}

export function SystemLogo({ className = '', showText = true, size = 'md' }: SystemLogoProps) {
  const { lightUrl, darkUrl, companyName, loading } = useSystemLogo()
  const isDark = useIsDark()

  // En modo oscuro usar logo oscuro (versión blanca/clara), con fallback al claro
  // En modo claro usar logo claro (versión oscura/color), con fallback al oscuro
  const logoUrl = isDark ? (darkUrl || lightUrl) : (lightUrl || darkUrl)

  const sizeClasses = { sm: 'h-8', md: 'h-10', lg: 'h-12', xl: 'h-16' }
  const textSizes = { sm: 'text-base', md: 'text-lg', lg: 'text-xl', xl: 'text-2xl' }

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`animate-pulse bg-muted rounded ${sizeClasses[size]} w-32`} />
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={companyName}
          className={`${sizeClasses[size]} w-auto object-contain`}
        />
      ) : (
        <>
          <Building2 className={`${sizeClasses[size]} w-auto text-primary`} />
          {showText && <span className={`font-semibold ${textSizes[size]}`}>{companyName}</span>}
        </>
      )}
    </div>
  )
}

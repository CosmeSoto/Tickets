'use client'

import { useSystemLogo } from '@/hooks/use-system-logo'
import { useTheme } from 'next-themes'
import { Building2 } from 'lucide-react'

interface SystemLogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SystemLogo({ className = '', showText = true, size = 'md' }: SystemLogoProps) {
  const { lightUrl, darkUrl, companyName, loading } = useSystemLogo()
  const { theme, systemTheme } = useTheme()
  
  // Determinar el tema actual
  const currentTheme = theme === 'system' ? systemTheme : theme
  const isDark = currentTheme === 'dark'
  
  // Seleccionar el logo apropiado
  const logoUrl = isDark ? (darkUrl || lightUrl) : (lightUrl || darkUrl)
  
  // Tamaños
  const sizeClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
  }
  
  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  }

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
          <Building2 className={`${sizeClasses[size]} w-${sizeClasses[size]} text-primary`} />
          {showText && <span className={`font-semibold ${textSizes[size]}`}>{companyName}</span>}
        </>
      )}
    </div>
  )
}

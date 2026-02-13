'use client'

import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark' | 'system'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  // Evitar hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Cargar tema guardado del localStorage
    const savedTheme = localStorage.getItem('theme') as Theme
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      setTheme(savedTheme)
      applyTheme(savedTheme)
    } else {
      // Si no hay tema guardado, usar system por defecto
      setTheme('system')
      applyTheme('system')
    }

    // Escuchar cambios en las preferencias del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [mounted, theme])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement
    
    // Remover clases existentes
    root.classList.remove('light', 'dark')
    
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(systemTheme)
      root.setAttribute('data-theme', systemTheme)
    } else {
      root.classList.add(newTheme)
      root.setAttribute('data-theme', newTheme)
    }
  }

  const changeTheme = async (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    applyTheme(newTheme)

    // Guardar en base de datos
    try {
      await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: newTheme }),
      })
    } catch (error) {
      console.error('Error saving theme preference:', error)
    }
  }

  // No renderizar hasta que esté montado para evitar hydration issues
  if (!mounted) {
    return {
      theme: 'system' as Theme,
      setTheme: () => {}
    }
  }

  return {
    theme,
    setTheme: changeTheme
  }
}
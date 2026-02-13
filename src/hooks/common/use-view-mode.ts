/**
 * Hook para manejar cambio entre vistas (cards/list/table)
 * Persiste la preferencia del usuario en localStorage
 * 
 * @example
 * ```tsx
 * const { viewMode, setViewMode, availableModes } = useViewMode('cards', {
 *   storageKey: 'users-view-mode',
 *   availableModes: ['cards', 'list', 'table']
 * })
 * 
 * return (
 *   <>
 *     <ViewToggle mode={viewMode} onChange={setViewMode} />
 *     {viewMode === 'cards' && <CardGrid data={data} />}
 *     {viewMode === 'list' && <ListView data={data} />}
 *     {viewMode === 'table' && <DataTable data={data} />}
 *   </>
 * )
 * ```
 */

import { useState, useEffect, useCallback } from 'react'

export type ViewMode = 'cards' | 'list' | 'table' | 'tree'

export interface UseViewModeOptions {
  storageKey?: string
  availableModes?: ViewMode[]
  responsive?: boolean
  mobileMode?: ViewMode
}

export interface UseViewModeReturn {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  availableModes: ViewMode[]
  isMobile: boolean
}

const DEFAULT_AVAILABLE_MODES: ViewMode[] = ['cards', 'list', 'table']

export function useViewMode(
  defaultMode: ViewMode = 'list',
  options: UseViewModeOptions = {}
): UseViewModeReturn {
  const {
    storageKey = 'view-mode',
    availableModes = DEFAULT_AVAILABLE_MODES,
    responsive = true,
    mobileMode = 'list'
  } = options

  // Detectar si es mobile
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Cargar modo desde localStorage o usar default
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored && availableModes.includes(stored as ViewMode)) {
        return stored as ViewMode
      }
    } catch (error) {
      console.error('[useViewMode] Error loading from localStorage:', error)
    }

    return defaultMode
  })

  // Auto-switch a mobile mode si está habilitado responsive
  const effectiveViewMode = responsive && isMobile ? mobileMode : viewMode

  // Setear modo y persistir en localStorage
  const setViewMode = useCallback((mode: ViewMode) => {
    if (!availableModes.includes(mode)) {
      console.warn(`[useViewMode] Mode "${mode}" is not available. Available modes:`, availableModes)
      return
    }

    setViewModeState(mode)

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, mode)
      } catch (error) {
        console.error('[useViewMode] Error saving to localStorage:', error)
      }
    }
  }, [storageKey, availableModes])

  return {
    viewMode: effectiveViewMode,
    setViewMode,
    availableModes,
    isMobile
  }
}

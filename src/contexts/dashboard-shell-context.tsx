'use client'

/**
 * Shell compartido (sidebar + header) para rutas /admin, /technician y /client.
 * Las páginas hijas actualizan título/subtítulo/acciones vía setPageMeta en lugar de envolver RoleDashboardLayout.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'

export type DashboardPageMeta = {
  title?: string
  subtitle?: ReactNode
  headerActions?: ReactNode
}

type SetPageMetaFn = (patch: Partial<DashboardPageMeta> | null) => void

const DashboardShellSetterContext = createContext<SetPageMetaFn | null>(null)

function metaShallowEqual(a: DashboardPageMeta, b: DashboardPageMeta): boolean {
  return a.title === b.title && a.subtitle === b.subtitle && a.headerActions === b.headerActions
}

export function DashboardShellProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<DashboardPageMeta>({})

  const setPageMeta = useCallback((patch: Partial<DashboardPageMeta> | null) => {
    if (patch === null) {
      setMeta({})
      return
    }
    setMeta(prev => {
      const next = { ...prev, ...patch }
      return metaShallowEqual(prev, next) ? prev : next
    })
  }, [])

  const value = useMemo(() => setPageMeta, [setPageMeta])

  return (
    <DashboardShellSetterContext.Provider value={value}>
      <RoleDashboardLayout
        title={meta.title}
        subtitle={meta.subtitle}
        headerActions={meta.headerActions}
      >
        {children}
      </RoleDashboardLayout>
    </DashboardShellSetterContext.Provider>
  )
}

/** Expuesto para ModuleLayout (modo auto / context). */
export function useDashboardShellSetter(): SetPageMetaFn | null {
  return useContext(DashboardShellSetterContext)
}

/**
 * Sincroniza el encabezado del shell con la página actual.
 * No vacía título/subtítulo al desmontar (evita flash / sensación de rebuild).
 * Solo limpia acciones del header que podrían quedar stale.
 */
export function useSyncDashboardPageMeta(meta: DashboardPageMeta): void {
  const setMeta = useContext(DashboardShellSetterContext)

  useEffect(() => {
    if (!setMeta) return
    setMeta(meta)
    return () => {
      setMeta({ headerActions: undefined })
    }
  }, [setMeta, meta.title, meta.subtitle, meta.headerActions])
}

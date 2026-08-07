/**
 * Layout unificado para dashboards por rol.
 * Orquesta shell (sidebar + header); la nav y el UI viven en módulos dedicados.
 */

'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useUserModules } from '@/hooks/use-user-modules'
import { DashboardSidebar } from '@/components/layout/dashboard-sidebar'
import { DashboardHeader } from '@/components/layout/dashboard-header'
import { SIDEBAR_COLLAPSED_KEY } from '@/components/layout/dashboard-nav-types'
import { buildRoleNavigation, roleHomeHref } from '@/components/layout/use-role-navigation'

interface RoleDashboardLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string | ReactNode
  headerActions?: ReactNode
}

export function RoleDashboardLayout({
  children,
  title,
  subtitle,
  headerActions,
}: RoleDashboardLayoutProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const isFirstNavigation = useRef(true)

  // Pulso visual al cambiar ruta SIN remount
  useEffect(() => {
    if (isFirstNavigation.current) {
      isFirstNavigation.current = false
      return
    }
    if (reduceMotion || !contentRef.current) return
    contentRef.current.animate(
      [
        { opacity: 0.9, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }
    )
  }, [pathname, reduceMotion])

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true') {
        setCollapsed(true)
      }
    } catch {
      // localStorage no disponible
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const railMode = collapsed && isDesktop

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  const {
    tickets: hasTickets,
    inventory: hasInventory,
    patrols: hasPatrols,
    news: hasNews,
    forms: hasForms,
    canRequestAssets,
    canManageInventory: canManageInventoryFromModules,
    canManageNews: canManageNewsFromModules,
    credentials: hasCredentials,
  } = useUserModules()

  if (status === 'unauthenticated') {
    return null
  }

  if (status === 'loading' || !session) {
    return (
      <div className='min-h-screen bg-background'>
        <div className='flex items-center justify-center h-screen'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
        </div>
      </div>
    )
  }

  const canManageNews = canManageNewsFromModules || (session.user as any)?.canManageNews === true
  const userRole = session.user.role as string
  const canManageInventory =
    canManageInventoryFromModules || (session.user as any).canManageInventory
  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  const navigation = buildRoleNavigation({
    userRole,
    isSuperAdmin,
    canManageInventory,
    canManageNews,
    hasTickets,
    hasInventory,
    hasPatrols,
    hasNews,
    hasForms,
    hasCredentials,
    canRequestAssets,
  })

  const homeHref = roleHomeHref(userRole)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className='min-h-screen bg-background'>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key='sidebar-overlay'
            className='fixed inset-0 z-40 bg-black/50 lg:hidden'
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      <DashboardSidebar
        navigation={navigation}
        pathname={pathname}
        homeHref={homeHref}
        sidebarOpen={sidebarOpen}
        railMode={railMode}
        collapsed={collapsed}
        onClose={closeSidebar}
        onToggleCollapsed={toggleCollapsed}
      />

      <div
        className={cn(
          'transition-[padding] duration-300 ease-in-out',
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        <DashboardHeader
          title={title}
          subtitle={subtitle}
          headerActions={headerActions}
          navigation={navigation}
          pathname={pathname}
          homeHref={homeHref}
          user={{
            name: session.user.name,
            email: session.user.email,
            avatar: session.user.avatar,
          }}
          userRole={userRole}
          isSuperAdmin={isSuperAdmin}
          canManageInventory={canManageInventory}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className='p-4 sm:p-8'>
          <div ref={contentRef}>{children}</div>
        </main>
      </div>
    </div>
  )
}

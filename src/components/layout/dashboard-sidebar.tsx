'use client'

import Link from 'next/link'
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { PanelLeft, PanelLeftClose, X } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SystemLogo } from '@/components/common/system-logo'
import { cn } from '@/lib/utils'
import { DashboardNavItemComponent } from '@/components/layout/dashboard-nav-item'
import { NAV_EASE, SIDEBAR_RAIL_WIDTH, type DashboardNavItem } from '@/components/layout/dashboard-nav-types'
import { collectLeafHrefs } from '@/components/layout/nav-active'

type DashboardSidebarProps = {
  navigation: DashboardNavItem[]
  pathname: string | null
  homeHref: string
  sidebarOpen: boolean
  railMode: boolean
  collapsed: boolean
  onClose: () => void
  onToggleCollapsed: () => void
}

export function DashboardSidebar({
  navigation,
  pathname,
  homeHref,
  sidebarOpen,
  railMode,
  collapsed,
  onClose,
  onToggleCollapsed,
}: DashboardSidebarProps) {
  const reduceMotion = useReducedMotion()
  const leafHrefs = collectLeafHrefs(navigation)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border',
        'w-64 transition-[width,transform] duration-300 ease-in-out',
        collapsed && SIDEBAR_RAIL_WIDTH,
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0'
      )}
    >
      <div
        className={cn(
          'flex items-center h-20 border-b border-border flex-shrink-0',
          railMode ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        {!railMode && <div className='lg:hidden w-7' />}
        <Link
          href={homeHref}
          onClick={onClose}
          className={cn('flex justify-center min-w-0', railMode ? 'flex-none' : 'flex-1')}
          title='Inicio'
        >
          <SystemLogo size={railMode ? 'lg' : 'xl'} showText={!railMode} />
        </Link>
        <button
          onClick={onClose}
          className='lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground'
        >
          <X className='h-5 w-5' />
        </button>
        {!railMode && <div className='hidden lg:block w-7' />}
      </div>

      <nav
        className={cn(
          'flex-1 py-4 overflow-y-auto overflow-x-hidden',
          railMode ? 'px-2 space-y-1.5' : 'px-3 space-y-1'
        )}
      >
        <TooltipProvider delayDuration={200}>
          <LayoutGroup id='sidebar-nav'>
            {navigation.map(item => (
              <DashboardNavItemComponent
                key={item.name}
                item={item}
                pathname={pathname}
                onNavigate={onClose}
                collapsed={railMode}
                leafHrefs={leafHrefs}
              />
            ))}
          </LayoutGroup>
        </TooltipProvider>
      </nav>

      <div className='hidden lg:flex flex-shrink-0 border-t border-border p-2.5 justify-center'>
        <motion.button
          type='button'
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className='p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
          whileHover={reduceMotion ? undefined : { scale: 1.06 }}
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        >
          <motion.span
            key={collapsed ? 'expand' : 'collapse'}
            initial={reduceMotion ? false : { rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: NAV_EASE }}
            className='inline-flex'
          >
            {collapsed ? (
              <PanelLeft className='h-5 w-5' />
            ) : (
              <PanelLeftClose className='h-5 w-5' />
            )}
          </motion.span>
        </motion.button>
      </div>
    </aside>
  )
}

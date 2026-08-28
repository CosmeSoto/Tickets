'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { isLeafNavActive } from '@/components/layout/nav-active'
import {
  NAV_EASE,
  readOpenMenus,
  writeOpenMenu,
  type DashboardNavItem,
} from '@/components/layout/dashboard-nav-types'

/** Indicador activo: pill + barra lateral — mismos tokens primary */
function SidebarActiveIndicator({
  spring,
  rail = false,
}: {
  spring: { duration: number } | { type: 'spring'; stiffness: number; damping: number }
  rail?: boolean
}) {
  return (
    <>
      <motion.span
        layoutId='sidebar-active-indicator'
        className='absolute inset-0 rounded-lg bg-primary/10'
        transition={spring}
      />
      {!rail && (
        <motion.span
          layoutId='sidebar-active-bar'
          className='absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary'
          transition={spring}
        />
      )}
    </>
  )
}

/**
 * prefetch={false} + router.prefetch() en onMouseEnter en cada <Link> de
 * este archivo: por defecto Next.js precarga (RSC fetch) todo <Link> que
 * entra en el viewport. Como el sidebar completo es visible de entrada,
 * eso disparaba ~20-30 requests de prefetch en paralelo en cada carga de
 * página — de sobra para agotar el límite de conexiones del navegador y
 * retrasar varios segundos las llamadas de datos reales de la página
 * activa (visto en Credenciales: /api/credentials/vaults tardaba +25s en
 * siquiera salir). Con hover, solo se precarga lo que el usuario realmente
 * va a visitar, y sigue siendo casi instantáneo al hacer click.
 */
export function DashboardNavItemComponent({
  item,
  pathname,
  depth = 0,
  onNavigate,
  collapsed = false,
  leafHrefs = [],
}: {
  item: DashboardNavItem
  pathname: string | null
  depth?: number
  onNavigate?: () => void
  collapsed?: boolean
  leafHrefs?: string[]
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const children = item.children
    ? item.children.filter((child, index) => !(index === 0 && child.href === item.href))
    : undefined
  const hasChildren = children && children.length > 0

  const isDescendantActive = (navItem: DashboardNavItem): boolean => {
    if (navItem.children?.length) return navItem.children.some(isDescendantActive)
    return isLeafNavActive(navItem.href, pathname, leafHrefs)
  }

  const isDirectActive = hasChildren
    ? pathname === item.href || !!pathname?.startsWith(item.href + '/')
    : isLeafNavActive(item.href, pathname, leafHrefs)
  const isActive = isDirectActive || (hasChildren ? children!.some(isDescendantActive) : false)

  const [isOpen, setIsOpen] = useState(() => {
    if (isActive) return true
    if (!hasChildren) return false
    return !!readOpenMenus()[item.href]
  })

  const setOpenPersistent = (open: boolean) => {
    setIsOpen(open)
    if (hasChildren) writeOpenMenu(item.href, open)
  }

  useEffect(() => {
    if (isActive) setOpenPersistent(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reaccionar a isActive
  }, [isActive])

  const Icon = item.icon
  const indent = depth * 12
  const spring = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 28 }

  const itemClass = (active: boolean) =>
    cn(
      'relative flex items-center text-sm font-medium rounded-lg transition-colors',
      collapsed ? 'justify-center px-0 py-3' : 'pr-4 py-2',
      active ? 'text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    )

  const submenuVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.045,
        delayChildren: reduceMotion ? 0 : 0.04,
      },
    },
  }

  const submenuItemVariants = {
    hidden: { opacity: 0, x: reduceMotion ? 0 : -10 },
    show: {
      opacity: 1,
      x: 0,
      transition: { duration: reduceMotion ? 0 : 0.28, ease: NAV_EASE },
    },
  }

  if (collapsed) {
    if (!hasChildren) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              onClick={onNavigate}
              onMouseEnter={() => router.prefetch(item.href)}
              aria-label={item.name}
              className={itemClass(isActive)}
              prefetch={false}
            >
              {isActive && <SidebarActiveIndicator spring={spring} rail />}
              <Icon
                className={cn(
                  'relative z-10 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent side='right' sideOffset={8}>
            {item.name}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Popover
        open={flyoutOpen}
        onOpenChange={open => {
          setFlyoutOpen(open)
          if (open && children) {
            for (const child of children) router.prefetch(child.href)
          }
        }}
      >
        <Tooltip open={flyoutOpen ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type='button'
                aria-label={item.name}
                className={cn(itemClass(isActive), 'w-full')}
              >
                {isActive && <span className='absolute inset-0 rounded-lg bg-primary/10' />}
                <Icon
                  className={cn(
                    'relative z-10 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side='right' sideOffset={8}>
            {item.name}
          </TooltipContent>
        </Tooltip>
        <PopoverContent side='right' align='start' sideOffset={8} className='w-56 p-1'>
          <Link
            href={item.href}
            prefetch={false}
            onMouseEnter={() => router.prefetch(item.href)}
            onClick={() => {
              setFlyoutOpen(false)
              onNavigate?.()
            }}
            className='block px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-accent rounded-md'
          >
            {item.name}
          </Link>
          <div className='my-1 h-px bg-border' />
          {children!.map(child => {
            const ChildIcon = child.icon
            const childActive = isLeafNavActive(child.href, pathname, leafHrefs)
            return (
              <Link
                key={child.href + child.name}
                href={child.href}
                prefetch={false}
                onMouseEnter={() => router.prefetch(child.href)}
                onClick={() => {
                  setFlyoutOpen(false)
                  onNavigate?.()
                }}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                  childActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <ChildIcon className='h-3.5 w-3.5 flex-shrink-0' />
                {child.name}
              </Link>
            )
          })}
        </PopoverContent>
      </Popover>
    )
  }

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        onMouseEnter={() => router.prefetch(item.href)}
        style={{ paddingLeft: `${16 + indent}px` }}
        className={itemClass(isActive)}
        prefetch={false}
      >
        {isActive && <SidebarActiveIndicator spring={spring} />}
        <Icon
          className={cn(
            'relative z-10 h-4 w-4 mr-2.5 flex-shrink-0',
            isActive ? 'text-primary' : 'text-muted-foreground'
          )}
        />
        <span className='relative z-10'>{item.name}</span>
      </Link>
    )
  }

  return (
    <div>
      <div
        className={cn(
          'relative flex items-center text-sm font-medium rounded-lg transition-colors',
          isActive
            ? 'text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Link
          href={item.href}
          prefetch={false}
          onMouseEnter={() => router.prefetch(item.href)}
          onClick={() => {
            setOpenPersistent(true)
            onNavigate?.()
          }}
          style={{ paddingLeft: `${16 + indent}px` }}
          className='flex flex-1 items-center py-2 min-w-0 pr-1'
        >
          <Icon
            className={cn(
              'h-4 w-4 mr-2.5 flex-shrink-0',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <span className='truncate text-left'>{item.name}</span>
        </Link>
        <button
          type='button'
          aria-expanded={isOpen}
          aria-label={isOpen ? `Contraer ${item.name}` : `Expandir ${item.name}`}
          className='mr-2 p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground flex-shrink-0'
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            setOpenPersistent(!isOpen)
          }}
        >
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={spring}
            className='inline-flex'
          >
            <ChevronDown className='h-4 w-4' />
          </motion.span>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key={`submenu-${item.href}`}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { height: { duration: 0.34, ease: NAV_EASE }, opacity: { duration: 0.22 } }
            }
            className='overflow-hidden'
          >
            <motion.div
              className='mt-0.5 space-y-0.5 relative'
              style={{ marginLeft: `${20 + indent}px`, paddingLeft: '8px' }}
              variants={submenuVariants}
              initial='hidden'
              animate='show'
            >
              <motion.span
                aria-hidden
                className='absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-border origin-top'
                initial={reduceMotion ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.38, ease: NAV_EASE }}
              />
              {children!.map(child => (
                <motion.div key={child.href + child.name} variants={submenuItemVariants}>
                  <DashboardNavItemComponent
                    item={child}
                    pathname={pathname}
                    depth={depth + 1}
                    onNavigate={onNavigate}
                    collapsed={false}
                    leafHrefs={leafHrefs}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

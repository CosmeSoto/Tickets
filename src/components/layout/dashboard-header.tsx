'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { motion, useReducedMotion } from 'framer-motion'
import { ExternalLink, Globe, LogOut, Menu, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notifications } from '@/components/ui/notifications'
import { PushSubscriptionManager } from '@/components/notifications/push-subscription-manager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { getRoleLabel as getRoleLabelFn, getRoleColor } from '@/components/ui/role-badge'
import {
  buildDashboardBreadcrumbs,
  DashboardBreadcrumbs,
  type BreadcrumbItem,
} from '@/components/layout/dashboard-breadcrumbs'
import { NAV_EASE, type DashboardNavItem } from '@/components/layout/dashboard-nav-types'

type SessionUser = {
  name: string
  email?: string | null
  avatar?: string
}

type DashboardHeaderProps = {
  title?: string
  subtitle?: string | ReactNode
  headerActions?: ReactNode
  navigation: DashboardNavItem[]
  pathname: string | null
  homeHref: string
  user: SessionUser
  userRole: string
  isSuperAdmin: boolean
  canManageInventory: boolean
  onOpenSidebar: () => void
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function DashboardHeader({
  title,
  subtitle,
  headerActions,
  navigation,
  pathname,
  homeHref,
  user,
  userRole,
  isSuperAdmin,
  canManageInventory,
  onOpenSidebar,
}: DashboardHeaderProps) {
  const reduceMotion = useReducedMotion()

  const breadcrumbs = buildDashboardBreadcrumbs({
    pathname,
    navigation,
    homeHref,
    fallbackTitle: title,
  })
  const headerBreadcrumbs: BreadcrumbItem[] = breadcrumbs.length > 1 ? breadcrumbs : []

  const roleBadgeColor = getRoleColor(userRole, isSuperAdmin)
  const roleLabel =
    userRole === 'TECHNICIAN'
      ? canManageInventory
        ? 'Técnico · Gestor'
        : 'Técnico'
      : userRole === 'CLIENT'
        ? canManageInventory
          ? 'Cliente · Gestor'
          : getRoleLabelFn(userRole, isSuperAdmin)
        : getRoleLabelFn(userRole, isSuperAdmin)

  const handleLogout = async () => {
    await signOut({ redirect: false })
    window.location.href = '/login'
  }

  const utilityCluster = (
    <>
      <motion.div
        whileHover={reduceMotion ? undefined : { y: -1 }}
        transition={{ duration: 0.15 }}
      >
        <Link
          href='/?preview=true'
          target='_blank'
          rel='noopener noreferrer'
          title='Ver Página Pública'
          className='flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-md px-2 py-1.5 hover:bg-accent flex-shrink-0'
        >
          <Globe className='h-3.5 w-3.5 flex-shrink-0' />
          <span className='hidden sm:inline'>Página Pública</span>
          <ExternalLink className='h-3 w-3 opacity-60 hidden lg:inline' />
        </Link>
      </motion.div>

      <Notifications variant='bell' />
      <PushSubscriptionManager />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' className='relative h-9 w-9 rounded-full p-0'>
            <Avatar className='h-9 w-9'>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className='bg-primary/10 text-primary text-sm'>
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-56'>
          <DropdownMenuLabel>
            <div className='flex flex-col space-y-1'>
              <p className='text-sm font-medium leading-none'>{user.name}</p>
              <p className='text-xs leading-none text-muted-foreground'>{user.email}</p>
              <Badge className={`text-xs w-fit mt-1 ${roleBadgeColor}`}>{roleLabel}</Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href='/profile'>
              <User className='h-4 w-4 mr-2' />
              Mi Perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href='/settings'>
              <Settings className='h-4 w-4 mr-2' />
              Configuración Personal
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className='text-destructive'>
            <LogOut className='h-4 w-4 mr-2' />
            Cerrar Sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  return (
    <header className='sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80'>
      <div className='px-4 sm:px-8 py-3 sm:py-3.5 space-y-2.5'>
        {/* Fila 1: título + utilidades (nunca se aplastan entre sí) */}
        <div className='flex items-start justify-between gap-3'>
          <div className='flex items-start gap-3 min-w-0 flex-1'>
            <motion.button
              type='button'
              onClick={onOpenSidebar}
              className='lg:hidden mt-0.5 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0'
              whileTap={reduceMotion ? undefined : { scale: 0.92 }}
              aria-label='Abrir menú'
            >
              <Menu className='h-5 w-5' />
            </motion.button>
            <div className='min-w-0 flex-1 space-y-1'>
              <DashboardBreadcrumbs items={headerBreadcrumbs} className='hidden sm:flex' />
              {title ? (
                <motion.h1
                  key={title}
                  className='text-sm sm:text-xl font-bold text-foreground line-clamp-2 leading-tight break-words'
                  initial={reduceMotion ? false : { opacity: 0.55, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2, ease: NAV_EASE }}
                >
                  {title}
                </motion.h1>
              ) : null}
              {subtitle ? (
                <div className='hidden sm:block text-xs text-muted-foreground leading-snug line-clamp-2 break-words max-w-3xl'>
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>

          <div className='flex items-center gap-2 sm:gap-3 flex-shrink-0 pt-0.5'>
            {utilityCluster}
          </div>
        </div>

        {/* Fila 2: acciones de página — ancho completo, wrap sin aplastar el título */}
        {headerActions ? (
          <div className='flex flex-wrap items-center gap-2 min-w-0 w-full'>
            {headerActions}
          </div>
        ) : null}

        {headerBreadcrumbs.length > 0 && (
          <DashboardBreadcrumbs items={headerBreadcrumbs} className='sm:hidden pl-11' />
        )}
      </div>
    </header>
  )
}

/**
 * Layout unificado para dashboards por rol
 * Proporciona navegación y estructura consistente para ADMIN, TECHNICIAN y CLIENT
 */

'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import {
  LayoutDashboard,
  Ticket,
  Users,
  Settings,
  Shield,
  User,
  LogOut,
  Globe,
  Package,
  ChevronDown,
  BarChart3,
  FolderTree,
  Wrench,
  BookOpen,
  Monitor,
  HelpCircle,
  Menu,
  X,
  Database,
  FileSignature,
  FileText,
  Building2,
  Layers,
  ExternalLink,
  MapPin,
  ClipboardList,
  AlertTriangle,
  Newspaper,
  CalendarDays,
  PanelLeft,
  PanelLeftClose,
  KeyRound,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Notifications } from '@/components/ui/notifications'
import { PushSubscriptionManager } from '@/components/notifications/push-subscription-manager'
import { Button } from '@/components/ui/button'
import { SystemLogo } from '@/components/common/system-logo'
import {
  buildDashboardBreadcrumbs,
  DashboardBreadcrumbs,
} from '@/components/layout/dashboard-breadcrumbs'
import { collectLeafHrefs, isLeafNavActive } from '@/components/layout/nav-active'
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
import { useUserModules } from '@/hooks/use-user-modules'

interface RoleDashboardLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string | ReactNode
  headerActions?: ReactNode
}

interface NavItem {
  name: string
  href: string
  icon: any
  children?: NavItem[]
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

// Navegación por rol con submenús
const navigationByRole: Record<string, NavItem[]> = {
  ADMIN: [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    {
      name: 'Tickets',
      href: '/admin/tickets',
      icon: Ticket,
      children: [
        { name: 'Todos los Tickets', href: '/admin/tickets', icon: Ticket },
        { name: 'Reportes', href: '/admin/reports', icon: BarChart3 },
        { name: 'Categorías', href: '/admin/categories', icon: FolderTree },
        { name: 'Base de Conocimientos', href: '/admin/knowledge', icon: BookOpen },
        { name: 'Configuración', href: '/admin/settings/tickets', icon: Settings },
      ],
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Activos', href: '/inventory', icon: Monitor },
        { name: 'Solicitudes de Compras', href: '/inventory/asset-requests', icon: FileText },
        { name: 'Ventas', href: '/inventory/sales', icon: Database },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Contratos', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
        { name: 'Proveedores', href: '/inventory/suppliers', icon: Building2 },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
        { name: 'Configuración', href: '/admin/settings/inventory', icon: Settings },
      ],
    },
    {
      name: 'Rondas',
      href: '/admin/patrols',
      icon: Shield,
      children: [
        { name: 'Agenda', href: '/admin/patrols', icon: CalendarDays },
        { name: 'Checkpoints', href: '/admin/patrols/checkpoints', icon: MapPin },
        { name: 'Rutas', href: '/admin/patrols/routes', icon: ClipboardList },
        { name: 'Programación', href: '/admin/patrols/schedules', icon: ClipboardList },
        { name: 'Incidentes', href: '/admin/patrols/incidents', icon: AlertTriangle },
        { name: 'Reportes', href: '/admin/patrols/reports', icon: BarChart3 },
        { name: 'Configuración', href: '/admin/settings/patrols', icon: Settings },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/admin/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
    { name: 'Familias', href: '/admin/families', icon: Layers },
    { name: 'Usuarios', href: '/admin/users', icon: Users },
    { name: 'Auditoría', href: '/admin/audit', icon: Shield },
    { name: 'Página Pública', href: '/admin/help-config', icon: Globe },
    { name: 'Configuración Sistema', href: '/admin/settings', icon: Settings },
  ],

  // Técnico SIN gestión de inventario: tickets + sus equipos asignados
  TECHNICIAN: [
    { name: 'Dashboard', href: '/technician', icon: LayoutDashboard },
    {
      name: 'Tickets',
      href: '/technician/tickets',
      icon: Ticket,
      children: [
        { name: 'Mis Tickets', href: '/technician/tickets', icon: Ticket },
        { name: 'Estadísticas', href: '/technician/stats', icon: BarChart3 },
        { name: 'Categorías', href: '/technician/categories', icon: FolderTree },
        { name: 'Base de Conocimientos', href: '/technician/knowledge', icon: BookOpen },
      ],
    },
    {
      name: 'Mis Equipos',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Mis Activos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
      ],
    },
    {
      name: 'Rondas',
      href: '/admin/patrols',
      icon: Shield,
      children: [
        { name: 'Agenda', href: '/admin/patrols', icon: CalendarDays },
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
        { name: 'Reportes', href: '/admin/patrols/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],

  // Técnico CON gestión de inventario: tickets + inventario operativo de sus familias
  TECHNICIAN_MANAGER: [
    { name: 'Dashboard', href: '/technician', icon: LayoutDashboard },
    {
      name: 'Tickets',
      href: '/technician/tickets',
      icon: Ticket,
      children: [
        { name: 'Mis Tickets', href: '/technician/tickets', icon: Ticket },
        { name: 'Estadísticas', href: '/technician/stats', icon: BarChart3 },
        { name: 'Categorías', href: '/technician/categories', icon: FolderTree },
        { name: 'Base de Conocimientos', href: '/technician/knowledge', icon: BookOpen },
      ],
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Activos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Contratos', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Rondas',
      href: '/admin/patrols',
      icon: Shield,
      children: [
        { name: 'Agenda', href: '/admin/patrols', icon: CalendarDays },
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
        { name: 'Reportes', href: '/admin/patrols/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],

  // Cliente: sus tickets + sus equipos asignados + mantenimientos
  CLIENT: [
    { name: 'Dashboard', href: '/client', icon: LayoutDashboard },
    {
      name: 'Mis Tickets',
      href: '/client/tickets',
      icon: Ticket,
      children: [
        { name: 'Ver Tickets', href: '/client/tickets', icon: Ticket },
        { name: 'Base de Conocimientos', href: '/knowledge', icon: BookOpen },
        { name: 'Centro de Ayuda', href: '/client/help', icon: HelpCircle },
      ],
    },
    {
      name: 'Mis Equipos',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Mis Activos', href: '/inventory', icon: Monitor },
        { name: 'Mis Suscripciones', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
      ],
    },
    {
      name: 'Mis Rondas',
      href: '/patrol',
      icon: Shield,
      children: [
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
      ],
    },
    // Noticias: solo si canManageNews (ver abajo en filtro). Feed de lectura va en dashboard.
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],

  // Cliente CON gestión de inventario: tickets + inventario operativo de sus familias
  CLIENT_MANAGER: [
    { name: 'Dashboard', href: '/client', icon: LayoutDashboard },
    {
      name: 'Mis Tickets',
      href: '/client/tickets',
      icon: Ticket,
      children: [
        { name: 'Ver Tickets', href: '/client/tickets', icon: Ticket },
        { name: 'Base de Conocimientos', href: '/knowledge', icon: BookOpen },
        { name: 'Centro de Ayuda', href: '/client/help', icon: HelpCircle },
      ],
    },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Activos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Contratos', href: '/inventory/contracts', icon: FileSignature },
        { name: 'Actas', href: '/inventory/acts', icon: FileText },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
      ],
    },
    {
      name: 'Mis Rondas',
      href: '/patrol',
      icon: Shield,
      children: [
        { name: 'Mis Rondas', href: '/patrol', icon: MapPin },
        { name: 'Mis Incidentes', href: '/patrol/incidents', icon: AlertTriangle },
      ],
    },
    {
      name: 'Noticias',
      href: '/admin/news',
      icon: Newspaper,
    },
    {
      name: 'Documentos',
      href: '/forms',
      icon: FileText,
    },
    {
      name: 'Credenciales',
      href: '/credentials',
      icon: KeyRound,
    },
  ],
}

const NAV_EASE = [0.25, 0.1, 0.25, 1] as const

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

function NavItemComponent({
  item,
  pathname,
  depth = 0,
  onNavigate,
  collapsed = false,
  leafHrefs = [],
}: {
  item: NavItem
  pathname: string | null
  depth?: number
  onNavigate?: () => void
  collapsed?: boolean
  /** Hrefs de todas las hojas de la nav — evita activos falsos por prefijo */
  leafHrefs?: string[]
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  // Filter out redundant first child if it has the same href as parent
  const children = item.children
    ? item.children.filter((child, index) => !(index === 0 && child.href === item.href))
    : undefined
  const hasChildren = children && children.length > 0

  const isDescendantActive = (navItem: NavItem): boolean => {
    if (navItem.children?.length) return navItem.children.some(isDescendantActive)
    return isLeafNavActive(navItem.href, pathname, leafHrefs)
  }

  // Padres: activos si la ruta cae bajo su href o un hijo está activo.
  // Hojas: match exacto / prefijo, cediendo a hojas más específicas
  // (evita que `/admin/settings` robe el activo de `/admin/settings/tickets`).
  const isDirectActive = hasChildren
    ? pathname === item.href || !!pathname?.startsWith(item.href + '/')
    : isLeafNavActive(item.href, pathname, leafHrefs)
  const isActive = isDirectActive || (hasChildren ? children!.some(isDescendantActive) : false)

  const [isOpen, setIsOpen] = useState(isActive)

  // Abrir submenú al navegar a un descendiente (p. ej. deep link)
  useEffect(() => {
    if (isActive) setIsOpen(true)
  }, [isActive])

  const Icon = item.icon
  const indent = depth * 12
  const spring = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 28 }
  const hoverMotion = reduceMotion ? undefined : { x: depth > 0 ? 3 : 2 }
  const tapMotion = reduceMotion ? undefined : { scale: 0.985 }

  const itemClass = (active: boolean) =>
    cn(
      'relative flex items-center text-sm font-medium rounded-lg transition-colors',
      collapsed ? 'justify-center px-0 py-2.5' : 'pr-4 py-2',
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

  // ── Modo rail (colapsado): solo iconos + tooltip / flyout ──
  if (collapsed) {
    if (!hasChildren) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={hoverMotion} whileTap={tapMotion} className='w-full'>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-label={item.name}
                className={itemClass(isActive)}
              >
                {isActive && <SidebarActiveIndicator spring={spring} rail />}
                <Icon
                  className={cn(
                    'relative z-10 h-4 w-4 flex-shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </Link>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side='right' sideOffset={8}>
            {item.name}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Popover open={flyoutOpen} onOpenChange={setFlyoutOpen}>
        <Tooltip open={flyoutOpen ? false : undefined}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <motion.button
                type='button'
                aria-label={item.name}
                className={cn(itemClass(isActive), 'w-full')}
                whileHover={hoverMotion}
                whileTap={tapMotion}
              >
                {isActive && <span className='absolute inset-0 rounded-lg bg-primary/10' />}
                <Icon
                  className={cn(
                    'relative z-10 h-4 w-4 flex-shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              </motion.button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side='right' sideOffset={8}>
            {item.name}
          </TooltipContent>
        </Tooltip>
        <PopoverContent side='right' align='start' sideOffset={8} className='w-56 p-1'>
          <Link
            href={item.href}
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

  // ── Modo expandido ──
  if (!hasChildren) {
    return (
      <motion.div whileHover={hoverMotion} whileTap={tapMotion}>
        <Link
          href={item.href}
          onClick={onNavigate}
          style={{ paddingLeft: `${16 + indent}px` }}
          className={itemClass(isActive)}
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
      </motion.div>
    )
  }

  return (
    <div>
      <motion.div whileHover={hoverMotion} whileTap={tapMotion}>
        <Link
          href={item.href}
          onClick={e => {
            e.preventDefault()
            setIsOpen(!isOpen)
            router.push(item.href)
            onNavigate?.()
          }}
          style={{ paddingLeft: `${16 + indent}px` }}
          className={cn(itemClass(isActive), 'w-full')}
          aria-expanded={isOpen}
        >
          <Icon
            className={cn(
              'h-4 w-4 mr-2.5 flex-shrink-0',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <span className='flex-1 text-left'>{item.name}</span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={spring}
            className='inline-flex text-muted-foreground'
          >
            <ChevronDown className='h-4 w-4' />
          </motion.span>
        </Link>
      </motion.div>
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
              {/* Línea árbol — crece al abrir */}
              <motion.span
                aria-hidden
                className='absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-border origin-top'
                initial={reduceMotion ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.38, ease: NAV_EASE }}
              />
              {children!.map(child => (
                <motion.div key={child.href + child.name} variants={submenuItemVariants}>
                  <NavItemComponent
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

  // Restaurar preferencia de rail (solo desktop); evitar mismatch de hidratación
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true') {
        setCollapsed(true)
      }
    } catch {
      // localStorage no disponible
    }
  }, [])

  // Rail solo en lg+; el drawer móvil siempre muestra labels
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

  // Módulos activos — debe estar antes de cualquier return condicional
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

  // Solo ocultar si definitivamente no hay sesión (no durante la carga/revalidación)
  if (status === 'unauthenticated') {
    return null
  }

  // Mientras carga la sesión, mostrar el shell vacío para evitar desmontaje
  if (status === 'loading' || !session) {
    return (
      <div className='min-h-screen bg-background'>
        <div className='flex items-center justify-center h-screen'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
        </div>
      </div>
    )
  }

  // canManage*: leer del hook (fresco desde DB) — la sesión puede estar desactualizada
  // si un admin acaba de cambiar el permiso sin que el usuario haya vuelto a hacer login.
  const canManageNews = canManageNewsFromModules || (session.user as any)?.canManageNews === true
  const userRole = session.user.role as string
  // canManageInventory: usar el valor del hook (siempre fresco desde DB)
  // con fallback a la sesión en caso de que el hook aún esté cargando
  const canManageInventory =
    canManageInventoryFromModules || (session.user as any).canManageInventory
  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  const navKey =
    userRole === 'TECHNICIAN' && canManageInventory
      ? 'TECHNICIAN_MANAGER'
      : userRole === 'CLIENT' && canManageInventory
        ? 'CLIENT_MANAGER'
        : userRole

  // Para ADMIN, construir navegación dinámicamente según isSuperAdmin y módulos activos
  let navigation: NavItem[] = []
  if (userRole === 'ADMIN') {
    const adminNav = navigationByRole['ADMIN'].filter(item => {
      // Auditoría solo para Super Admin
      if (item.href === '/admin/audit') return isSuperAdmin
      // Para Super Admin: siempre mostrar todo
      if (isSuperAdmin) return true
      // Para Admin normal: filtrar según módulos activos de sus familias asignadas
      if (item.href === '/admin/tickets' || item.name === 'Tickets') return hasTickets
      if (item.href === '/inventory' || item.name === 'Inventario') return hasInventory
      if (item.href === '/admin/patrols' || item.name === 'Rondas') return hasPatrols
      if (item.href === '/admin/news' || item.name === 'Noticias') return hasNews
      if (item.href === '/admin/forms' || item.name === 'Documentos') return hasForms
      if (item.href === '/credentials' || item.name === 'Credenciales') return hasCredentials
      return true
    })
    navigation = adminNav
  } else {
    // Para TECHNICIAN y CLIENT: filtrar módulos según familias activas
    const baseNav = navigationByRole[navKey] || []
    navigation = baseNav.filter(item => {
      // Ocultar Tickets si ninguna familia del usuario lo tiene habilitado
      if (item.href === '/technician/tickets' || item.href === '/client/tickets') {
        return hasTickets
      }
      // Ocultar Inventario/Equipos si ninguna familia lo tiene habilitado,
      // salvo que pueda solicitar activos (necesita el menú aunque no gestione inventario).
      if (item.href === '/inventory') {
        return hasInventory || canRequestAssets
      }
      // Ocultar Rondas si el usuario no tiene patrolsEnabled
      if (
        item.href === '/admin/patrols' ||
        item.href === '/patrol' ||
        item.name === 'Rondas' ||
        item.name === 'Mis Rondas'
      ) {
        return hasPatrols
      }
      // Noticias: módulo = feed (dashboard). Link de gestión solo con canManageNews.
      if (item.href === '/admin/news' || item.name === 'Noticias') {
        if (userRole === 'CLIENT' || userRole === 'TECHNICIAN') {
          return hasNews && canManageNews
        }
        return hasNews
      }
      // Documentos: ver con formsEnabled; /admin/forms solo con canManageForms (proxy).
      // El listado de lectura/creación unificado está en /forms.
      if (item.href === '/forms' || item.href === '/admin/forms' || item.name === 'Documentos') {
        return hasForms
      }
      if (item.href === '/credentials' || item.name === 'Credenciales') {
        return hasCredentials
      }
      return true
    })

    // Solicitudes de Compras: CLIENT/TECH (y variantes gestor) con canRequestAssets
    const assetRequestParents: Record<string, string> = {
      CLIENT: 'Mis Equipos',
      TECHNICIAN: 'Mis Equipos',
      CLIENT_MANAGER: 'Inventario',
      TECHNICIAN_MANAGER: 'Inventario',
    }
    const assetParentName = assetRequestParents[navKey]
    if (assetParentName && canRequestAssets) {
      navigation = navigation.map(item => {
        if (item.name !== assetParentName || !item.children) return item
        if (item.children.some(c => c.href === '/inventory/asset-requests')) return item
        const newChildren = [...item.children]
        const insertIndex = newChildren.findIndex(child => child.name === 'Mantenimientos')
        const position = insertIndex >= 0 ? insertIndex : newChildren.length
        newChildren.splice(position, 0, {
          name: 'Solicitudes de Compras',
          href: '/inventory/asset-requests',
          icon: FileText,
        })
        return { ...item, children: newChildren }
      })
    }
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
    window.location.href = '/login'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadgeColor = (role: string) => {
    return getRoleColor(role, isSuperAdmin)
  }

  const getRoleLabel = (role: string) => {
    if (role === 'TECHNICIAN') {
      return canManageInventory ? 'Técnico · Gestor' : 'Técnico'
    }
    if (role === 'CLIENT') {
      return canManageInventory ? 'Cliente · Gestor' : getRoleLabelFn(role, isSuperAdmin)
    }
    return getRoleLabelFn(role, isSuperAdmin)
  }

  const closeSidebar = () => setSidebarOpen(false)

  const homeHref = `/${userRole.toLowerCase() === 'technician_manager' ? 'technician' : userRole.toLowerCase()}`
  const breadcrumbs = buildDashboardBreadcrumbs({
    pathname,
    navigation,
    homeHref,
    fallbackTitle: title,
  })
  // En home / páginas de un solo nivel el título basta; el trail aporta en rutas anidadas
  const headerBreadcrumbs = breadcrumbs.length > 1 ? breadcrumbs : []
  const leafHrefs = collectLeafHrefs(navigation)

  return (
    <div className='min-h-screen bg-background'>
      {/* Overlay móvil */}
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

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r border-border',
          'w-64 transition-[width,transform] duration-300 ease-in-out',
          collapsed && 'lg:w-16',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0'
        )}
      >
        {/* Logo + botón cerrar en móvil */}
        <div
          className={cn(
            'flex items-center h-20 border-b border-border flex-shrink-0',
            railMode ? 'justify-center px-1' : 'justify-between px-4'
          )}
        >
          {/* Espacio reservado en móvil para balancear el botón X */}
          {!railMode && <div className='lg:hidden w-7' />}
          <Link
            href={`/${userRole.toLowerCase() === 'technician_manager' ? 'technician' : userRole.toLowerCase()}`}
            onClick={closeSidebar}
            className={cn('flex justify-center min-w-0', railMode ? 'flex-none' : 'flex-1')}
            title='Inicio'
          >
            <SystemLogo
              size={railMode ? 'md' : 'xl'}
              showText={!railMode}
              className={railMode ? 'scale-90' : undefined}
            />
          </Link>
          <button
            onClick={closeSidebar}
            className='lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground'
          >
            <X className='h-5 w-5' />
          </button>
          {/* Espacio reservado en desktop expandido para centrar el logo */}
          {!railMode && <div className='hidden lg:block w-7' />}
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            'flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden',
            railMode ? 'px-1.5' : 'px-3'
          )}
        >
          <TooltipProvider delayDuration={200}>
            <LayoutGroup id='sidebar-nav'>
              {navigation.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.3,
                    ease: NAV_EASE,
                    delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.24),
                  }}
                >
                  <NavItemComponent
                    item={item}
                    pathname={pathname}
                    onNavigate={closeSidebar}
                    collapsed={railMode}
                    leafHrefs={leafHrefs}
                  />
                </motion.div>
              ))}
            </LayoutGroup>
          </TooltipProvider>
        </nav>

        {/* Toggle rail — solo desktop */}
        <div className='hidden lg:flex flex-shrink-0 border-t border-border p-2 justify-center'>
          <motion.button
            type='button'
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className='p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors'
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
                <PanelLeft className='h-4 w-4' />
              ) : (
                <PanelLeftClose className='h-4 w-4' />
              )}
            </motion.span>
          </motion.button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={cn(
          'transition-[padding] duration-300 ease-in-out',
          collapsed ? 'lg:pl-16' : 'lg:pl-64'
        )}
      >
        {/* Header */}
        <header className='sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80'>
          <div className='px-4 sm:px-8 py-3 sm:py-3.5'>
            <div className='flex items-start sm:items-center justify-between gap-3'>
              {/* Hamburguesa + breadcrumbs + título */}
              <div className='flex items-start gap-3 min-w-0 flex-1'>
                <motion.button
                  onClick={() => setSidebarOpen(true)}
                  className='lg:hidden mt-0.5 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0'
                  whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                >
                  <Menu className='h-5 w-5' />
                </motion.button>
                <div className='min-w-0 flex-1 space-y-1'>
                  <DashboardBreadcrumbs items={headerBreadcrumbs} className='hidden sm:flex' />
                  <AnimatePresence mode='wait'>
                    {title ? (
                      <motion.h1
                        key={title}
                        className='text-sm sm:text-xl font-bold text-foreground line-clamp-2 leading-tight'
                        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                        transition={{ duration: reduceMotion ? 0 : 0.22, ease: NAV_EASE }}
                      >
                        {title}
                      </motion.h1>
                    ) : null}
                  </AnimatePresence>
                  {subtitle && (
                    <div className='text-xs text-muted-foreground hidden sm:flex items-center flex-wrap gap-1'>
                      {subtitle}
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones + notificaciones + avatar */}
              <div className='flex items-center gap-2 sm:gap-3 flex-shrink-0 pt-0.5'>
                {headerActions && <div className='hidden sm:block'>{headerActions}</div>}

                {/* Ver Página Pública — visible para todos los roles */}
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
                        <AvatarImage src={session.user.avatar} alt={session.user.name} />
                        <AvatarFallback className='bg-primary/10 text-primary text-sm'>
                          {getInitials(session.user.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end' className='w-56'>
                    <DropdownMenuLabel>
                      <div className='flex flex-col space-y-1'>
                        <p className='text-sm font-medium leading-none'>{session.user.name}</p>
                        <p className='text-xs leading-none text-muted-foreground'>
                          {session.user.email}
                        </p>
                        <Badge className={`text-xs w-fit mt-1 ${getRoleBadgeColor(userRole)}`}>
                          {getRoleLabel(userRole)}
                        </Badge>
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
              </div>
            </div>

            {/* Breadcrumbs en móvil (debajo del título) */}
            {headerBreadcrumbs.length > 0 && (
              <DashboardBreadcrumbs items={headerBreadcrumbs} className='sm:hidden mt-2 pl-11' />
            )}

            {/* headerActions en móvil (segunda fila) */}
            {headerActions && <div className='sm:hidden mt-2'>{headerActions}</div>}
          </div>
        </header>

        {/* Page Content — entrada suave al cambiar de ruta (sin exit wait = sin flash) */}
        <main className='p-4 sm:p-8'>
          <motion.div
            key={pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: NAV_EASE }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

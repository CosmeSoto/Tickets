/**
 * Layout unificado para dashboards por rol
 * Proporciona navegación y estructura consistente para ADMIN, TECHNICIAN y CLIENT
 */

'use client'

import { ReactNode, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Ticket,
  Users,
  Building,
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
  Boxes,
  Ruler,
  Monitor,
  HelpCircle,
  Menu,
  X,
  Database,
  FileSignature,
  Tag,
  FileText,
  ClipboardList,
  Building2,
  Trash2,
  Layers,
  Warehouse,
} from 'lucide-react'
import { Notifications } from '@/components/ui/notifications'
import { Button } from '@/components/ui/button'
import { SystemLogo } from '@/components/common/system-logo'
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

interface RoleDashboardLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  headerActions?: ReactNode
}

interface NavItem {
  name: string
  href: string
  icon: any
  children?: NavItem[]
}

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
        { name: 'Técnicos', href: '/admin/technicians', icon: Wrench },
        { name: 'Base de Conocimientos', href: '/admin/knowledge', icon: BookOpen },
        { name: 'Configuración', href: '/settings/tickets', icon: Settings },
      ],
    },
    { name: 'Usuarios', href: '/admin/users', icon: Users },
    { name: 'Departamentos', href: '/admin/departments', icon: Building },
    {
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Equipos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Actas de Entrega', href: '/inventory/acts', icon: FileText },
        { name: 'Actas de Baja', href: '/inventory/decommission', icon: Trash2 },
        { name: 'Proveedores', href: '/inventory/suppliers', icon: Building2 },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
        {
          name: 'Catálogos', href: '/inventory/equipment-types', icon: Database,
          children: [
            { name: 'Familias', href: '/inventory/families', icon: Layers },
            { name: 'Equipo', href: '/inventory/equipment-types', icon: Boxes },
            { name: 'Bodegas', href: '/inventory/warehouses', icon: Warehouse },
            { name: 'Tipos de Licencia', href: '/inventory/license-types', icon: FileSignature },
            { name: 'Tipos de Material MRO', href: '/inventory/consumable-types', icon: Tag },
            { name: 'Unidades Medida', href: '/inventory/units-of-measure', icon: Ruler },
          ],
        },
        { name: 'Configuración', href: '/settings/inventory', icon: Settings },
      ],
    },
    { name: 'Auditoría', href: '/admin/audit', icon: Shield },
    { name: 'Configuración Sistema', href: '/admin/settings', icon: Settings },
  ],
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
      name: 'Inventario',
      href: '/inventory',
      icon: Package,
      children: [
        { name: 'Equipos', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Actas de Entrega', href: '/inventory/acts', icon: FileText },
        { name: 'Actas de Baja', href: '/inventory/decommission', icon: Trash2 },
        {name: 'Catálogos',href: '/inventory/equipment-types',icon: Database,children: [
          { name: 'Equipo', href: '/inventory/equipment-types', icon: Boxes },
          { name: 'Tipos de Licencia', href: '/inventory/license-types', icon: FileSignature },
          { name: 'Tipos de Material MRO', href: '/inventory/consumable-types', icon: Tag },
          { name: 'Unidades de Medida', href: '/inventory/units-of-measure', icon: Ruler },
          ],
        },
      ],
    },
  ],
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
        { name: 'Equipos Asignados', href: '/inventory', icon: Monitor },
        { name: 'Mantenimientos', href: '/inventory/maintenance', icon: Wrench },
        { name: 'Actas de Entrega', href: '/inventory/acts', icon: FileText },
      ],
    },
  ],
}

function NavItemComponent({ item, pathname, onNavigate, depth = 0 }: { item: NavItem; pathname: string | null; onNavigate?: () => void; depth?: number }) {
  const hasChildren = item.children && item.children.length > 0

  const isDescendantActive = (navItem: NavItem): boolean => {
    if (pathname === navItem.href) return true
    if (navItem.children) return navItem.children.some(isDescendantActive)
    return false
  }

  const isDirectActive = pathname === item.href || pathname?.startsWith(item.href + '/')
  const isActive = isDirectActive || (hasChildren ? item.children!.some(isDescendantActive) : false)

  const [isOpen, setIsOpen] = useState(isActive)

  const Icon = item.icon
  const indent = depth * 12

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        style={{ paddingLeft: `${16 + indent}px` }}
        className={`flex items-center pr-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Icon className={`h-4 w-4 mr-2.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        {item.name}
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ paddingLeft: `${16 + indent}px` }}
        className={`flex items-center w-full pr-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Icon className={`h-4 w-4 mr-2.5 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="flex-1 text-left">{item.name}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-0.5 space-y-0.5 border-l-2 border-border" style={{ marginLeft: `${20 + indent}px`, paddingLeft: '8px' }}>
          {item.children!.map((child) => (
            <NavItemComponent
              key={child.href + child.name}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function RoleDashboardLayout({
  children,
  title,
  subtitle,
  headerActions,
}: RoleDashboardLayoutProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!session) {
    return null
  }

  const userRole = session.user.role as keyof typeof navigationByRole
  const navigation = navigationByRole[userRole] || []

  const handleLogout = async () => {
    await signOut({ 
      callbackUrl: '/login',
      redirect: true 
    })
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
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'TECHNICIAN': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'CLIENT': return 'bg-green-100 text-green-700 border-green-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Administrador'
      case 'TECHNICIAN': return 'Técnico'
      case 'CLIENT': return 'Cliente'
      default: return role
    }
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-background">

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Logo + botón cerrar en móvil */}
        <div className="flex items-center justify-between h-16 border-b border-border px-4">
          <Link href={`/${userRole.toLowerCase()}`} onClick={closeSidebar}>
            <SystemLogo size="sm" showText={true} />
          </Link>
          <button
            onClick={closeSidebar}
            className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {navigation.map((item) => (
            <NavItemComponent
              key={item.name}
              item={item}
              pathname={pathname}
              onNavigate={closeSidebar}
            />
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-40">
          <div className="px-4 sm:px-8 py-4">
            <div className="flex items-center justify-between gap-2">

              {/* Hamburguesa + título */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent flex-shrink-0"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  {title && (
                    <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{title}</h1>
                  )}
                  {subtitle && (
                    <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">{subtitle}</p>
                  )}
                </div>
              </div>

              {/* Acciones + notificaciones + avatar */}
              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                {headerActions && (
                  <div className="hidden sm:block">{headerActions}</div>
                )}
                
                <Notifications variant="bell" />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={session.user.avatar} alt={session.user.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(session.user.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{session.user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {session.user.email}
                        </p>
                        <Badge className={`text-xs w-fit mt-1 ${getRoleBadgeColor(userRole)}`}>
                          {getRoleLabel(userRole)}
                        </Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="h-4 w-4 mr-2" />
                        Mi Perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">
                        <Settings className="h-4 w-4 mr-2" />
                        Configuración Personal
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/?preview=true" target="_blank">
                        <Globe className="h-4 w-4 mr-2" />
                        Ver Página Pública
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar Sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* headerActions en móvil (segunda fila) */}
            {headerActions && (
              <div className="sm:hidden mt-2">
                {headerActions}
              </div>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

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
  Key,
  ShoppingCart,
  List,
  Boxes,
  Ruler,
  Monitor,
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
        { name: 'Licencias', href: '/inventory/licenses', icon: Key },
        { name: 'Consumibles', href: '/inventory/consumables', icon: ShoppingCart },
        { name: 'Reportes', href: '/inventory/reports', icon: BarChart3 },
        { name: 'Tipos de Equipo', href: '/inventory/equipment-types', icon: Boxes },
        { name: 'Tipos de Licencia', href: '/inventory/license-types', icon: Key },
        { name: 'Tipos de Consumible', href: '/inventory/consumable-types', icon: ShoppingCart },
        { name: 'Unidades de Medida', href: '/inventory/units-of-measure', icon: Ruler },
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
        { name: 'Licencias', href: '/inventory/licenses', icon: Key },
        { name: 'Consumibles', href: '/inventory/consumables', icon: ShoppingCart },
        { name: 'Tipos de Equipo', href: '/inventory/equipment-types', icon: Boxes },
        { name: 'Tipos de Licencia', href: '/inventory/license-types', icon: Key },
        { name: 'Tipos de Consumible', href: '/inventory/consumable-types', icon: ShoppingCart },
        { name: 'Unidades de Medida', href: '/inventory/units-of-measure', icon: Ruler },
      ],
    },
  ],
  CLIENT: [
    { name: 'Dashboard', href: '/client', icon: LayoutDashboard },
    { name: 'Mis Tickets', href: '/client/tickets', icon: Ticket },
    { name: 'Mis Equipos', href: '/inventory', icon: Package },
  ],
}

function NavItemComponent({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const hasChildren = item.children && item.children.length > 0
  
  // Determinar si algún hijo está activo
  const isChildActive = hasChildren && item.children!.some(
    child => pathname === child.href || pathname?.startsWith(child.href + '/')
  )
  const isDirectActive = pathname === item.href || pathname?.startsWith(item.href + '/')
  const isActive = isDirectActive || isChildActive

  const [isOpen, setIsOpen] = useState(isActive)

  const Icon = item.icon

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Icon className={`h-5 w-5 mr-3 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        {item.name}
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center w-full px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
      >
        <Icon className={`h-5 w-5 mr-3 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="flex-1 text-left">{item.name}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-border pl-3">
          {item.children!.map((child) => {
            const ChildIcon = child.icon
            const isChildItemActive = pathname === child.href || 
              (child.href !== '/inventory' && pathname?.startsWith(child.href + '/')) ||
              (child.href === '/inventory' && pathname === '/inventory')
            return (
              <Link
                key={child.href + child.name}
                href={child.href}
                className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                  isChildItemActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <ChildIcon className={`h-4 w-4 mr-2.5 flex-shrink-0 ${isChildItemActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {child.name}
              </Link>
            )
          })}
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
  const router = useRouter()
  const pathname = usePathname()

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
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'TECHNICIAN':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'CLIENT':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Administrador'
      case 'TECHNICIAN':
        return 'Técnico'
      case 'CLIENT':
        return 'Cliente'
      default:
        return role
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-border px-4">
          <Link href={`/${userRole.toLowerCase()}`}>
            <SystemLogo size="sm" showText={true} />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
          {navigation.map((item) => (
            <NavItemComponent key={item.name} item={item} pathname={pathname} />
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="pl-64">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-40">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
              
              {/* User Menu in Header */}
              <div className="flex items-center space-x-4">
                {headerActions && <div>{headerActions}</div>}
                
                {/* Notification Bell */}
                <Notifications variant="bell" />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={session.user.avatar} alt={session.user.name} />
                        <AvatarFallback className="bg-primary/10 text-primary">
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
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

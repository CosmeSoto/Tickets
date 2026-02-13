'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Ticket,
  Users,
  Settings,
  BarChart3,
  FileText,
  Database,
  Shield,
  Wrench,
  UserCircle,
  Plus,
  Calendar,
  TrendingUp,
  BookOpen,
  HelpCircle,
  Building,
  Key,
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

const adminNavItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: Home,
    description: 'Vista general del sistema',
  },
  {
    title: 'Tickets',
    href: '/admin/tickets',
    icon: Ticket,
    description: 'Gestión de tickets',
  },
  {
    title: 'Departamentos',
    href: '/admin/departments',
    icon: Building,
    description: 'Gestión de departamentos',
  },
  {
    title: 'Categorías',
    href: '/admin/categories',
    icon: FileText,
    description: 'Gestión de categorías',
  },
  {
    title: 'Usuarios',
    href: '/admin/users',
    icon: Users,
    description: 'Gestión de usuarios',
  },
  {
    title: 'Técnicos',
    href: '/admin/technicians',
    icon: Wrench,
    description: 'Gestión de técnicos',
  },
  {
    title: 'Base de Conocimiento',
    href: '/admin/knowledge',
    icon: BookOpen,
    description: 'Gestión de artículos',
  },
  {
    title: 'Reportes',
    href: '/admin/reports',
    icon: BarChart3,
    description: 'Reportes y estadísticas',
  },
  {
    title: 'Backups',
    href: '/admin/backups',
    icon: Database,
    description: 'Gestión de respaldos',
  },
  {
    title: 'Configuración',
    href: '/admin/settings',
    icon: Settings,
    description: 'Configuración del sistema',
  },
]

const technicianNavItems = [
  {
    title: 'Dashboard',
    href: '/technician',
    icon: Home,
    description: 'Mi panel de trabajo',
  },
  {
    title: 'Mis Tickets',
    href: '/technician/tickets',
    icon: Ticket,
    description: 'Tickets asignados',
  },
  {
    title: 'Base de Conocimiento',
    href: '/technician/knowledge',
    icon: BookOpen,
    description: 'Artículos y guías',
  },
  {
    title: 'Calendario',
    href: '/technician/calendar',
    icon: Calendar,
    description: 'Agenda de trabajo',
  },
  {
    title: 'Mi Rendimiento',
    href: '/technician/stats',
    icon: TrendingUp,
    description: 'Estadísticas personales',
  },
]

const clientNavItems = [
  {
    title: 'Dashboard',
    href: '/client',
    icon: Home,
    description: 'Mi panel principal',
  },
  {
    title: 'Crear Ticket',
    href: '/client/create-ticket',
    icon: Plus,
    description: 'Nuevo ticket de soporte',
  },
  {
    title: 'Mis Tickets',
    href: '/client/tickets',
    icon: Ticket,
    description: 'Mis tickets de soporte',
  },
  {
    title: 'Base de Conocimiento',
    href: '/knowledge',
    icon: BookOpen,
    description: 'Artículos de ayuda',
  },
  {
    title: 'Soporte',
    href: '/client/support',
    icon: HelpCircle,
    description: 'Contactar soporte',
  },
]

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()

  const getNavItems = () => {
    switch (session?.user?.role) {
      case 'ADMIN':
        return adminNavItems
      case 'TECHNICIAN':
        return technicianNavItems
      case 'CLIENT':
        return clientNavItems
      default:
        return clientNavItems
    }
  }

  const navItems = getNavItems()

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-card border-r border-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-border'>
        {!collapsed && (
          <div className='flex items-center space-x-2'>
            <div className='w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center'>
              <Ticket className='w-5 h-5 text-primary-foreground' />
            </div>
            <div>
              <h1 className='text-lg font-semibold text-foreground'>TicketPro</h1>
              <p className='text-xs text-muted-foreground'>Sistema de Soporte</p>
            </div>
          </div>
        )}
        <Button
          variant='ghost'
          size='icon'
          onClick={() => setCollapsed(!collapsed)}
          className='h-8 w-8'
        >
          {collapsed ? <ChevronRight className='h-4 w-4' /> : <ChevronLeft className='h-4 w-4' />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className='flex-1 p-4 space-y-2'>
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  collapsed && 'justify-center px-2',
                  isActive && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
                title={collapsed ? item.title : undefined}
              >
                <Icon className={cn('h-4 w-4', !collapsed && 'mr-3')} />
                {!collapsed && (
                  <div className='flex-1 text-left'>
                    <div className='text-sm font-medium'>{item.title}</div>
                    {!isActive && <div className='text-xs text-muted-foreground'>{item.description}</div>}
                  </div>
                )}
              </Button>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className='p-4 border-t border-border'>
          <div className='text-xs text-muted-foreground text-center'>
            <p>TicketPro v1.0</p>
            <p>© 2024 Sistema de Soporte</p>
          </div>
        </div>
      )}
    </div>
  )
}

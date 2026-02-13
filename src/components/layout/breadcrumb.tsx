'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
  current?: boolean
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

const pathLabels: Record<string, string> = {
  admin: 'Administración',
  technician: 'Técnico',
  client: 'Cliente',
  tickets: 'Tickets',
  users: 'Usuarios',
  categories: 'Categorías',
  reports: 'Reportes',
  settings: 'Configuración',
  calendar: 'Calendario',
  performance: 'Rendimiento',
  'create-ticket': 'Crear Ticket',
  knowledge: 'Base de Conocimiento',
  support: 'Soporte',
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const pathname = usePathname()

  // Generate breadcrumb items from pathname if not provided
  const breadcrumbItems = items || generateBreadcrumbItems(pathname)

  if (breadcrumbItems.length <= 1) {
    return null
  }

  return (
    <nav className={cn('flex items-center space-x-1 text-sm text-muted-foreground', className)}>
      <Link href='/' className='flex items-center hover:text-foreground transition-colors'>
        <Home className='h-4 w-4' />
      </Link>

      {breadcrumbItems.map((item, index) => (
        <div key={index} className='flex items-center space-x-1'>
          <ChevronRight className='h-4 w-4 text-muted-foreground' />
          {item.href && !item.current ? (
            <Link href={item.href} className='hover:text-foreground transition-colors'>
              {item.label}
            </Link>
          ) : (
            <span className={cn(item.current && 'text-foreground font-medium')}>{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}

function generateBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const items: BreadcrumbItem[] = []

  let currentPath = ''

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`
    const isLast = index === segments.length - 1

    items.push({
      label: pathLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
      href: isLast ? undefined : currentPath,
      current: isLast,
    })
  })

  return items
}

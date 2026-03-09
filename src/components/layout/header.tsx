'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Notifications } from '@/components/ui/notifications'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Search,
  Plus,
  HelpCircle,
  Command,
  User,
  Settings,
  LogOut,
  Shield,
  Wrench,
  UserCircle,
  BookOpen,
  MessageCircle,
  Bug,
} from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: session } = useSession()
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null)

  // Cargar avatar actualizado desde BD
  useEffect(() => {
    if (session?.user?.id) {
      const loadAvatar = () => {
        fetch(`/api/users/${session.user.id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.user) {
              setCurrentAvatar(data.user.avatar)
            }
          })
          .catch(() => {
            setCurrentAvatar(session.user.avatar || null)
          })
      }
      
      // Cargar al montar
      loadAvatar()
      
      // Escuchar evento de actualización de avatar
      const handleAvatarUpdate = (event: CustomEvent) => {
        setCurrentAvatar(event.detail.avatarUrl)
      }
      
      window.addEventListener('avatarUpdated', handleAvatarUpdate as EventListener)
      
      return () => {
        window.removeEventListener('avatarUpdated', handleAvatarUpdate as EventListener)
      }
    }
  }, [session?.user?.id, session?.user?.avatar])

  const getRoleIcon = () => {
    switch (session?.user?.role) {
      case 'ADMIN':
        return Shield
      case 'TECHNICIAN':
        return Wrench
      case 'CLIENT':
        return UserCircle
      default:
        return UserCircle
    }
  }

  const getRoleColor = () => {
    switch (session?.user?.role) {
      case 'ADMIN':
        return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950'
      case 'TECHNICIAN':
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950'
      case 'CLIENT':
        return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950'
      default:
        return 'text-muted-foreground bg-muted'
    }
  }

  const RoleIcon = getRoleIcon()

  return (
    <header className='bg-background border-b border-border px-6 py-4'>
      <div className='flex items-center justify-between'>
        {/* Title Section */}
        <div className='flex-1'>
          {title && (
            <div>
              <h1 className='text-2xl font-semibold text-foreground'>{title}</h1>
              {subtitle && <p className='text-sm text-muted-foreground mt-1'>{subtitle}</p>}
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className='flex-1 max-w-md mx-8'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
            <Input
              placeholder='Buscar tickets, usuarios...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className='pl-10 pr-4'
            />
            <div className='absolute right-3 top-1/2 transform -translate-y-1/2'>
              <kbd className='pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground'>
                <Command className='h-3 w-3' />K
              </kbd>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className='flex items-center space-x-3'>
          {/* Quick Create Action - Solo para roles específicos */}
          {session?.user?.role === 'CLIENT' && (
            <Button size='sm' className='bg-primary hover:bg-primary/90'>
              <Plus className='h-4 w-4 mr-2' />
              Nuevo Ticket
            </Button>
          )}

          {/* Custom Actions from props */}
          {actions}

          {/* Notifications */}
          <Notifications variant="bell" />

          {/* Help - Con funcionalidad completa */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' title='Ayuda y soporte'>
                <HelpCircle className='h-5 w-5' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuItem asChild>
                <Link href="/help/center" className="flex items-center w-full">
                  <BookOpen className='mr-2 h-4 w-4' />
                  Centro de Ayuda
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help/documentation" className="flex items-center w-full">
                  <Search className='mr-2 h-4 w-4' />
                  Documentación
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help/contact" className="flex items-center w-full">
                  <MessageCircle className='mr-2 h-4 w-4' />
                  Contactar Soporte
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/help/report-bug" className="flex items-center w-full">
                  <Bug className='mr-2 h-4 w-4' />
                  Reportar Problema
                </Link>
              </DropdownMenuItem>
              
              {/* Configuraciones Avanzadas - Solo Administradores */}
              {session?.user?.role === 'ADMIN' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Configuración Avanzada</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/help-config" className="flex items-center w-full">
                      <HelpCircle className='mr-2 h-4 w-4' />
                      <span>Sistema de Ayuda</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings" className="flex items-center w-full">
                      <Wrench className='mr-2 h-4 w-4' />
                      <span>Configuración del Sistema</span>
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu - Movido del sidebar al header */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' className='flex items-center space-x-2 px-3'>
                <Avatar className='h-8 w-8'>
                  <AvatarImage src={currentAvatar || undefined} />
                  <AvatarFallback className={getRoleColor()}>
                    <RoleIcon className='h-4 w-4' />
                  </AvatarFallback>
                </Avatar>
                <div className='hidden md:block text-left'>
                  <p className='text-sm font-medium text-foreground'>{session?.user?.name}</p>
                  <p className='text-xs text-muted-foreground capitalize'>
                    {session?.user?.role?.toLowerCase()}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center w-full">
                  <User className='mr-2 h-4 w-4' />
                  <span>Perfil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center w-full">
                  <Settings className='mr-2 h-4 w-4' />
                  <span>Configuración</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: '/login' })}
                className='text-red-600'
              >
                <LogOut className='mr-2 h-4 w-4' />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

'use client'

import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { LoadingDashboard } from '@/components/shared/loading-dashboard'
import { useDashboardShellSetter } from '@/contexts/dashboard-shell-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Notifications } from '@/components/ui/notifications'

interface UnifiedDashboardBaseProps {
  userName?: string
  userRole: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  isLoading: boolean
  isAuthorized: boolean
  error: string | null
  title: string
  subtitle: string
  loadingMessage?: string
  onRefresh: () => void
  headerActions?: ReactNode
  children: ReactNode
  showNotifications?: boolean
  notificationsMaxVisible?: number
  statusBadge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
  }
}

export function UnifiedDashboardBase({
  userName,
  userRole,
  isLoading,
  isAuthorized,
  error,
  title,
  subtitle,
  loadingMessage = 'Cargando datos...',
  onRefresh,
  headerActions,
  children,
  showNotifications = true,
  notificationsMaxVisible = 3,
  statusBadge,
}: UnifiedDashboardBaseProps) {
  const setShellMeta = useDashboardShellSetter()
  const useSharedShell = !!setShellMeta

  const displayTitle = userName
    ? `¡${userRole === 'CLIENT' ? 'Bienvenido' : 'Hola'}, ${userName}!`
    : title

  const sbText = statusBadge?.text
  const sbVariant = statusBadge?.variant
  const sbClassName = statusBadge?.className

  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const defaultHeaderActions = useMemo(
    () => (
      <div className='flex items-center space-x-3'>
        {statusBadge && (
          <Badge variant={sbVariant || 'default'} className={sbClassName}>
            {sbText}
          </Badge>
        )}
        <Button variant='outline' size='sm' onClick={() => onRefreshRef.current()}>
          <RefreshCw className='h-4 w-4 mr-2' />
          Actualizar
        </Button>
        {headerActions}
      </div>
    ),
    [statusBadge, sbText, sbVariant, sbClassName, headerActions]
  )

  useEffect(() => {
    if (!setShellMeta || !isAuthorized) return

    if (isLoading) {
      setShellMeta({ title, subtitle })
      return () => {
        setShellMeta(null)
      }
    }

    setShellMeta({
      title: displayTitle,
      subtitle,
      headerActions: defaultHeaderActions,
    })
    return () => {
      setShellMeta(null)
    }
  }, [setShellMeta, isAuthorized, isLoading, title, subtitle, displayTitle, defaultHeaderActions])

  if (isLoading) {
    return (
      <LoadingDashboard
        title={title}
        subtitle={subtitle}
        message={loadingMessage}
        embedded={useSharedShell}
      />
    )
  }

  if (!isAuthorized) return null

  const errorBlock = (
    <Alert variant='destructive' className='mb-6'>
      <AlertTriangle className='h-4 w-4' />
      <AlertDescription className='flex items-center justify-between'>
        <span>Error al cargar datos: {error}</span>
        <Button variant='outline' size='sm' onClick={onRefresh}>
          <RefreshCw className='h-4 w-4 mr-2' />
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  )

  const mainBlock = (
    <>
      {showNotifications && (
        <Notifications variant='dashboard' className='mb-6' maxVisible={notificationsMaxVisible} />
      )}
      {children}
    </>
  )

  if (error) {
    if (useSharedShell) {
      return errorBlock
    }
    return (
      <RoleDashboardLayout
        title={displayTitle}
        subtitle={subtitle}
        headerActions={defaultHeaderActions}
      >
        {errorBlock}
      </RoleDashboardLayout>
    )
  }

  if (useSharedShell) {
    return mainBlock
  }

  return (
    <RoleDashboardLayout
      title={displayTitle}
      subtitle={subtitle}
      headerActions={defaultHeaderActions}
    >
      {mainBlock}
    </RoleDashboardLayout>
  )
}

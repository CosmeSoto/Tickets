/**
 * Error States Components
 * Standardized error handling and display components
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardTitle } from './card'
import { Alert, AlertDescription } from './alert'
import {
  AlertTriangle,
  RefreshCw,
  Home,
  ArrowLeft,
  Wifi,
  Server,
  FileX,
  Shield,
  Clock,
} from 'lucide-react'

// Base Error Props
interface BaseErrorProps {
  title?: string
  message?: string
  className?: string
  onRetry?: () => void
  onGoHome?: () => void
  onGoBack?: () => void
}

// Generic Error Component
interface ErrorDisplayProps extends BaseErrorProps {
  icon?: React.ReactNode
  actions?: React.ReactNode
  variant?: 'default' | 'destructive' | 'warning'
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title = 'Ha ocurrido un error',
  message = 'Algo salió mal. Por favor, inténtalo de nuevo.',
  icon,
  actions,
  variant = 'destructive',
  className,
  onRetry,
  onGoHome,
  onGoBack,
}) => {
  const defaultIcon = <AlertTriangle className='h-12 w-12 text-red-500' />

  const variantStyles = {
    default: 'border-border',
    destructive: 'border-red-200 bg-red-50',
    warning: 'border-amber-200 bg-amber-50',
  }

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardContent className='flex flex-col items-center text-center p-8'>
        <div className='mb-4'>{icon || defaultIcon}</div>

        <CardTitle className='mb-2 text-xl'>{title}</CardTitle>
        <CardDescription className='mb-6 max-w-md'>{message}</CardDescription>

        {(actions || onRetry || onGoHome || onGoBack) && (
          <div className='flex flex-wrap gap-3 justify-center'>
            {actions}
            {onRetry && (
              <Button onClick={onRetry} variant='default'>
                <RefreshCw className='h-4 w-4 mr-2' />
                Reintentar
              </Button>
            )}
            {onGoBack && (
              <Button onClick={onGoBack} variant='outline'>
                <ArrowLeft className='h-4 w-4 mr-2' />
                Volver
              </Button>
            )}
            {onGoHome && (
              <Button onClick={onGoHome} variant='outline'>
                <Home className='h-4 w-4 mr-2' />
                Inicio
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Network Error
export const NetworkError: React.FC<BaseErrorProps> = props => {
  return (
    <ErrorDisplay
      title='Error de conexión'
      message='No se pudo conectar al servidor. Verifica tu conexión a internet e inténtalo de nuevo.'
      icon={<Wifi className='h-12 w-12 text-red-500' />}
      {...props}
    />
  )
}

// Server Error
export const ServerError: React.FC<BaseErrorProps> = props => {
  return (
    <ErrorDisplay
      title='Error del servidor'
      message='El servidor está experimentando problemas. Por favor, inténtalo más tarde.'
      icon={<Server className='h-12 w-12 text-red-500' />}
      {...props}
    />
  )
}

// Not Found Error
export const NotFoundError: React.FC<BaseErrorProps> = props => {
  return (
    <ErrorDisplay
      title='Página no encontrada'
      message='La página que buscas no existe o ha sido movida.'
      icon={<FileX className='h-12 w-12 text-red-500' />}
      {...props}
    />
  )
}

// Permission Error
export const PermissionError: React.FC<BaseErrorProps> = props => {
  return (
    <ErrorDisplay
      title='Acceso denegado'
      message='No tienes permisos para acceder a este recurso.'
      icon={<Shield className='h-12 w-12 text-red-500' />}
      variant='warning'
      {...props}
    />
  )
}

// Timeout Error
export const TimeoutError: React.FC<BaseErrorProps> = props => {
  return (
    <ErrorDisplay
      title='Tiempo de espera agotado'
      message='La operación tardó demasiado tiempo. Por favor, inténtalo de nuevo.'
      icon={<Clock className='h-12 w-12 text-red-500' />}
      {...props}
    />
  )
}

// Inline Error Alert
interface InlineErrorProps {
  message: string
  variant?: 'destructive' | 'default'
  className?: string
  onDismiss?: () => void
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  variant = 'destructive',
  className,
  onDismiss,
}) => {
  return (
    <Alert variant={variant} className={className}>
      <AlertTriangle className='h-4 w-4' />
      <AlertDescription className='flex items-center justify-between'>
        <span>{message}</span>
        {onDismiss && (
          <Button
            variant='ghost'
            size='sm'
            onClick={onDismiss}
            className='h-auto p-0 text-current hover:bg-transparent'
          >
            ×
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Form Field Error
interface FieldErrorProps {
  message?: string
  className?: string
}

export const FieldError: React.FC<FieldErrorProps> = ({ message, className }) => {
  if (!message) return null

  return <p className={cn('text-sm text-red-600 mt-1', className)}>{message}</p>
}

// Hook for Error Handling
export const useErrorHandler = () => {
  const [error, setError] = React.useState<string | null>(null)

  const handleError = React.useCallback((error: unknown) => {
    if (error instanceof Error) {
      setError(error.message)
    } else if (typeof error === 'string') {
      setError(error)
    } else {
      setError('Ha ocurrido un error inesperado')
    }
  }, [])

  const clearError = React.useCallback(() => {
    setError(null)
  }, [])

  return {
    error,
    handleError,
    clearError,
    hasError: error !== null,
  }
}

// API Error Handler
export const handleApiError = (error: unknown): string => {
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch')) {
      return 'Error de conexión. Verifica tu conexión a internet.'
    }

    // Timeout errors
    if (error.message.includes('timeout')) {
      return 'La operación tardó demasiado tiempo. Inténtalo de nuevo.'
    }

    return error.message
  }

  // HTTP errors
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as any).status

    switch (status) {
      case 400:
        return 'Solicitud inválida. Verifica los datos ingresados.'
      case 401:
        return 'No autorizado. Por favor, inicia sesión nuevamente.'
      case 403:
        return 'No tienes permisos para realizar esta acción.'
      case 404:
        return 'El recurso solicitado no fue encontrado.'
      case 429:
        return 'Demasiadas solicitudes. Inténtalo más tarde.'
      case 500:
        return 'Error interno del servidor. Inténtalo más tarde.'
      case 503:
        return 'Servicio no disponible. Inténtalo más tarde.'
      default:
        return `Error del servidor (${status}). Inténtalo más tarde.`
    }
  }

  return 'Ha ocurrido un error inesperado.'
}

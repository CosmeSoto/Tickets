/**
 * Error States Components Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { 
  ErrorDisplay,
  NetworkError,
  ServerError,
  NotFoundError,
  InlineError,
  FieldError,
  useErrorHandler,
  handleApiError
} from '@/components/ui/error-states'
import { renderHook, act } from '@testing-library/react'

describe('ErrorDisplay', () => {
  it('renders error with default title and message', () => {
    render(<ErrorDisplay />)
    expect(screen.getByText('Ha ocurrido un error')).toBeInTheDocument()
    expect(screen.getByText('Algo salió mal. Por favor, inténtalo de nuevo.')).toBeInTheDocument()
  })

  it('renders custom title and message', () => {
    render(
      <ErrorDisplay 
        title="Custom Error" 
        message="This is a custom error message" 
      />
    )
    expect(screen.getByText('Custom Error')).toBeInTheDocument()
    expect(screen.getByText('This is a custom error message')).toBeInTheDocument()
  })

  it('renders retry button when onRetry provided', () => {
    const onRetry = jest.fn()
    render(<ErrorDisplay onRetry={onRetry} />)
    
    const retryButton = screen.getByText('Reintentar')
    expect(retryButton).toBeInTheDocument()
    
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('renders go back button when onGoBack provided', () => {
    const onGoBack = jest.fn()
    render(<ErrorDisplay onGoBack={onGoBack} />)
    
    const backButton = screen.getByText('Volver')
    expect(backButton).toBeInTheDocument()
    
    fireEvent.click(backButton)
    expect(onGoBack).toHaveBeenCalledTimes(1)
  })

  it('renders go home button when onGoHome provided', () => {
    const onGoHome = jest.fn()
    render(<ErrorDisplay onGoHome={onGoHome} />)
    
    const homeButton = screen.getByText('Inicio')
    expect(homeButton).toBeInTheDocument()
    
    fireEvent.click(homeButton)
    expect(onGoHome).toHaveBeenCalledTimes(1)
  })

  it('applies variant styles correctly', () => {
    const { rerender } = render(<ErrorDisplay variant="destructive" />)
    let card = screen.getByText('Ha ocurrido un error').closest('.border-red-200')
    expect(card).toBeInTheDocument()
    
    rerender(<ErrorDisplay variant="warning" />)
    card = screen.getByText('Ha ocurrido un error').closest('.border-amber-200')
    expect(card).toBeInTheDocument()
  })
})

describe('NetworkError', () => {
  it('renders network error with specific message', () => {
    render(<NetworkError />)
    expect(screen.getByText('Error de conexión')).toBeInTheDocument()
    expect(screen.getByText(/No se pudo conectar al servidor/)).toBeInTheDocument()
  })
})

describe('ServerError', () => {
  it('renders server error with specific message', () => {
    render(<ServerError />)
    expect(screen.getByText('Error del servidor')).toBeInTheDocument()
    expect(screen.getByText(/El servidor está experimentando problemas/)).toBeInTheDocument()
  })
})

describe('NotFoundError', () => {
  it('renders not found error with specific message', () => {
    render(<NotFoundError />)
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument()
    expect(screen.getByText(/La página que buscas no existe/)).toBeInTheDocument()
  })
})

describe('InlineError', () => {
  it('renders inline error message', () => {
    render(<InlineError message="This is an error" />)
    expect(screen.getByText('This is an error')).toBeInTheDocument()
  })

  it('renders dismiss button when onDismiss provided', () => {
    const onDismiss = jest.fn()
    render(<InlineError message="Error" onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByText('×')
    expect(dismissButton).toBeInTheDocument()
    
    fireEvent.click(dismissButton)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('applies variant styles', () => {
    const { rerender } = render(<InlineError message="Error" variant="destructive" />)
    // Check for destructive variant (default)
    expect(screen.getByText('Error')).toBeInTheDocument()
    
    rerender(<InlineError message="Warning" variant="warning" />)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })
})

describe('FieldError', () => {
  it('renders field error message', () => {
    render(<FieldError message="Field is required" />)
    expect(screen.getByText('Field is required')).toBeInTheDocument()
  })

  it('does not render when no message provided', () => {
    const { container } = render(<FieldError />)
    expect(container.firstChild).toBeNull()
  })

  it('applies correct styling', () => {
    render(<FieldError message="Error" />)
    const error = screen.getByText('Error')
    expect(error).toHaveClass('text-sm', 'text-red-600', 'mt-1')
  })
})

describe('useErrorHandler', () => {
  it('initializes with no error', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    expect(result.current.error).toBeNull()
    expect(result.current.hasError).toBe(false)
  })

  it('handles Error objects', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.handleError(new Error('Test error'))
    })
    
    expect(result.current.error).toBe('Test error')
    expect(result.current.hasError).toBe(true)
  })

  it('handles string errors', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.handleError('String error')
    })
    
    expect(result.current.error).toBe('String error')
    expect(result.current.hasError).toBe(true)
  })

  it('handles unknown errors', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.handleError({ unknown: 'error' })
    })
    
    expect(result.current.error).toBe('Ha ocurrido un error inesperado')
    expect(result.current.hasError).toBe(true)
  })

  it('clears error', () => {
    const { result } = renderHook(() => useErrorHandler())
    
    act(() => {
      result.current.handleError('Test error')
    })
    
    expect(result.current.hasError).toBe(true)
    
    act(() => {
      result.current.clearError()
    })
    
    expect(result.current.error).toBeNull()
    expect(result.current.hasError).toBe(false)
  })
})

describe('handleApiError', () => {
  it('handles Error objects', () => {
    const error = new Error('Network error')
    expect(handleApiError(error)).toBe('Network error')
  })

  it('handles fetch errors', () => {
    const error = new Error('fetch failed')
    expect(handleApiError(error)).toBe('Error de conexión. Verifica tu conexión a internet.')
  })

  it('handles timeout errors', () => {
    const error = new Error('timeout exceeded')
    expect(handleApiError(error)).toBe('La operación tardó demasiado tiempo. Inténtalo de nuevo.')
  })

  it('handles HTTP status codes', () => {
    expect(handleApiError({ status: 400 })).toBe('Solicitud inválida. Verifica los datos ingresados.')
    expect(handleApiError({ status: 401 })).toBe('No autorizado. Por favor, inicia sesión nuevamente.')
    expect(handleApiError({ status: 403 })).toBe('No tienes permisos para realizar esta acción.')
    expect(handleApiError({ status: 404 })).toBe('El recurso solicitado no fue encontrado.')
    expect(handleApiError({ status: 429 })).toBe('Demasiadas solicitudes. Inténtalo más tarde.')
    expect(handleApiError({ status: 500 })).toBe('Error interno del servidor. Inténtalo más tarde.')
    expect(handleApiError({ status: 503 })).toBe('Servicio no disponible. Inténtalo más tarde.')
    expect(handleApiError({ status: 418 })).toBe('Error del servidor (418). Inténtalo más tarde.')
  })

  it('handles unknown errors', () => {
    expect(handleApiError(null)).toBe('Ha ocurrido un error inesperado.')
    expect(handleApiError(undefined)).toBe('Ha ocurrido un error inesperado.')
    expect(handleApiError({})).toBe('Ha ocurrido un error inesperado.')
  })
})
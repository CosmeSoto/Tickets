/**
 * Hook para envío de formularios con manejo centralizado de loading, errores y toast.
 *
 * Elimina el patrón repetido en 25+ formularios:
 *   const [loading, setLoading] = useState(false)
 *   try { ... } catch (err) { toast(...) } finally { setLoading(false) }
 *
 * @example — Crear
 *   const { submit, loading } = useFormSubmit('/api/inventory/suppliers')
 *   await submit(formData)
 *
 * @example — Editar
 *   const { submit, loading } = useFormSubmit(`/api/inventory/suppliers/${id}`, { method: 'PUT' })
 *   await submit(formData)
 *
 * @example — Con callback
 *   const { submit, loading } = useFormSubmit('/api/tickets', {
 *     successMessage: 'Ticket creado',
 *     onSuccess: (data) => router.push(`/tickets/${data.id}`),
 *   })
 */

'use client'

import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface UseFormSubmitOptions {
  /** HTTP method. Default: 'POST' */
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Mensaje de éxito en el toast. Default: 'Guardado correctamente' */
  successMessage?: string
  /** Descripción adicional del toast de éxito */
  successDescription?: string
  /** Callback ejecutado con la respuesta JSON cuando el submit es exitoso */
  onSuccess?: (data: any) => void
  /** Callback ejecutado con el mensaje de error cuando falla */
  onError?: (message: string) => void
  /** Si es true, no muestra toast de éxito */
  silentSuccess?: boolean
  /** Headers adicionales */
  headers?: Record<string, string>
}

export interface UseFormSubmitReturn {
  /** Envía el formulario. Acepta un objeto (JSON) o FormData */
  submit: (data: Record<string, any> | FormData) => Promise<any | null>
  /** true mientras la petición está en curso */
  loading: boolean
  /** Mensaje del último error, null si no hay error */
  error: string | null
  /** Limpia el error manualmente */
  clearError: () => void
}

export function useFormSubmit(
  endpoint: string,
  options: UseFormSubmitOptions = {}
): UseFormSubmitReturn {
  const {
    method = 'POST',
    successMessage = 'Guardado correctamente',
    successDescription,
    onSuccess,
    onError,
    silentSuccess = false,
    headers: extraHeaders = {},
  } = options

  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(
    async (data: Record<string, any> | FormData): Promise<any | null> => {
      setLoading(true)
      setError(null)

      try {
        const isFormData = data instanceof FormData
        const res = await fetch(endpoint, {
          method,
          headers: isFormData
            ? extraHeaders
            : { 'Content-Type': 'application/json', ...extraHeaders },
          body: isFormData ? data : JSON.stringify(data),
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          const msg = json.error || json.message || `Error ${res.status}`
          throw new Error(msg)
        }

        if (!silentSuccess) {
          toast({
            title: successMessage,
            description: successDescription,
          })
        }

        onSuccess?.(json)
        return json
      } catch (err: any) {
        const msg = err.message || 'Error inesperado'
        setError(msg)
        toast({ title: 'Error', description: msg, variant: 'destructive' })
        onError?.(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [endpoint, method, successMessage, successDescription, silentSuccess, extraHeaders, toast, onSuccess, onError]
  )

  const clearError = useCallback(() => setError(null), [])

  return { submit, loading, error, clearError }
}

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const formSchema = z.object({
  reason: z.string().min(5, 'La razón debe tener al menos 5 caracteres'),
})

type FormData = z.infer<typeof formSchema>

interface DeactivateSaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentIds: string[]
  onSuccess: () => void
}

export function DeactivateSaleDialog({
  open,
  onOpenChange,
  equipmentIds,
  onSuccess,
}: DeactivateSaleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/inventory/sales/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentIds,
          ...data,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al desactivar equipos')
      }

      const result = await response.json()
      toast.success(`${result.updated} equipo(s) desactivado(s) de venta`)
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al desactivar equipos')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desactivar Equipos de Venta</DialogTitle>
          <DialogDescription>
            Desactivar {equipmentIds.length} equipo(s) de venta pública
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='reason'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón de Desactivación *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Explique por qué se desactivan estos equipos...'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type='submit' variant='destructive' disabled={isLoading}>
                {isLoading ? 'Desactivando...' : 'Desactivar de Venta'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

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
import { CheckCircle, XCircle } from 'lucide-react'

const formSchema = z.object({
  comment: z.string().min(10, 'El comentario debe tener al menos 10 caracteres'),
})

type FormData = z.infer<typeof formSchema>

interface AssetRequestReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestId: string
  requestCode: string
  action: 'approve' | 'reject'
  onSuccess: () => void
}

export function AssetRequestReviewDialog({
  open,
  onOpenChange,
  requestId,
  requestCode,
  action,
  onSuccess,
}: AssetRequestReviewDialogProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

      const response = await fetch(`/api/inventory/asset-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          comment: data.comment,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al actualizar solicitud')
      }

      toast.success(
        action === 'approve' ? 'Solicitud aprobada exitosamente' : 'Solicitud rechazada'
      )
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al actualizar solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  const title = action === 'approve' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'
  const description =
    action === 'approve'
      ? `Aprobar la solicitud ${requestCode}`
      : `Rechazar la solicitud ${requestCode}`
  const buttonText = action === 'approve' ? 'Aprobar' : 'Rechazar'
  const buttonVariant = action === 'approve' ? 'default' : 'destructive'
  const Icon = action === 'approve' ? CheckCircle : XCircle

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Icon className='h-5 w-5' />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='comment'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentario *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        action === 'approve'
                          ? 'Explica por qué se aprueba esta solicitud...'
                          : 'Explica por qué se rechaza esta solicitud...'
                      }
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
              <Button type='submit' variant={buttonVariant} disabled={isLoading}>
                {isLoading ? 'Procesando...' : buttonText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

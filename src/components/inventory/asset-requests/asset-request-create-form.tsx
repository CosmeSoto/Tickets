'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { AssetType } from '@prisma/client'

const formSchema = z.object({
  assetType: z.nativeEnum(AssetType),
  familyId: z.string().min(1, 'Selecciona una familia'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  justification: z.string().min(20, 'La justificación debe tener al menos 20 caracteres'),
  quantity: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1'),
  neededBy: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface Family {
  id: string
  name: string
  color: string | null
}

interface AssetRequestCreateFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function AssetRequestCreateForm({ onSuccess, onCancel }: AssetRequestCreateFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [families, setFamilies] = useState<Family[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(true)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      assetType: 'EQUIPMENT',
      familyId: '',
      description: '',
      justification: '',
      quantity: 1,
      neededBy: '',
    },
  })

  // Cargar familias disponibles (módulo inventario)
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        const response = await fetch('/api/inventory/families')
        if (response.ok) {
          const data = await response.json()
          setFamilies(data.families || [])
        }
      } catch (error) {
        console.error('Error cargando familias:', error)
        toast.error('Error al cargar familias')
      } finally {
        setLoadingFamilies(false)
      }
    }

    loadFamilies()
  }, [])

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/inventory/asset-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear solicitud')
      }

      const result = await response.json()
      toast.success('Solicitud creada exitosamente')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/inventory/asset-requests/${result.id}`)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al crear solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardContent className='pt-6'>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
            {/* Tipo de Activo */}
            <FormField
              control={form.control}
              name='assetType'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Activo *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar tipo' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='EQUIPMENT'>Equipo</SelectItem>
                      <SelectItem value='LICENSE'>Licencia</SelectItem>
                      <SelectItem value='MAINTENANCE'>Mantenimiento</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Familia */}
            <FormField
              control={form.control}
              name='familyId'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Familia *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={loadingFamilies}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Seleccionar familia' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {families.map(family => (
                        <SelectItem key={family.id} value={family.id}>
                          {family.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descripción */}
            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción *</FormLabel>
                  <FormControl>
                    <Textarea placeholder='Describe el activo que necesitas...' {...field} />
                  </FormControl>
                  <FormDescription>Mínimo 10 caracteres</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Justificación */}
            <FormField
              control={form.control}
              name='justification'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Justificación *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Mínimo 20 caracteres. Explica el propósito y la necesidad'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cantidad */}
            <FormField
              control={form.control}
              name='quantity'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad</FormLabel>
                  <FormControl>
                    <Input type='number' min='1' {...field} />
                  </FormControl>
                  <FormDescription>Número de unidades que necesitas</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fecha Necesaria */}
            <FormField
              control={form.control}
              name='neededBy'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha Necesaria (Opcional)</FormLabel>
                  <FormControl>
                    <Input type='date' {...field} />
                  </FormControl>
                  <FormDescription>¿Para cuándo necesitas el activo?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Botones */}
            <div className='flex gap-2 justify-end'>
              {onCancel && (
                <Button type='button' variant='outline' onClick={onCancel} disabled={isLoading}>
                  Cancelar
                </Button>
              )}
              <Button type='submit' disabled={isLoading}>
                {isLoading ? 'Creando...' : 'Crear Solicitud'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

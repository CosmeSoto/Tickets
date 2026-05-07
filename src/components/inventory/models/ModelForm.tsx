/**
 * ModelForm Component
 * Formulario para crear/editar modelos de equipos
 */

'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'

// Schema de validación
const modelFormSchema = z.object({
  brand: z.string().min(1, 'La marca es requerida').max(100),
  model: z.string().min(1, 'El modelo es requerido').max(200),
  sku: z.string().max(100).optional().or(z.literal('')),
  typeId: z.string().uuid('Selecciona un tipo de equipo'),
  specifications: z.string().optional(),
  defaultAccessories: z.string().optional(),
  standardPrice: z.string().optional(),
  modelPhotoUrl: z.string().url('URL inválida').optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})

type ModelFormValues = z.infer<typeof modelFormSchema>

interface EquipmentType {
  id: string
  name: string
  code: string
}

interface ModelFormProps {
  initialData?: Partial<ModelFormValues> & { id?: string }
  onSubmit: (data: ModelFormValues) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
}

export function ModelForm({ initialData, onSubmit, onCancel, isLoading = false }: ModelFormProps) {
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  const form = useForm<ModelFormValues>({
    resolver: zodResolver(modelFormSchema),
    defaultValues: {
      brand: initialData?.brand || '',
      model: initialData?.model || '',
      sku: initialData?.sku || '',
      typeId: initialData?.typeId || '',
      specifications: initialData?.specifications || '',
      defaultAccessories: initialData?.defaultAccessories || '',
      standardPrice: initialData?.standardPrice || '',
      modelPhotoUrl: initialData?.modelPhotoUrl || '',
      isActive: initialData?.isActive ?? true,
    },
  })

  // Cargar tipos de equipo
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const response = await fetch('/api/inventory/equipment-types')
        if (!response.ok) throw new Error('Error al cargar tipos')

        const data = await response.json()
        setTypes(data.types || [])
      } catch (error) {
        console.error('Error fetching types:', error)
      } finally {
        setLoadingTypes(false)
      }
    }

    fetchTypes()
  }, [])

  const handleSubmit = async (data: ModelFormValues) => {
    try {
      // Parsear specifications si es JSON
      let specifications = undefined
      if (data.specifications && data.specifications.trim()) {
        try {
          specifications = JSON.parse(data.specifications)
        } catch {
          // Si no es JSON válido, guardar como objeto con una clave
          specifications = { description: data.specifications }
        }
      }

      // Parsear accessories (uno por línea)
      let defaultAccessories = undefined
      if (data.defaultAccessories && data.defaultAccessories.trim()) {
        defaultAccessories = data.defaultAccessories
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
      }

      // Parsear precio
      let standardPrice = undefined
      if (data.standardPrice && data.standardPrice.trim()) {
        standardPrice = parseFloat(data.standardPrice)
      }

      await onSubmit({
        ...data,
        specifications: specifications ? JSON.stringify(specifications) : undefined,
        defaultAccessories: defaultAccessories ? defaultAccessories.join('\n') : undefined,
        standardPrice: standardPrice ? standardPrice.toString() : undefined,
      } as ModelFormValues)
    } catch (error) {
      console.error('Error submitting form:', error)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          {/* Marca */}
          <FormField
            control={form.control}
            name='brand'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Marca *</FormLabel>
                <FormControl>
                  <Input placeholder='Dell, HP, Lenovo...' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Modelo */}
          <FormField
            control={form.control}
            name='model'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo *</FormLabel>
                <FormControl>
                  <Input placeholder='Latitude 5420, ThinkPad X1...' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* SKU */}
          <FormField
            control={form.control}
            name='sku'
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder='SKU-12345' {...field} />
                </FormControl>
                <FormDescription>Código único del modelo (opcional)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tipo */}
          <FormField
            control={form.control}
            name='typeId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Equipo *</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loadingTypes}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Seleccionar tipo...' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {types.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} ({type.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Precio estándar */}
          <FormField
            control={form.control}
            name='standardPrice'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio Estándar</FormLabel>
                <FormControl>
                  <Input type='number' step='0.01' placeholder='450.00' {...field} />
                </FormControl>
                <FormDescription>Precio de referencia (opcional)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* URL de foto */}
          <FormField
            control={form.control}
            name='modelPhotoUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL de Foto</FormLabel>
                <FormControl>
                  <Input type='url' placeholder='https://...' {...field} />
                </FormControl>
                <FormDescription>URL de la imagen del modelo</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Especificaciones */}
        <FormField
          control={form.control}
          name='specifications'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Especificaciones</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='{"cpu": "Intel i7", "ram": "16GB", "storage": "512GB SSD"}'
                  rows={4}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Especificaciones técnicas en formato JSON (opcional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Accesorios por defecto */}
        <FormField
          control={form.control}
          name='defaultAccessories'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Accesorios por Defecto</FormLabel>
              <FormControl>
                <Textarea
                  placeholder='Cargador&#10;Mouse&#10;Teclado'
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>Un accesorio por línea (opcional)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botones */}
        <div className='flex justify-end gap-3'>
          {onCancel && (
            <Button type='button' variant='outline' onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
          )}
          <Button type='submit' disabled={isLoading}>
            {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {initialData?.id ? 'Actualizar' : 'Crear'} Modelo
          </Button>
        </div>
      </form>
    </Form>
  )
}

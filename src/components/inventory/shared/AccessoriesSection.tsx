'use client'

import { useState } from 'react'
import { Plus, X, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface AccessoriesSectionProps {
  accessories: string[]
  onChange: (accessories: string[]) => void
  /** Si es true, renderiza sin Card (solo el contenido) */
  inline?: boolean
}

export function AccessoriesSection({
  accessories,
  onChange,
  inline = false,
}: AccessoriesSectionProps) {
  const [newAccessory, setNewAccessory] = useState('')

  const addAccessory = () => {
    const trimmed = newAccessory.trim()
    if (trimmed && trimmed.length > 0 && !accessories.includes(trimmed)) {
      onChange([...accessories, trimmed])
      setNewAccessory('')
    }
  }

  const removeAccessory = (index: number) => {
    onChange(accessories.filter((_, i) => i !== index))
  }

  const content = (
    <div className='space-y-4'>
      <div className='flex gap-2'>
        <Input
          value={newAccessory}
          onChange={e => setNewAccessory(e.target.value)}
          placeholder='Ej: Cargador, Mouse inalámbrico, Cable HDMI'
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addAccessory()
            }
          }}
          className='flex-1'
        />
        <Button
          type='button'
          onClick={addAccessory}
          size={inline ? 'sm' : 'icon'}
          variant={inline ? 'outline' : 'secondary'}
          disabled={!newAccessory.trim()}
        >
          <Plus className='h-4 w-4' />
        </Button>
      </div>

      {accessories.length === 0 ? (
        inline ? null : (
          <div className='text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg'>
            <Package className='h-8 w-8 mx-auto mb-2 opacity-50' />
            <p className='text-sm'>No se han agregado accesorios</p>
            <p className='text-xs mt-1'>Agrega accesorios usando el campo de arriba</p>
          </div>
        )
      ) : (
        <div className='flex flex-wrap gap-2'>
          {accessories.map((accessory, index) => (
            <div
              key={index}
              className={
                inline
                  ? 'inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs'
                  : 'flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm'
              }
            >
              {!inline && <Package className='h-3 w-3' />}
              <span>{accessory}</span>
              <button
                type='button'
                onClick={() => removeAccessory(index)}
                className='ml-1 hover:text-destructive transition-colors'
                aria-label={`Eliminar ${accessory}`}
              >
                <X className='h-3 w-3' />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (inline) {
    return (
      <div className='space-y-2'>
        <Label>Accesorios</Label>
        {content}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accesorios</CardTitle>
        <CardDescription>Lista de accesorios incluidos con el equipo</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

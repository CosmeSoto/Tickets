'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Minus, Plus } from 'lucide-react'

interface QuantitySelectorProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function QuantitySelector({ value, onChange, min = 1, max = 100 }: QuantitySelectorProps) {
  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || min
    if (newValue >= min && newValue <= max) {
      onChange(newValue)
    }
  }

  return (
    <div className='space-y-2'>
      <Label htmlFor='quantity'>¿Cuántos equipos deseas crear?</Label>
      <div className='flex items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='icon'
          onClick={handleDecrement}
          disabled={value <= min}
        >
          <Minus className='w-4 h-4' />
        </Button>

        <Input
          id='quantity'
          type='number'
          min={min}
          max={max}
          value={value}
          onChange={handleInputChange}
          className='w-24 text-center'
        />

        <Button
          type='button'
          variant='outline'
          size='icon'
          onClick={handleIncrement}
          disabled={value >= max}
        >
          <Plus className='w-4 h-4' />
        </Button>

        <div className='ml-4 text-sm text-gray-600'>
          {value === 1 ? (
            <span className='font-medium text-blue-600'>Modo: Creación Individual</span>
          ) : (
            <span className='font-medium text-green-600'>
              Modo: Creación por Lote ({value} equipos)
            </span>
          )}
        </div>
      </div>
      <p className='text-xs text-gray-500'>
        {value === 1
          ? 'Ingresarás todos los datos del equipo en un solo formulario'
          : 'Primero ingresarás datos comunes, luego datos individuales de cada equipo'}
      </p>
    </div>
  )
}

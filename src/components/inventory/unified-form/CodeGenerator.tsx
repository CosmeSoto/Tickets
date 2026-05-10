'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CodeGeneratorProps {
  quantity: number
  onGenerate: (codes: string[]) => void
  onClose: () => void
}

export function CodeGenerator({ quantity, onGenerate, onClose }: CodeGeneratorProps) {
  const [prefix, setPrefix] = useState('EQ')
  const [startNumber, setStartNumber] = useState(1)
  const [padding, setPadding] = useState(3)
  const [separator, setSeparator] = useState('-')
  const [preview, setPreview] = useState<string[]>([])

  const generatePreview = () => {
    const codes: string[] = []
    for (let i = 0; i < Math.min(quantity, 5); i++) {
      const number = (startNumber + i).toString().padStart(padding, '0')
      codes.push(`${prefix}${separator}${number}`)
    }
    setPreview(codes)
  }

  const handleGenerate = () => {
    const codes: string[] = []
    for (let i = 0; i < quantity; i++) {
      const number = (startNumber + i).toString().padStart(padding, '0')
      codes.push(`${prefix}${separator}${number}`)
    }
    onGenerate(codes)
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Generador de Códigos Secuenciales</DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='prefix'>Prefijo</Label>
              <Input
                id='prefix'
                value={prefix}
                onChange={e => setPrefix(e.target.value.toUpperCase())}
                placeholder='EQ'
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='separator'>Separador</Label>
              <Select value={separator} onValueChange={setSeparator}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='-'>Guión (-)</SelectItem>
                  <SelectItem value='_'>Guión bajo (_)</SelectItem>
                  <SelectItem value=''>Sin separador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='startNumber'>Número Inicial</Label>
              <Input
                id='startNumber'
                type='number'
                min='1'
                value={startNumber}
                onChange={e => setStartNumber(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='padding'>Dígitos (Padding)</Label>
              <Select value={padding.toString()} onValueChange={v => setPadding(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='2'>2 dígitos (01, 02...)</SelectItem>
                  <SelectItem value='3'>3 dígitos (001, 002...)</SelectItem>
                  <SelectItem value='4'>4 dígitos (0001, 0002...)</SelectItem>
                  <SelectItem value='5'>5 dígitos (00001, 00002...)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label>Vista Previa</Label>
              <Button type='button' variant='outline' size='sm' onClick={generatePreview}>
                Actualizar Vista Previa
              </Button>
            </div>
            {preview.length > 0 && (
              <div className='p-4 bg-gray-50 rounded border space-y-1'>
                {preview.map((code, index) => (
                  <div key={index} className='font-mono text-sm'>
                    {code}
                  </div>
                ))}
                {quantity > 5 && (
                  <div className='text-sm text-gray-500 italic'>
                    ... y {quantity - 5} códigos más
                  </div>
                )}
              </div>
            )}
          </div>

          <div className='p-3 bg-blue-50 border border-blue-200 rounded'>
            <p className='text-sm text-blue-800'>
              <strong>Total:</strong> Se generarán {quantity} códigos secuenciales
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate}>Generar Códigos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, AlertCircle } from 'lucide-react'

interface UserPersonalDataSectionProps {
  name: string
  email: string
  phone: string
  errors: Record<string, string>
  onChange: (field: 'name' | 'email' | 'phone', value: string) => void
}

export function UserPersonalDataSection({
  name,
  email,
  phone,
  errors,
  onChange,
}: UserPersonalDataSectionProps) {
  const fields = [
    {
      id: 'edit-name',
      label: 'Nombre completo',
      key: 'name' as const,
      placeholder: 'Juan Pérez',
      type: undefined,
      required: true,
      value: name,
    },
    {
      id: 'edit-email',
      label: 'Email',
      key: 'email' as const,
      placeholder: 'usuario@empresa.com',
      type: 'email' as const,
      required: true,
      value: email,
    },
    {
      id: 'edit-phone',
      label: 'Teléfono',
      key: 'phone' as const,
      placeholder: '+593 99 999 9999',
      type: undefined,
      required: false,
      value: phone,
    },
  ]

  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
        <User className='h-4 w-4 text-muted-foreground' />
        Datos personales
      </h3>
      <div className='grid grid-cols-2 gap-3'>
        {fields.map(({ id, label, key, placeholder, type, required, value }) => (
          <div key={id} className='space-y-1'>
            <Label htmlFor={id}>
              {label} {required && <span className='text-destructive'>*</span>}
            </Label>
            <Input
              id={id}
              type={type}
              value={value}
              onChange={e => onChange(key, e.target.value)}
              placeholder={placeholder}
              className={errors[key] ? 'border-destructive' : ''}
            />
            {errors[key] && (
              <p className='text-xs text-destructive flex items-center gap-1'>
                <AlertCircle className='h-3 w-3' />
                {errors[key]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

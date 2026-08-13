'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { User, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react'

interface CreateUserPersonalSectionProps {
  name: string
  email: string
  password: string
  phone: string
  showPassword: boolean
  passwordMinLength: number
  errors: Record<string, string>
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onTogglePassword: () => void
}

export function CreateUserPersonalSection({
  name,
  email,
  password,
  phone,
  showPassword,
  passwordMinLength,
  errors,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onPhoneChange,
  onTogglePassword,
}: CreateUserPersonalSectionProps) {
  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
        <User className='h-4 w-4 text-muted-foreground' />
        Datos personales
      </h3>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label htmlFor='create-name'>
            Nombre completo <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='create-name'
            value={name}
            onChange={e => onNameChange(e.target.value)}
            placeholder='Juan Pérez'
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className='text-xs text-destructive flex items-center gap-1'>
              <AlertCircle className='h-3 w-3' />
              {errors.name}
            </p>
          )}
        </div>
        <div className='space-y-1'>
          <Label htmlFor='create-email'>
            Email <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='create-email'
            type='email'
            value={email}
            onChange={e => onEmailChange(e.target.value)}
            placeholder='usuario@empresa.com'
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && (
            <p className='text-xs text-destructive flex items-center gap-1'>
              <AlertCircle className='h-3 w-3' />
              {errors.email}
            </p>
          )}
        </div>
        <div className='space-y-1'>
          <Label htmlFor='create-phone'>Teléfono</Label>
          <Input
            id='create-phone'
            value={phone}
            onChange={e => onPhoneChange(e.target.value)}
            placeholder='+593 99 999 9999'
            className={errors.phone ? 'border-destructive' : ''}
          />
          {errors.phone && (
            <p className='text-xs text-destructive flex items-center gap-1'>
              <AlertCircle className='h-3 w-3' />
              {errors.phone}
            </p>
          )}
        </div>
      </div>

      <div className='space-y-3'>
        <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
          <Mail className='h-4 w-4 text-muted-foreground' />
          Acceso al sistema
        </h3>
        <div className='space-y-1'>
          <Label htmlFor='create-password'>
            Contraseña <span className='text-destructive'>*</span>
          </Label>
          <div className='relative'>
            <Input
              id='create-password'
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => onPasswordChange(e.target.value)}
              placeholder={`Mínimo ${passwordMinLength} caracteres`}
              className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
            />
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='absolute right-0 top-0 h-full px-3'
              onClick={onTogglePassword}
            >
              {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </Button>
          </div>
          {errors.password && (
            <p className='text-xs text-destructive flex items-center gap-1'>
              <AlertCircle className='h-3 w-3' />
              {errors.password}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

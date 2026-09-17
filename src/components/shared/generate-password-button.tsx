'use client'

import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePasswordPolicy } from '@/hooks/use-password-policy'
import { generatePassword } from '@/lib/password'

// La política del sistema es un piso mínimo, no un objetivo de fortaleza:
// generamos al menos este largo aunque el mínimo configurado sea menor.
const MIN_GENERATED_LENGTH = 16

interface GeneratePasswordButtonProps {
  onGenerate: (password: string) => void
  className?: string
}

/**
 * Botón reutilizable para generar una contraseña aleatoria segura, respetando
 * la longitud mínima configurada en Admin → Configuración Sistema → Seguridad.
 */
export function GeneratePasswordButton({ onGenerate, className }: GeneratePasswordButtonProps) {
  const { minLength } = usePasswordPolicy()

  return (
    <Button
      type='button'
      variant='outline'
      size='icon'
      className={className}
      onClick={() => onGenerate(generatePassword(Math.max(minLength, MIN_GENERATED_LENGTH)))}
      title='Generar contraseña aleatoria'
    >
      <Wand2 className='h-4 w-4' />
    </Button>
  )
}

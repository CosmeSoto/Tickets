'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Unlock, X } from 'lucide-react'

interface UserSecuritySectionProps {
  isLocked: boolean
  onResetPassword: (password: string) => Promise<void>
  onUnlock: () => Promise<void>
}

export function UserSecuritySection({
  isLocked,
  onResetPassword,
  onUnlock,
}: UserSecuritySectionProps) {
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)

  const handleResetPassword = async () => {
    if (newPassword.length < 6) return
    setResetPasswordLoading(true)
    try {
      await onResetPassword(newPassword)
      setShowResetPassword(false)
      setNewPassword('')
    } finally {
      setResetPasswordLoading(false)
    }
  }

  const handleUnlock = async () => {
    setUnlockLoading(true)
    try {
      await onUnlock()
    } finally {
      setUnlockLoading(false)
    }
  }

  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
        <Lock className='h-4 w-4 text-muted-foreground' />
        Seguridad
      </h3>
      <div className='flex flex-wrap gap-2'>
        {!showResetPassword ? (
          <>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setShowResetPassword(true)}
              className='text-amber-600 border-amber-300 hover:bg-amber-50'
            >
              <Lock className='h-3.5 w-3.5 mr-1.5' />
              Resetear contraseña
            </Button>
            {isLocked && (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={handleUnlock}
                disabled={unlockLoading}
                className='text-primary border-primary/30 hover:bg-primary/10'
              >
                <Unlock className='h-3.5 w-3.5 mr-1.5' />
                {unlockLoading ? 'Desbloqueando...' : 'Desbloquear acceso'}
              </Button>
            )}
          </>
        ) : (
          <div className='flex items-center gap-2 w-full'>
            <Input
              type='password'
              placeholder='Nueva contraseña (mín. 6 caracteres)'
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className='flex-1 h-8 text-sm'
              autoFocus
            />
            <Button
              type='button'
              size='sm'
              onClick={handleResetPassword}
              disabled={resetPasswordLoading || newPassword.length < 6}
              className='bg-amber-600 hover:bg-amber-700 text-white shrink-0'
            >
              {resetPasswordLoading ? 'Guardando...' : 'Confirmar'}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => {
                setShowResetPassword(false)
                setNewPassword('')
              }}
              className='shrink-0'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

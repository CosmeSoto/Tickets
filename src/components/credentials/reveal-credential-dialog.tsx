'use client'

import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Copy, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type CredentialEntry = {
  id: string
  title: string
  username?: string | null
}

interface RevealCredentialDialogProps {
  entry: CredentialEntry | null
  onClose: () => void
}

const REVEAL_CLEAR_MS = 30_000

export function RevealCredentialDialog({ entry, onClose }: RevealCredentialDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [showSecret, setShowSecret] = useState(true)

  const handleClose = () => {
    setSecret(null)
    setConfirmed(false)
    setShowSecret(true)
    onClose()
  }

  useEffect(() => {
    if (!secret) return
    const t = setTimeout(() => {
      setSecret(null)
      setConfirmed(false)
      onClose()
    }, REVEAL_CLEAR_MS)
    return () => clearTimeout(t)
  }, [secret, onClose])

  const handleReveal = async () => {
    if (!entry) return
    setLoading(true)
    try {
      const res = await fetch(`/api/credentials/entries/${entry.id}/reveal`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Error al revelar')
      setSecret(data.secret)
      setConfirmed(true)
    } catch (err: unknown) {
      toast({
        title: 'No se pudo revelar',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  const copyText = async (value: string, label: string) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    toast({ title: `${label} copiado` })
  }

  return (
    <AlertDialog open={!!entry} onOpenChange={open => !open && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usar credencial</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmed
              ? 'El secreto se oculta automáticamente en 30 s. Esta acción quedó registrada en auditoría.'
              : `¿Confirmas revelar la contraseña de «${entry?.title}»? Queda auditado.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {confirmed && secret !== null ? (
          <div className='space-y-3'>
            {entry?.username ? (
              <div className='flex gap-2'>
                <Input readOnly value={entry.username} className='font-mono text-sm' />
                <Button
                  type='button'
                  variant='outline'
                  size='icon'
                  onClick={() => copyText(entry.username!, 'Usuario')}
                  title='Copiar usuario'
                >
                  <Copy className='h-4 w-4' />
                </Button>
              </div>
            ) : null}
            <div className='flex gap-2'>
              <Input
                readOnly
                type={showSecret ? 'text' : 'password'}
                value={secret}
                className='font-mono text-sm'
              />
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={() => setShowSecret(s => !s)}
                title={showSecret ? 'Ocultar' : 'Mostrar'}
              >
                {showSecret ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={() => copyText(secret, 'Contraseña')}
                title='Copiar contraseña'
              >
                <Copy className='h-4 w-4' />
              </Button>
            </div>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cerrar</AlertDialogCancel>
          {!confirmed && (
            <AlertDialogAction onClick={handleReveal} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                  Revelando…
                </>
              ) : (
                'Confirmar y revelar'
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

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
import { Copy, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type CredentialEntry = {
  id: string
  title: string
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

  const handleClose = () => {
    setSecret(null)
    setConfirmed(false)
    onClose()
  }

  // Auto-ocultar secreto revelado
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al revelar')
      setSecret(data.secret)
      setConfirmed(true)
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message ?? 'No se pudo revelar la credencial',
        variant: 'destructive',
      })
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  const copySecret = async () => {
    if (!secret) return
    await navigator.clipboard.writeText(secret)
    toast({ title: 'Copiado al portapapeles' })
  }

  return (
    <AlertDialog open={!!entry} onOpenChange={open => !open && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revelar credencial</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmed
              ? 'El secreto se muestra una sola vez. Esta acción queda registrada en auditoría.'
              : `¿Confirmas revelar la contraseña de "${entry?.title}"? Esta acción queda auditada.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {confirmed && secret !== null ? (
          <div className='flex gap-2'>
            <Input readOnly value={secret} className='font-mono text-sm' />
            <Button type='button' variant='outline' size='icon' onClick={copySecret}>
              <Copy className='h-4 w-4' />
            </Button>
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cerrar</AlertDialogCancel>
          {!confirmed && (
            <AlertDialogAction onClick={handleReveal} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                  Revelando...
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

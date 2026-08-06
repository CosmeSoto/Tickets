'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Share2, Trash2, UserPlus } from 'lucide-react'

type ShareRow = {
  id: string
  capability: string
  user: { id: string; name: string; email: string; role: string } | null
}

type Candidate = { id: string; name: string; email: string; role: string }

interface ShareCredentialDialogProps {
  entry: { id: string; title: string } | null
  onClose: () => void
}

export function ShareCredentialDialog({ entry, onClose }: ShareCredentialDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shares, setShares] = useState<ShareRow[]>([])
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')

  const loadShares = async (entryId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/credentials/entries/${entryId}/shares`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los compartidos')
      setShares(data.shares ?? [])
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al cargar',
        variant: 'destructive',
      })
      onClose()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!entry) {
      setShares([])
      setSelectedUserId('')
      setQuery('')
      setCandidates([])
      return
    }
    void loadShares(entry.id)
  }, [entry?.id])

  useEffect(() => {
    if (!entry) return
    const t = setTimeout(() => {
      fetch(`/api/credentials/share-candidates?q=${encodeURIComponent(query)}`)
        .then(r => (r.ok ? r.json() : { users: [] }))
        .then(data => setCandidates(data.users ?? []))
        .catch(() => setCandidates([]))
    }, 250)
    return () => clearTimeout(t)
  }, [query, entry])

  const handleShare = async () => {
    if (!entry || !selectedUserId) {
      toast({
        title: 'Selecciona un usuario',
        description: 'Solo aparecen usuarios con el módulo Credenciales activo',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/credentials/entries/${entry.id}/shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, capability: 'VIEW' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo compartir')
      toast({
        title: 'Credencial compartida',
        description: 'El usuario recibirá una notificación. No se envió la contraseña en claro.',
      })
      setSelectedUserId('')
      await loadShares(entry.id)
    } catch (err: unknown) {
      toast({
        title: 'No se pudo compartir',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (shareId: string) => {
    if (!entry) return
    if (!window.confirm('¿Revocar el acceso compartido a este usuario?')) return
    const res = await fetch(
      `/api/credentials/entries/${entry.id}/shares?shareId=${encodeURIComponent(shareId)}`,
      { method: 'DELETE' }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({
        title: 'No se pudo revocar',
        description: data.error || 'Error del servidor',
        variant: 'destructive',
      })
      return
    }
    toast({ title: 'Acceso revocado' })
    await loadShares(entry.id)
  }

  return (
    <Dialog open={!!entry} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Share2 className='h-4 w-4' />
            Compartir credencial
          </DialogTitle>
          <DialogDescription>
            Comparte «{entry?.title}» con otro usuario que tenga Credenciales activo. Solo podrá
            revelar/usar (queda auditado); no recibe la clave por notificación.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <div className='space-y-4 py-1'>
            <div className='space-y-1.5'>
              <Label>Buscar usuario</Label>
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder='Nombre o email…'
              />
              <div className='max-h-36 overflow-y-auto rounded-md border divide-y'>
                {candidates.length === 0 ? (
                  <p className='p-3 text-sm text-muted-foreground'>
                    No hay candidatos. Activa Credenciales en Usuarios para el destinatario.
                  </p>
                ) : (
                  candidates.map(u => (
                    <button
                      key={u.id}
                      type='button'
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${
                        selectedUserId === u.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <span className='font-medium'>{u.name}</span>
                      <span className='text-muted-foreground'> · {u.email}</span>
                      <Badge variant='outline' className='ml-2 text-[10px]'>
                        {u.role}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>

            <Button onClick={handleShare} disabled={saving || !selectedUserId} className='w-full'>
              {saving ? (
                <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
              ) : (
                <UserPlus className='h-4 w-4 mr-1.5' />
              )}
              Compartir (solo ver / revelar)
            </Button>

            <div className='space-y-2'>
              <Label>Ya compartida con</Label>
              {shares.length === 0 ? (
                <p className='text-sm text-muted-foreground'>Nadie más tiene acceso por share.</p>
              ) : (
                <ul className='space-y-2'>
                  {shares.map(s => (
                    <li
                      key={s.id}
                      className='flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'
                    >
                      <div className='min-w-0'>
                        <p className='font-medium truncate'>{s.user?.name ?? 'Usuario'}</p>
                        <p className='text-xs text-muted-foreground truncate'>{s.user?.email}</p>
                      </div>
                      <div className='flex items-center gap-2 shrink-0'>
                        <Badge variant='secondary'>{s.capability}</Badge>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='text-destructive'
                          onClick={() => handleRevoke(s.id)}
                          title='Revocar'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

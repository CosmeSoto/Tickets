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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Share2, Trash2, UserPlus } from 'lucide-react'

type ShareRow = {
  id: string
  capability: string
  user: { id: string; name: string; email: string; role: string } | null
}

type Candidate = {
  id: string
  name: string
  email: string
  role: string
  canReceiveShare?: boolean
  reasonBlocked?: string
  credentialsEnabled?: boolean
}

interface ShareCredentialDialogProps {
  entry: { id: string; title: string } | null
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente',
}

export function ShareCredentialDialog({ entry, onClose }: ShareCredentialDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [shares, setShares] = useState<ShareRow[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [metaRule, setMetaRule] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loadingCandidates, setLoadingCandidates] = useState(false)

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

  const loadCandidates = async () => {
    if (!entry) return
    setLoadingCandidates(true)
    try {
      const res = await fetch(
        `/api/credentials/share-candidates?entryId=${encodeURIComponent(entry.id)}`
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar usuarios')
      setCandidates(data.users ?? [])
      setMetaRule(data.meta?.rule ?? '')
    } catch (err: unknown) {
      setCandidates([])
      toast({
        title: 'No se pudo cargar usuarios',
        description: err instanceof Error ? err.message : 'Error de red',
        variant: 'destructive',
      })
    } finally {
      setLoadingCandidates(false)
    }
  }

  useEffect(() => {
    if (!entry) {
      setShares([])
      setSelectedUserId('')
      setCandidates([])
      return
    }
    void loadShares(entry.id)
    void loadCandidates()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir por entry.id
  }, [entry?.id])

  const selected = candidates.find(c => c.id === selectedUserId)
  const canShareSelected = Boolean(selected?.canReceiveShare)

  const handleShare = async () => {
    if (!entry || !selectedUserId) {
      toast({
        title: 'Selecciona un usuario',
        description: 'Elige un destinatario del desplegable',
        variant: 'destructive',
      })
      return
    }
    if (!canShareSelected) {
      toast({
        title: 'Destinatario no listo',
        description:
          selected?.reasonBlocked ||
          'Activa el módulo Credenciales en Usuarios para este destinatario',
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
        description: 'Queda auditado. El usuario recibe notificación sin la clave en claro.',
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
            Comparte «{entry?.title}» con usuarios de tu nivel o inferior que compartan tu área
            nativa o alguna familia asignada de Credenciales. Solo podrá revelar/usar (auditado); no
            recibe la clave por notificación.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='flex justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <div className='space-y-4 py-1'>
            {metaRule ? (
              <p className='text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2'>
                {metaRule}
              </p>
            ) : null}

            <div className='space-y-1.5'>
              <Label>Usuario del sistema</Label>
              {loadingCandidates ? (
                <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Cargando usuarios…
                </div>
              ) : (
                <Select value={selectedUserId || undefined} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar usuario…' />
                  </SelectTrigger>
                  <SelectContent className='max-h-72'>
                    {candidates.length === 0 ? (
                      <div className='px-3 py-2 text-sm text-muted-foreground'>
                        No hay usuarios en tu alcance.
                      </div>
                    ) : (
                      candidates.map(u => (
                        <SelectItem key={u.id} value={u.id} disabled={u.canReceiveShare === false}>
                          <span className='flex flex-col items-start gap-0.5 py-0.5'>
                            <span>
                              {u.name}{' '}
                              <span className='text-muted-foreground'>
                                ({ROLE_LABEL[u.role] ?? u.role})
                              </span>
                            </span>
                            <span className='text-xs text-muted-foreground'>{u.email}</span>
                            {u.canReceiveShare === false ? (
                              <span className='text-xs text-amber-600'>
                                Sin módulo Credenciales
                              </span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {selected && selected.canReceiveShare === false ? (
                <p className='text-xs text-amber-700'>{selected.reasonBlocked}</p>
              ) : null}
            </div>

            <Button
              onClick={handleShare}
              disabled={saving || !selectedUserId || !canShareSelected}
              className='w-full'
            >
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

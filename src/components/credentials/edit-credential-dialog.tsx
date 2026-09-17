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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, Loader2, Pencil } from 'lucide-react'
import {
  formatCredentialVaultLabel,
  CREDENTIAL_ENTRY_TYPE_LABELS,
} from '@/lib/credentials/constants'
import { GeneratePasswordButton } from '@/components/shared/generate-password-button'

export type EditableCredentialEntry = {
  id: string
  title: string
  username?: string | null
  url?: string | null
  notes?: string | null
  entryType: string
  equipment?: {
    id: string
    code: string
    brand?: string | null
    model?: { model: string } | null
  } | null
  license?: { id: string; name: string } | null
  vault?: { id: string; name: string; kind?: string; family?: { name: string } | null } | null
}

interface EditCredentialDialogProps {
  entry: EditableCredentialEntry | null
  onClose: () => void
  onUpdated: () => void
}

type FormState = {
  title: string
  username: string
  secret: string
  url: string
  notes: string
}

function formFromEntry(entry: EditableCredentialEntry | null): FormState {
  return {
    title: entry?.title ?? '',
    username: entry?.username ?? '',
    secret: '',
    url: entry?.url ?? '',
    notes: entry?.notes ?? '',
  }
}

/**
 * A diferencia de POST /entries (que acepta host/IP sin esquema y lo
 * normaliza en el servidor), PATCH /entries/[id] valida `url` con
 * z.string().url() estricto — así que lo normalizamos aquí antes de enviar
 * para que "192.168.1.1" o "panel.ejemplo.com" no exploten como URL inválida.
 */
function normalizeUrlForSubmit(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function linkedLabel(entry: EditableCredentialEntry): string | null {
  if (entry.equipment) {
    const parts = [entry.equipment.brand, entry.equipment.model?.model].filter(Boolean)
    return parts.length > 0 ? `${entry.equipment.code} · ${parts.join(' ')}` : entry.equipment.code
  }
  if (entry.license) return entry.license.name
  return null
}

/**
 * Editar credencial: dueño, gestor de jerarquía, o alguien a quien se le
 * compartió con permiso «Puede editar» (ver userCanEditEntry / share
 * capability EDIT — ShareCredentialDialog). El área/tipo/enlace a
 * equipo-licencia no se editan aquí (PATCH no acepta vaultId; cambiar el
 * enlace es un caso poco común y con reglas de alcance propias) — se
 * muestran como referencia.
 */
export function EditCredentialDialog({ entry, onClose, onUpdated }: EditCredentialDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [form, setForm] = useState<FormState>(() => formFromEntry(entry))

  useEffect(() => {
    setForm(formFromEntry(entry))
    setShowSecret(false)
  }, [entry])

  const handleSubmit = async () => {
    if (!entry) return
    if (!form.title.trim()) {
      toast({
        title: 'Título requerido',
        description: 'El título no puede quedar vacío',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/credentials/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          username: form.username.trim() || null,
          url: normalizeUrlForSubmit(form.url),
          notes: form.notes.trim() || null,
          ...(form.secret ? { secret: form.secret } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detailMsg =
          typeof data?.details?.fieldErrors === 'object'
            ? Object.values(data.details.fieldErrors as Record<string, string[]>)
                .flat()
                .filter(Boolean)[0]
            : undefined
        throw new Error(detailMsg || data.error || `No se pudo guardar (${res.status})`)
      }

      toast({
        title: 'Credencial actualizada',
        description: form.secret
          ? 'Se guardó la nueva contraseña. Queda auditado.'
          : 'Cambios guardados. Queda auditado.',
      })
      onUpdated()
      onClose()
    } catch (err: unknown) {
      toast({
        title: 'No se pudo guardar',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const linked = entry ? linkedLabel(entry) : null

  return (
    <Dialog open={!!entry} onOpenChange={open => !open && onClose()}>
      <DialogContent className='sm:max-w-lg max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Pencil className='h-4 w-4' />
            Editar credencial
          </DialogTitle>
          <DialogDescription>
            Cambia los datos y guarda. Deja la contraseña en blanco para mantener la actual — el
            cambio queda registrado en auditoría.
          </DialogDescription>
        </DialogHeader>

        {entry ? (
          <form
            className='space-y-4'
            onSubmit={e => {
              e.preventDefault()
              void handleSubmit()
            }}
            autoComplete='off'
          >
            <div className='grid gap-4 py-1'>
              <div className='rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5'>
                <p>
                  <span className='font-medium text-foreground'>Área:</span>{' '}
                  {entry.vault ? formatCredentialVaultLabel(entry.vault) : '—'}
                  {' · '}
                  <span className='font-medium text-foreground'>Tipo:</span>{' '}
                  {CREDENTIAL_ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                </p>
                {linked ? (
                  <p>
                    <span className='font-medium text-foreground'>Vinculada a:</span> {linked}
                  </p>
                ) : null}
                <p>Área, tipo y vínculo no se cambian desde aquí.</p>
              </div>

              <div className='space-y-1.5'>
                <Label>Título</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>

              <div className='space-y-1.5'>
                <Label>Usuario</Label>
                <Input
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder='Opcional'
                  autoComplete='off'
                />
              </div>

              <div className='space-y-1.5'>
                <Label>Contraseña / secreto</Label>
                <div className='flex gap-2'>
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    value={form.secret}
                    onChange={e => setForm(p => ({ ...p, secret: e.target.value }))}
                    autoComplete='new-password'
                    className='font-mono'
                    placeholder='Deja en blanco para mantener la actual'
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
                  <GeneratePasswordButton
                    onGenerate={secret => {
                      setForm(p => ({ ...p, secret }))
                      setShowSecret(true)
                    }}
                  />
                </div>
              </div>

              <div className='space-y-1.5'>
                <Label>URL de acceso</Label>
                <Input
                  value={form.url}
                  onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  placeholder='https://panel… o 192.168.1.1'
                />
              </div>

              <div className='space-y-1.5'>
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  placeholder='Contexto interno (quién la usa, puerto, etc.)'
                />
              </div>
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={onClose}>
                Cancelar
              </Button>
              <Button type='submit' disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
                    Guardando…
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

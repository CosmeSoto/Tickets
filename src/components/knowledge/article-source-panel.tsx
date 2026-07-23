'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, Paperclip, Star, Lock, ExternalLink, Eye, Download } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FilePreviewModal, type PreviewFile } from '@/components/ui/file-preview-modal'
import type { ArticleSourceContext } from '@/hooks/use-knowledge'

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
  ON_HOLD: 'En espera',
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

function fileEmoji(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  if (mime.startsWith('text/')) return '📃'
  return '📎'
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface ArticleSourcePanelProps {
  sourceContext: ArticleSourceContext
  /** Mostrar calificación y comentarios (staff). Por defecto según sourceContext.rating */
  showStaffDetails?: boolean
}

export function ArticleSourcePanel({ sourceContext, showStaffDetails }: ArticleSourcePanelProps) {
  const staff =
    showStaffDetails ?? (sourceContext.rating !== null || sourceContext.internalComments.length > 0)

  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null)

  const openPreview = (file: ArticleSourceContext['attachments'][number]) => {
    const base = file.url.split('?')[0]
    setPreviewFile({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      url: `${base}?preview=true`,
      downloadUrl: base,
    })
  }

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='text-base flex items-center gap-2'>
            <BookOpen className='h-4 w-4' />
            Origen del ticket
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4 text-sm'>
          <div>
            <p className='font-medium line-clamp-2'>{sourceContext.title}</p>
            <div className='flex flex-wrap gap-1.5 mt-2'>
              <Badge variant='outline' className='text-xs'>
                {STATUS_LABELS[sourceContext.status] ?? sourceContext.status}
              </Badge>
              <Badge variant='secondary' className='text-xs'>
                {PRIORITY_LABELS[sourceContext.priority] ?? sourceContext.priority}
              </Badge>
              {sourceContext.categoryName && (
                <Badge variant='outline' className='text-xs'>
                  {sourceContext.categoryName}
                </Badge>
              )}
            </div>
          </div>

          {sourceContext.canOpenTicket && sourceContext.ticketHref && (
            <Button variant='outline' size='sm' className='w-full justify-start' asChild>
              <Link href={sourceContext.ticketHref}>
                <ExternalLink className='h-3.5 w-3.5 mr-2' />
                Ver ticket completo
              </Link>
            </Button>
          )}

          <Separator />

          <div>
            <p className='text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2'>
              <Paperclip className='h-3.5 w-3.5' />
              Archivos ({sourceContext.attachments.length})
            </p>
            {sourceContext.attachments.length === 0 ? (
              <p className='text-xs text-muted-foreground'>Sin archivos adjuntos</p>
            ) : (
              <ul className='space-y-2'>
                {sourceContext.attachments.map(file => (
                  <li
                    key={file.id}
                    className='flex items-center gap-2 px-2.5 py-2 rounded-lg border bg-card text-sm'
                  >
                    <span className='text-base shrink-0'>{fileEmoji(file.mimeType)}</span>
                    <span className='flex-1 truncate font-medium min-w-0 text-xs'>
                      {file.originalName}
                    </span>
                    <span className='text-muted-foreground text-[10px] shrink-0'>
                      {fmtSize(file.size)}
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 w-6 p-0 shrink-0'
                            onClick={() => openPreview(file)}
                          >
                            <Eye className='h-3 w-3' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Vista previa</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={file.url.split('?')[0]}
                            download={file.originalName}
                            className='inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted shrink-0'
                          >
                            <Download className='h-3 w-3' />
                          </a>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Descargar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {staff && sourceContext.rating && (
            <>
              <Separator />
              <div>
                <p className='text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2'>
                  <Star className='h-3.5 w-3.5' />
                  Calificación del cliente
                </p>
                <p className='text-lg font-semibold'>
                  {sourceContext.rating.rating}
                  <span className='text-sm font-normal text-muted-foreground'>/5</span>
                </p>
                <div className='grid grid-cols-2 gap-1 mt-2 text-xs text-muted-foreground'>
                  <span>Respuesta: {sourceContext.rating.responseTime}/5</span>
                  <span>Técnica: {sourceContext.rating.technicalSkill}/5</span>
                  <span>Comunicación: {sourceContext.rating.communication}/5</span>
                  <span>Resolución: {sourceContext.rating.problemResolution}/5</span>
                </div>
                {sourceContext.rating.feedback && (
                  <p className='text-xs mt-2 italic text-muted-foreground border-l-2 pl-2'>
                    {sourceContext.rating.feedback}
                  </p>
                )}
              </div>
            </>
          )}

          {staff && sourceContext.internalComments.length > 0 && (
            <>
              <Separator />
              <div>
                <p className='text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2'>
                  <Lock className='h-3.5 w-3.5' />
                  Notas internas del equipo ({sourceContext.internalComments.length})
                </p>
                <p className='text-[10px] text-muted-foreground mb-2'>
                  Solo visibles para el equipo con acceso al ticket. No se muestran al cliente.
                </p>
                <ul className='space-y-2 max-h-48 overflow-y-auto'>
                  {sourceContext.internalComments.map(c => (
                    <li
                      key={c.id}
                      className='text-xs border border-amber-200/60 dark:border-amber-500/30 rounded-md p-2 bg-amber-50/50 dark:bg-amber-500/10'
                    >
                      <p className='font-medium'>
                        {c.authorName}{' '}
                        <span className='text-muted-foreground font-normal'>({c.authorRole})</span>
                      </p>
                      <p className='mt-1 whitespace-pre-wrap line-clamp-4'>{c.content}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
    </>
  )
}

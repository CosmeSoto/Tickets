import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'

/**
 * POST /api/tickets/[id]/attachments
 * Sube uno o varios archivos adjuntos a un ticket.
 *
 * Acepta:
 *   - Un solo campo "file" (compatibilidad con código existente)
 *   - Múltiples campos "files[]" para carga masiva
 *
 * Responde:
 *   - Archivo único: el objeto attachment
 *   - Múltiples: { results: [...], succeeded: N, failed: N }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const formData = await request.formData()

    // Detectar si es carga masiva (campo "files[]") o individual (campo "file")
    const multipleFiles = formData.getAll('files[]') as File[]
    const singleFile = formData.get('file') as File | null

    if (multipleFiles.length > 0) {
      // ── Carga masiva ──────────────────────────────────────────────────────
      const results = await FileService.uploadMultiple(
        multipleFiles,
        ticketId,
        session.user.id
      )

      const succeeded = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length

      return NextResponse.json(
        { results, succeeded, failed },
        { status: failed === results.length ? 400 : 201 }
      )
    }

    if (singleFile) {
      // ── Archivo individual ────────────────────────────────────────────────
      const attachment = await FileService.uploadFile({
        file: singleFile,
        ticketId,
        uploadedBy: session.user.id,
      })
      return NextResponse.json(attachment, { status: 201 })
    }

    return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 })
  } catch (error) {
    console.error('[attachments] Error al subir archivo:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: error instanceof Error && error.message.includes('límite') ? 422 : 500 }
    )
  }
}

/**
 * GET /api/tickets/[id]/attachments
 * Lista todos los archivos adjuntos de un ticket.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const attachments = await FileService.getFilesByTicket(ticketId)
    return NextResponse.json(attachments)
  } catch (error) {
    console.error('[attachments] Error al obtener archivos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

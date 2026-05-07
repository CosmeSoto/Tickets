import { z } from 'zod'
import { AssetRequestStatus, AssetType } from '@prisma/client'

/**
 * Esquemas de validación para el módulo de Solicitud de Activos
 */

// ── Creación de solicitud ─────────────────────────────────────────────────────

export const createAssetRequestSchema = z.object({
  assetType: z.nativeEnum(AssetType, {
    errorMap: () => ({ message: 'Tipo de activo inválido' }),
  }),
  description: z.string().min(10, {
    message: 'La descripción debe tener al menos 10 caracteres',
  }),
  familyId: z.string().uuid({
    message: 'ID de familia inválido',
  }),
  justification: z.string().min(10, {
    message: 'La justificación debe tener al menos 10 caracteres',
  }),
  assetId: z
    .string()
    .uuid({
      message: 'ID de activo inválido',
    })
    .optional(),
  quantity: z
    .number()
    .int()
    .min(1, {
      message: 'La cantidad debe ser al menos 1',
    })
    .default(1)
    .optional(),
  neededBy: z
    .string()
    .datetime({
      message: 'Fecha inválida, debe ser formato ISO 8601',
    })
    .optional(),
})

// ── Cambio de estado ──────────────────────────────────────────────────────────

export const updateStatusSchema = z.object({
  status: z.nativeEnum(AssetRequestStatus, {
    errorMap: () => ({ message: 'Estado inválido' }),
  }),
  comment: z.string().optional(),
})

// ── Agregar comentario ────────────────────────────────────────────────────────

export const addCommentSchema = z.object({
  comment: z
    .string()
    .min(1, { message: 'El comentario no puede estar vacío' })
    .max(2000, { message: 'El comentario no puede exceder 2000 caracteres' }),
})

// ── Configuración por familia ─────────────────────────────────────────────────

export const updateFamilyConfigSchema = z.object({
  assetRequestsEnabled: z.boolean({
    required_error: 'El campo assetRequestsEnabled es requerido',
    invalid_type_error: 'El campo assetRequestsEnabled debe ser un booleano',
  }),
})

// ── Función de validación de comentario del revisor ───────────────────────────

/**
 * Valida que el comentario del revisor (Super Admin) tenga al menos 10 caracteres.
 * Requerido al aprobar o rechazar una solicitud.
 */
export function validateReviewerComment(comment: string): boolean {
  return comment.length >= 10
}

// ── Tipos inferidos ───────────────────────────────────────────────────────────

export type CreateAssetRequestInput = z.infer<typeof createAssetRequestSchema>
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>
export type AddCommentInput = z.infer<typeof addCommentSchema>
export type UpdateFamilyConfigInput = z.infer<typeof updateFamilyConfigSchema>

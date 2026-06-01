/**
 * NewsAttachmentsUploader — re-export de FileDropZone para noticias.
 * Mantiene compatibilidad con el código existente en admin/news/page.tsx.
 */
export { FileDropZone as NewsAttachmentsUploader } from '@/components/common/file-drop-zone'
export type { PendingFile, UploadedAttachment } from '@/components/common/file-drop-zone'

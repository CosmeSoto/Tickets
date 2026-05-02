/**
 * BackupCloudService — Sube backups a Google Drive o OneDrive
 * usando las credenciales OAuth ya configuradas en el sistema.
 *
 * Flujo de autenticación:
 *  - Google Drive: OAuth2 con Client Credentials (service account flow via refresh token)
 *  - OneDrive: Microsoft Graph API con Client Credentials flow
 *
 * Los tokens se obtienen server-side usando las credenciales almacenadas
 * en oauth_configs — el admin no necesita autenticarse manualmente.
 */

import { readFile, stat } from 'fs/promises'
import { basename } from 'path'
import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export type CloudProvider = 'google-drive' | 'onedrive'

export interface CloudUploadResult {
  provider: CloudProvider
  fileId: string
  fileName: string
  webViewLink?: string
  size: number
  uploadedAt: Date
}

// ── Nombre de la carpeta en el Drive ─────────────────────────────────────────
const DRIVE_FOLDER_NAME = 'Sistema-Tickets-Backups'

export class BackupCloudService {
  /**
   * Sube un archivo de backup al proveedor configurado.
   * Detecta automáticamente qué proveedor está habilitado.
   */
  static async uploadBackup(
    backupId: string,
    filepath: string,
    provider: CloudProvider
  ): Promise<CloudUploadResult> {
    if (provider === 'google-drive') {
      return this.uploadToGoogleDrive(backupId, filepath)
    } else if (provider === 'onedrive') {
      return this.uploadToOneDrive(backupId, filepath)
    }
    throw new Error(`Proveedor no soportado: ${provider}`)
  }

  /**
   * Devuelve qué proveedores cloud están disponibles (OAuth configurado y habilitado).
   */
  static async getAvailableProviders(): Promise<{
    googleDrive: boolean
    oneDrive: boolean
  }> {
    const [google, microsoft] = await Promise.all([
      getOAuthCredentials('google'),
      getOAuthCredentials('azure-ad'),
    ])
    return {
      googleDrive: !!google,
      oneDrive: !!microsoft,
    }
  }

  // ── Google Drive ────────────────────────────────────────────────────────────

  private static async uploadToGoogleDrive(
    backupId: string,
    filepath: string
  ): Promise<CloudUploadResult> {
    const creds = await getOAuthCredentials('google')
    if (!creds) {
      throw new Error(
        'Google OAuth no está configurado o habilitado. ' +
          'Ve a Configuración → OAuth para activarlo.'
      )
    }

    // Obtener access token usando Client Credentials con refresh token almacenado
    const accessToken = await this.getGoogleAccessToken(creds.clientId, creds.clientSecret)

    // Obtener o crear la carpeta de backups en Drive
    const folderId = await this.getOrCreateGoogleDriveFolder(accessToken)

    // Leer el archivo
    const fileBuffer = await readFile(filepath)
    const fileName = basename(filepath)
    const fileStat = await stat(filepath)

    // Determinar MIME type
    const mimeType = filepath.endsWith('.json')
      ? 'application/json'
      : filepath.endsWith('.gz')
        ? 'application/gzip'
        : filepath.endsWith('.enc')
          ? 'application/octet-stream'
          : 'application/sql'

    // Upload multipart a Google Drive API v3
    const metadata = JSON.stringify({
      name: fileName,
      parents: [folderId],
      description: `Backup automático del sistema de tickets. ID: ${backupId}`,
    })

    const boundary = '-------314159265358979323846'
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
          'Content-Length': body.length.toString(),
        },
        body,
      }
    )

    if (!uploadRes.ok) {
      const err = await uploadRes.text()
      throw new Error(`Error subiendo a Google Drive: ${uploadRes.status} — ${err}`)
    }

    const uploaded = await uploadRes.json()

    console.log(`[CLOUD] Backup subido a Google Drive: ${uploaded.name} (${uploaded.id})`)

    return {
      provider: 'google-drive',
      fileId: uploaded.id,
      fileName: uploaded.name,
      webViewLink: uploaded.webViewLink,
      size: fileStat.size,
      uploadedAt: new Date(),
    }
  }

  private static async getGoogleAccessToken(
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    // Buscar refresh token almacenado en system_settings
    const tokenSetting = await prisma.system_settings.findUnique({
      where: { key: 'backupGoogleRefreshToken' },
    })

    if (!tokenSetting?.value) {
      throw new Error(
        'No hay un token de autorización de Google Drive. ' +
          'El administrador debe autorizar el acceso desde la configuración de backups.'
      )
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenSetting.value,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(
        `Error obteniendo token de Google: ${err.error_description ?? err.error}. ` +
          'Es posible que el token haya expirado. Vuelve a autorizar desde la configuración.'
      )
    }

    const data = await res.json()
    return data.access_token
  }

  private static async getOrCreateGoogleDriveFolder(accessToken: string): Promise<string> {
    // Buscar carpeta existente
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      if (data.files?.length > 0) {
        return data.files[0].id
      }
    }

    // Crear carpeta si no existe
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })

    if (!createRes.ok) {
      throw new Error('No se pudo crear la carpeta en Google Drive')
    }

    const folder = await createRes.json()
    console.log(`[CLOUD] Carpeta creada en Google Drive: ${DRIVE_FOLDER_NAME} (${folder.id})`)
    return folder.id
  }

  // ── OneDrive (Microsoft Graph) ──────────────────────────────────────────────

  private static async uploadToOneDrive(
    backupId: string,
    filepath: string
  ): Promise<CloudUploadResult> {
    const creds = await getOAuthCredentials('azure-ad')
    if (!creds) {
      throw new Error(
        'Microsoft OAuth no está configurado o habilitado. ' +
          'Ve a Configuración → OAuth para activarlo.'
      )
    }

    const accessToken = await this.getMicrosoftAccessToken(
      creds.clientId,
      creds.clientSecret,
      creds.tenantId
    )

    const fileBuffer = await readFile(filepath)
    const fileName = basename(filepath)
    const fileStat = await stat(filepath)

    // Crear carpeta si no existe (usando Graph API)
    await this.getOrCreateOneDriveFolder(accessToken)

    // Para archivos > 4MB usar upload session; para menores, PUT directo
    const MAX_SIMPLE_UPLOAD = 4 * 1024 * 1024

    let fileId: string
    let webViewLink: string | undefined

    if (fileStat.size <= MAX_SIMPLE_UPLOAD) {
      // Upload simple
      const uploadRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${DRIVE_FOLDER_NAME}/${fileName}:/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: fileBuffer,
        }
      )

      if (!uploadRes.ok) {
        const err = await uploadRes.text()
        throw new Error(`Error subiendo a OneDrive: ${uploadRes.status} — ${err}`)
      }

      const uploaded = await uploadRes.json()
      fileId = uploaded.id
      webViewLink = uploaded.webUrl
    } else {
      // Upload session para archivos grandes
      const sessionRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${DRIVE_FOLDER_NAME}/${fileName}:/createUploadSession`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            item: {
              '@microsoft.graph.conflictBehavior': 'replace',
              description: `Backup del sistema de tickets. ID: ${backupId}`,
            },
          }),
        }
      )

      if (!sessionRes.ok) {
        throw new Error('No se pudo crear sesión de upload en OneDrive')
      }

      const session = await sessionRes.json()
      const uploadUrl = session.uploadUrl

      // Subir en chunks de 4MB
      const chunkSize = 4 * 1024 * 1024
      let offset = 0
      let lastResponse: any = null

      while (offset < fileBuffer.length) {
        const chunk = fileBuffer.subarray(offset, offset + chunkSize)
        const end = Math.min(offset + chunkSize - 1, fileBuffer.length - 1)

        const chunkRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': chunk.length.toString(),
            'Content-Range': `bytes ${offset}-${end}/${fileBuffer.length}`,
          },
          body: chunk,
        })

        if (!chunkRes.ok && chunkRes.status !== 202) {
          throw new Error(`Error en chunk upload OneDrive: ${chunkRes.status}`)
        }

        if (chunkRes.status === 201 || chunkRes.status === 200) {
          lastResponse = await chunkRes.json()
        }

        offset += chunkSize
      }

      fileId = lastResponse?.id ?? 'unknown'
      webViewLink = lastResponse?.webUrl
    }

    console.log(`[CLOUD] Backup subido a OneDrive: ${fileName} (${fileId})`)

    return {
      provider: 'onedrive',
      fileId,
      fileName,
      webViewLink,
      size: fileStat.size,
      uploadedAt: new Date(),
    }
  }

  private static async getMicrosoftAccessToken(
    clientId: string,
    clientSecret: string,
    tenantId?: string
  ): Promise<string> {
    // Buscar refresh token almacenado
    const tokenSetting = await prisma.system_settings.findUnique({
      where: { key: 'backupMicrosoftRefreshToken' },
    })

    if (!tokenSetting?.value) {
      throw new Error(
        'No hay un token de autorización de OneDrive. ' +
          'El administrador debe autorizar el acceso desde la configuración de backups.'
      )
    }

    const tenant = tenantId ?? 'common'
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenSetting.value,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Files.ReadWrite offline_access',
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(
        `Error obteniendo token de Microsoft: ${err.error_description ?? err.error}. ` +
          'Es posible que el token haya expirado. Vuelve a autorizar desde la configuración.'
      )
    }

    const data = await res.json()

    // Actualizar el refresh token si Microsoft devuelve uno nuevo
    if (data.refresh_token && data.refresh_token !== tokenSetting.value) {
      await prisma.system_settings.update({
        where: { key: 'backupMicrosoftRefreshToken' },
        data: { value: data.refresh_token, updatedAt: new Date() },
      })
    }

    return data.access_token
  }

  private static async getOrCreateOneDriveFolder(accessToken: string): Promise<void> {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${DRIVE_FOLDER_NAME}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (res.status === 404) {
      // Crear carpeta
      await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: DRIVE_FOLDER_NAME,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        }),
      })
      console.log(`[CLOUD] Carpeta creada en OneDrive: ${DRIVE_FOLDER_NAME}`)
    }
  }
}

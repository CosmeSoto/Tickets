/**
 * CloudStorageService — sube/descarga/borra adjuntos en Google Drive u OneDrive
 * usando las credenciales OAuth ya configuradas en el sistema (`oauth_configs`).
 *
 * Generaliza el patrón ya probado en `BackupCloudService` (mismo flujo
 * delegado de refresh token, mismo Graph API / Drive API) pero:
 *  - trabaja sobre un Buffer en memoria, no un archivo en disco (el adjunto
 *    nunca toca el disco local cuando el destino es la nube);
 *  - organiza carpetas por módulo/entidad (`Sistema-Tickets-Adjuntos/<módulo>/<id>/`)
 *    en vez de una sola carpeta fija;
 *  - usa sus propias claves de refresh token en `system_settings`
 *    (`attachmentsGoogleRefreshToken` / `attachmentsMicrosoftRefreshToken`),
 *    independientes de las de backups — revocar el acceso de adjuntos no
 *    debe cortar los backups en la nube ni viceversa.
 *
 * SharePoint (sitios de Microsoft 365) usa credenciales de APLICACIÓN
 * (client_credentials + permiso Sites.Selected) en vez del flujo delegado
 * de Google/OneDrive — no hay usuario que autorice vía popup ni refresh
 * token que guardar, pero sí requiere un paso aparte hecho por un admin de
 * Microsoft 365 (otorgarle el permiso a esta app sobre un sitio
 * específico, fuera de esta app). Ver `getSharePointAccessToken` y
 * `resolveSharePointSite`.
 */

import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'

export type AttachmentCloudProvider = 'google-drive' | 'onedrive' | 'sharepoint'
export type AttachmentStorageProvider = AttachmentCloudProvider | 'local'

export interface CloudAttachmentUploadResult {
  externalId: string
  externalUrl?: string
}

export interface CloudAttachmentDownload {
  buffer: Buffer
  mimeType?: string
}

const ROOT_FOLDER_NAME = 'Sistema-Tickets-Adjuntos'

export class CloudStorageService {
  /**
   * Determina dónde deben guardarse los archivos NUEVOS ahora mismo.
   * Nunca cae a 'local' en silencio si el admin configuró un proveedor de
   * nube que quedó inválido (desactivado o sin token) — lanza un error claro
   * para que la subida falle visiblemente en vez de perder el destino
   * esperado sin avisar.
   */
  static async getActiveProvider(): Promise<AttachmentStorageProvider> {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'attachmentsStorageProvider' },
    })
    const provider = (setting?.value as AttachmentStorageProvider | undefined) || 'local'

    if (provider === 'local') return 'local'

    if (provider === 'sharepoint') {
      const [enabledSetting, driveIdSetting] = await Promise.all([
        prisma.system_settings.findUnique({ where: { key: 'attachmentsSharePointEnabled' } }),
        prisma.system_settings.findUnique({ where: { key: 'attachmentsSharePointDriveId' } }),
      ])
      if (enabledSetting?.value !== 'true' || !driveIdSetting?.value) {
        throw new Error(
          'El almacenamiento en SharePoint configurado no está disponible (desactivado o sin sitio configurado). ' +
            'Contacta al administrador para revisarlo en Ajustes → Almacenamiento de adjuntos.'
        )
      }
      return 'sharepoint'
    }

    const enabledKey =
      provider === 'google-drive' ? 'attachmentsGoogleDriveEnabled' : 'attachmentsOneDriveEnabled'
    const tokenKey =
      provider === 'google-drive'
        ? 'attachmentsGoogleRefreshToken'
        : 'attachmentsMicrosoftRefreshToken'

    const [enabledSetting, tokenSetting] = await Promise.all([
      prisma.system_settings.findUnique({ where: { key: enabledKey } }),
      prisma.system_settings.findUnique({ where: { key: tokenKey } }),
    ])

    if (enabledSetting?.value !== 'true' || !tokenSetting?.value) {
      throw new Error(
        'El almacenamiento en la nube configurado no está disponible (desactivado o sin autorizar). ' +
          'Contacta al administrador para revisarlo en Ajustes → Almacenamiento de adjuntos.'
      )
    }

    return provider
  }

  static async uploadAttachment(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    module: string,
    entityId: string,
    provider: AttachmentCloudProvider
  ): Promise<CloudAttachmentUploadResult> {
    if (provider === 'google-drive') {
      return this.uploadToGoogleDrive(buffer, fileName, mimeType, module, entityId)
    }
    if (provider === 'sharepoint') {
      return this.uploadToSharePoint(buffer, fileName, mimeType, module, entityId)
    }
    return this.uploadToOneDrive(buffer, fileName, mimeType, module, entityId)
  }

  /** Best-effort: si el archivo ya no existe en la nube (borrado a mano), no lanza. */
  static async downloadAttachment(
    provider: AttachmentCloudProvider,
    externalId: string
  ): Promise<CloudAttachmentDownload | null> {
    if (provider === 'google-drive') return this.downloadFromGoogleDrive(externalId)
    if (provider === 'sharepoint') return this.downloadFromSharePoint(externalId)
    return this.downloadFromOneDrive(externalId)
  }

  /** Best-effort: no bloquea el borrado del registro en BD si la nube ya no lo tiene. */
  static async deleteAttachment(
    provider: AttachmentCloudProvider,
    externalId: string
  ): Promise<void> {
    try {
      if (provider === 'google-drive') {
        await this.deleteFromGoogleDrive(externalId)
      } else if (provider === 'sharepoint') {
        await this.deleteFromSharePoint(externalId)
      } else {
        await this.deleteFromOneDrive(externalId)
      }
    } catch (error) {
      console.error(`[CLOUD STORAGE] Error borrando adjunto en ${provider} (${externalId}):`, error)
    }
  }

  // ── Google Drive ────────────────────────────────────────────────────────────

  private static async uploadToGoogleDrive(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    module: string,
    entityId: string
  ): Promise<CloudAttachmentUploadResult> {
    const creds = await getOAuthCredentials('google')
    if (!creds) {
      throw new Error('Google OAuth no está configurado o habilitado.')
    }

    const accessToken = await this.getGoogleAccessToken(creds.clientId, creds.clientSecret)
    const folderId = await this.getOrCreateGoogleDriveFolderPath(accessToken, [
      ROOT_FOLDER_NAME,
      module,
      entityId,
    ])

    const metadata = JSON.stringify({ name: fileName, parents: [folderId] })
    const boundary = '-------314159265358979323846'
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ])

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
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
    return { externalId: uploaded.id, externalUrl: uploaded.webViewLink }
  }

  private static async downloadFromGoogleDrive(
    fileId: string
  ): Promise<CloudAttachmentDownload | null> {
    const creds = await getOAuthCredentials('google')
    if (!creds) throw new Error('Google OAuth no está configurado o habilitado.')
    const accessToken = await this.getGoogleAccessToken(creds.clientId, creds.clientSecret)

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Error descargando de Google Drive: ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer }
  }

  private static async deleteFromGoogleDrive(fileId: string): Promise<void> {
    const creds = await getOAuthCredentials('google')
    if (!creds) return
    const accessToken = await this.getGoogleAccessToken(creds.clientId, creds.clientSecret)
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`Error borrando de Google Drive: ${res.status}`)
    }
  }

  private static async getGoogleAccessToken(
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    const tokenSetting = await prisma.system_settings.findUnique({
      where: { key: 'attachmentsGoogleRefreshToken' },
    })
    if (!tokenSetting?.value) {
      throw new Error(
        'No hay un token de autorización de Google Drive para adjuntos. ' +
          'Autorízalo desde Ajustes → Almacenamiento de adjuntos.'
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
          'El token pudo haber expirado — vuelve a autorizar desde Ajustes.'
      )
    }

    const data = await res.json()
    return data.access_token
  }

  /** Crea (o reusa) la cadena de carpetas `segments` una dentro de otra y devuelve el id de la última. */
  private static async getOrCreateGoogleDriveFolderPath(
    accessToken: string,
    segments: string[]
  ): Promise<string> {
    let parentId: string | null = null
    for (const name of segments) {
      parentId = await this.getOrCreateGoogleDriveFolder(accessToken, name, parentId)
    }
    return parentId as string
  }

  private static async getOrCreateGoogleDriveFolder(
    accessToken: string,
    name: string,
    parentId: string | null
  ): Promise<string> {
    const parentClause = parentId ? ` and '${parentId}' in parents` : " and 'root' in parents"
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (searchRes.ok) {
      const data = await searchRes.json()
      if (data.files?.length > 0) return data.files[0].id
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      }),
    })

    if (!createRes.ok) {
      throw new Error(`No se pudo crear la carpeta "${name}" en Google Drive`)
    }

    const folder = await createRes.json()
    return folder.id
  }

  // ── Graph "drive" genérico (OneDrive personal y SharePoint comparten esta
  // forma de API — un sitio de SharePoint es, para Graph, otro "drive" más;
  // solo cambia la base de la ruta: `/me/drive` vs `/drives/{id}`) ──────────

  private static async uploadToDriveLike(
    accessToken: string,
    driveBase: string,
    buffer: Buffer,
    fileName: string,
    module: string,
    entityId: string
  ): Promise<CloudAttachmentUploadResult> {
    const folderPath = `${ROOT_FOLDER_NAME}/${module}/${entityId}`
    const encodedPath = folderPath
      .split('/')
      .map(segment => encodeURIComponent(segment))
      .join('/')
    const encodedName = encodeURIComponent(fileName)

    const MAX_SIMPLE_UPLOAD = 4 * 1024 * 1024

    if (buffer.length <= MAX_SIMPLE_UPLOAD) {
      const uploadRes = await fetch(
        `https://graph.microsoft.com/v1.0${driveBase}/root:/${encodedPath}/${encodedName}:/content`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/octet-stream',
          },
          body: buffer as BodyInit,
        }
      )
      if (!uploadRes.ok) {
        const err = await uploadRes.text()
        throw new Error(`Error subiendo el archivo: ${uploadRes.status} — ${err}`)
      }
      const uploaded = await uploadRes.json()
      return { externalId: uploaded.id, externalUrl: uploaded.webUrl }
    }

    const sessionRes = await fetch(
      `https://graph.microsoft.com/v1.0${driveBase}/root:/${encodedPath}/${encodedName}:/createUploadSession`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
      }
    )
    if (!sessionRes.ok) throw new Error('No se pudo crear sesión de upload')

    const session = await sessionRes.json()
    const uploadUrl = session.uploadUrl
    const chunkSize = 4 * 1024 * 1024
    let offset = 0
    let lastResponse: any = null

    while (offset < buffer.length) {
      const chunk = buffer.subarray(offset, offset + chunkSize)
      const end = Math.min(offset + chunkSize - 1, buffer.length - 1)
      const chunkRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Length': chunk.length.toString(),
          'Content-Range': `bytes ${offset}-${end}/${buffer.length}`,
        },
        body: chunk as BodyInit,
      })
      if (!chunkRes.ok && chunkRes.status !== 202) {
        throw new Error(`Error en chunk upload: ${chunkRes.status}`)
      }
      if (chunkRes.status === 201 || chunkRes.status === 200) {
        lastResponse = await chunkRes.json()
      }
      offset += chunkSize
    }

    return { externalId: lastResponse?.id ?? 'unknown', externalUrl: lastResponse?.webUrl }
  }

  private static async downloadFromDriveLike(
    accessToken: string,
    driveBase: string,
    itemId: string
  ): Promise<CloudAttachmentDownload | null> {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0${driveBase}/items/${itemId}/content`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )

    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Error descargando el archivo: ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    return { buffer }
  }

  private static async deleteFromDriveLike(
    accessToken: string,
    driveBase: string,
    itemId: string
  ): Promise<void> {
    const res = await fetch(`https://graph.microsoft.com/v1.0${driveBase}/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok && res.status !== 404) {
      throw new Error(`Error borrando el archivo: ${res.status}`)
    }
  }

  // ── OneDrive personal (flujo delegado — el usuario autorizó una vez) ───────

  private static async uploadToOneDrive(
    buffer: Buffer,
    fileName: string,
    _mimeType: string,
    module: string,
    entityId: string
  ): Promise<CloudAttachmentUploadResult> {
    const creds = await getOAuthCredentials('azure-ad')
    if (!creds) {
      throw new Error('Microsoft OAuth no está configurado o habilitado.')
    }
    const accessToken = await this.getMicrosoftAccessToken(
      creds.clientId,
      creds.clientSecret,
      creds.tenantId
    )
    return this.uploadToDriveLike(accessToken, '/me/drive', buffer, fileName, module, entityId)
  }

  private static async downloadFromOneDrive(
    itemId: string
  ): Promise<CloudAttachmentDownload | null> {
    const creds = await getOAuthCredentials('azure-ad')
    if (!creds) throw new Error('Microsoft OAuth no está configurado o habilitado.')
    const accessToken = await this.getMicrosoftAccessToken(
      creds.clientId,
      creds.clientSecret,
      creds.tenantId
    )
    return this.downloadFromDriveLike(accessToken, '/me/drive', itemId)
  }

  private static async deleteFromOneDrive(itemId: string): Promise<void> {
    const creds = await getOAuthCredentials('azure-ad')
    if (!creds) return
    const accessToken = await this.getMicrosoftAccessToken(
      creds.clientId,
      creds.clientSecret,
      creds.tenantId
    )
    await this.deleteFromDriveLike(accessToken, '/me/drive', itemId)
  }

  private static async getMicrosoftAccessToken(
    clientId: string,
    clientSecret: string,
    tenantId?: string
  ): Promise<string> {
    const tokenSetting = await prisma.system_settings.findUnique({
      where: { key: 'attachmentsMicrosoftRefreshToken' },
    })
    if (!tokenSetting?.value) {
      throw new Error(
        'No hay un token de autorización de OneDrive para adjuntos. ' +
          'Autorízalo desde Ajustes → Almacenamiento de adjuntos.'
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
          'El token pudo haber expirado — vuelve a autorizar desde Ajustes.'
      )
    }

    const data = await res.json()

    if (data.refresh_token && data.refresh_token !== tokenSetting.value) {
      await prisma.system_settings.update({
        where: { key: 'attachmentsMicrosoftRefreshToken' },
        data: { value: data.refresh_token, updatedAt: new Date() },
      })
    }

    return data.access_token
  }

  // ── SharePoint (Microsoft Graph, credenciales de APLICACIÓN) ───────────────

  /**
   * Token de aplicación (client_credentials) — a diferencia de OneDrive
   * personal, aquí no hay usuario que delegue ni refresh token que guardar:
   * cada llamada pide un token nuevo con el permiso de aplicación
   * Sites.Selected ya otorgado sobre el sitio configurado (ese permiso se
   * otorga aparte, en Microsoft 365 — no hay popup de consentimiento que
   * mostrar desde esta app).
   */
  private static async getSharePointAccessToken(): Promise<string> {
    const creds = await getOAuthCredentials('azure-ad-sharepoint')
    if (!creds) {
      throw new Error(
        'Las credenciales de aplicación de SharePoint no están configuradas. Ve a Ajustes → Almacenamiento de adjuntos.'
      )
    }

    // A diferencia del flujo delegado (Google/OneDrive), client_credentials
    // no acepta el endpoint multi-tenant "common" — Microsoft exige el
    // Tenant ID real del directorio. Sin esto, el error de Microsoft más
    // abajo sería mucho más críptico que decirlo aquí directamente.
    if (!creds.tenantId) {
      throw new Error(
        'Falta el Tenant ID en las credenciales de aplicación de SharePoint (no se puede usar "common" para credenciales de aplicación). Configúralo en Ajustes → Almacenamiento de adjuntos.'
      )
    }

    const res = await fetch(
      `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          grant_type: 'client_credentials',
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        `Error obteniendo token de aplicación para SharePoint: ${err.error_description ?? err.error ?? res.status}`
      )
    }

    const data = await res.json()
    return data.access_token
  }

  private static async getSharePointDriveId(): Promise<string> {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'attachmentsSharePointDriveId' },
    })
    if (!setting?.value) {
      throw new Error(
        'No hay un sitio de SharePoint configurado. Configúralo desde Ajustes → Almacenamiento de adjuntos.'
      )
    }
    return setting.value
  }

  /**
   * Resuelve una URL de sitio de SharePoint (p. ej.
   * https://tuempresa.sharepoint.com/sites/Adjuntos) al id de sitio y al id
   * de su biblioteca de documentos por defecto — los dos datos que pide
   * Graph para poder subir/leer/borrar archivos. Se usa solo al configurar
   * el sitio desde Ajustes (no en cada subida): el resultado (driveId) se
   * guarda en `system_settings` y es lo único que necesitan las
   * operaciones de archivo de ahí en adelante.
   */
  static async resolveSharePointSite(
    siteUrl: string
  ): Promise<{ siteId: string; driveId: string }> {
    let hostname: string
    let sitePath: string
    try {
      const url = new URL(siteUrl.trim())
      hostname = url.hostname
      sitePath = url.pathname.replace(/\/+$/, '')
    } catch {
      throw new Error(
        'URL de sitio inválida. Debe ser algo como https://tuempresa.sharepoint.com/sites/Adjuntos'
      )
    }
    if (!hostname.toLowerCase().endsWith('.sharepoint.com')) {
      throw new Error('La URL debe ser de un sitio de SharePoint (dominio *.sharepoint.com).')
    }
    if (!sitePath) {
      throw new Error('La URL debe incluir la ruta del sitio, por ejemplo /sites/Adjuntos.')
    }

    const accessToken = await this.getSharePointAccessToken()

    const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!siteRes.ok) {
      if (siteRes.status === 403 || siteRes.status === 401) {
        throw new Error(
          'Microsoft rechazó el acceso a ese sitio (403/401). Falta otorgarle a esta app el permiso ' +
            'Sites.Selected sobre ese sitio específico — es un paso aparte en Microsoft 365, no se hace desde aquí.'
        )
      }
      if (siteRes.status === 404) {
        throw new Error('No se encontró ese sitio de SharePoint. Verifica la URL.')
      }
      throw new Error(`Error consultando el sitio de SharePoint: ${siteRes.status}`)
    }
    const site = await siteRes.json()
    const siteId = site.id as string

    const driveRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!driveRes.ok) {
      throw new Error(
        `No se pudo obtener la biblioteca de documentos del sitio: ${driveRes.status}`
      )
    }
    const drive = await driveRes.json()

    return { siteId, driveId: drive.id as string }
  }

  /**
   * El id de archivo que guarda `attachments.externalId` incluye el
   * driveId (`{driveId}:{itemId}`) — no solo el id del item. Así, si el
   * admin reconfigura el sitio activo más adelante, los adjuntos ya
   * subidos siguen resolviendo contra el drive en el que realmente viven,
   * en vez de contra el que quede configurado en ese momento.
   */
  private static splitSharePointExternalId(externalId: string): {
    driveId: string
    itemId: string
  } {
    const sep = externalId.indexOf(':')
    if (sep === -1) throw new Error('Identificador de archivo de SharePoint inválido.')
    return { driveId: externalId.slice(0, sep), itemId: externalId.slice(sep + 1) }
  }

  private static async uploadToSharePoint(
    buffer: Buffer,
    fileName: string,
    _mimeType: string,
    module: string,
    entityId: string
  ): Promise<CloudAttachmentUploadResult> {
    const driveId = await this.getSharePointDriveId()
    const accessToken = await this.getSharePointAccessToken()
    const result = await this.uploadToDriveLike(
      accessToken,
      `/drives/${driveId}`,
      buffer,
      fileName,
      module,
      entityId
    )
    return { externalId: `${driveId}:${result.externalId}`, externalUrl: result.externalUrl }
  }

  private static async downloadFromSharePoint(
    externalId: string
  ): Promise<CloudAttachmentDownload | null> {
    const { driveId, itemId } = this.splitSharePointExternalId(externalId)
    const accessToken = await this.getSharePointAccessToken()
    return this.downloadFromDriveLike(accessToken, `/drives/${driveId}`, itemId)
  }

  private static async deleteFromSharePoint(externalId: string): Promise<void> {
    const { driveId, itemId } = this.splitSharePointExternalId(externalId)
    const accessToken = await this.getSharePointAccessToken()
    await this.deleteFromDriveLike(accessToken, `/drives/${driveId}`, itemId)
  }
}

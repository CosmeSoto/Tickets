/**
 * MsTodoGraphService — llamadas crudas a Microsoft Graph para Microsoft To Do,
 * con la cuenta PERSONAL de cada usuario (no una cuenta de servicio
 * compartida, a diferencia de PlannerGraphService). Cada método recibe el
 * `userId` y resuelve el token de esa persona desde oauth_accounts
 * (provider 'microsoft-todo', ver /api/planner/ms-todo/**).
 *
 * A diferencia de Planner, la API de To Do no exige concurrencia optimista
 * (If-Match) para actualizar/borrar — el etag solo se guarda para detectar
 * cambios en el sondeo de vuelta (pullChangesForUser), igual de barato que
 * el criterio ya usado para Planner.
 */
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { refreshMicrosoftAccessToken } from '@/lib/oauth/microsoft-authorize'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
export const MS_TODO_SCOPE = 'https://graph.microsoft.com/Tasks.ReadWrite offline_access'
export const MS_TODO_PROVIDER = 'microsoft-todo'
export const MS_TODO_LIST_NAME = 'Tareas (Gestión Operaciones)'

export class MsTodoNotConnectedError extends Error {
  constructor() {
    super('Este usuario no tiene una cuenta de Microsoft To Do conectada.')
  }
}

export interface MsTodoTaskInput {
  title: string
  dueDateTime?: string | null
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked'
}

export interface MsTodoTaskResult {
  id: string
  etag: string
}

export interface MsTodoTaskSummary {
  id: string
  etag: string
  title: string
  status: string
  dueDateTime: string | null
}

export function toGraphStatus(status: string): string {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'in_progress':
      return 'inProgress'
    case 'blocked':
      return 'waitingOnOthers'
    default:
      return 'notStarted'
  }
}

export function fromGraphStatus(graphStatus: string): string {
  switch (graphStatus) {
    case 'completed':
      return 'completed'
    case 'inProgress':
      return 'in_progress'
    case 'waitingOnOthers':
      return 'blocked'
    default:
      return 'pending'
  }
}

export class MsTodoGraphService {
  /** Igual que PlannerGraphService.getAccessToken, pero por usuario — lee y
   *  rota el refresh token cifrado de oauth_accounts en vez de una sola fila
   *  global en system_settings. */
  static async getAccessToken(userId: string): Promise<string> {
    // providerId = el propio userId de la app (no el oid de Microsoft): así el
    // índice único [provider, providerId] ya garantiza como mucho una cuenta
    // de Microsoft To Do conectada por usuario, sin una llamada extra a /me.
    const account = await prisma.oauth_accounts.findUnique({
      where: { provider_providerId: { provider: MS_TODO_PROVIDER, providerId: userId } },
    })
    if (!account?.refreshToken) throw new MsTodoNotConnectedError()

    const creds = await getOAuthCredentials('azure-ad-todo')
    if (!creds) {
      throw new Error(
        'La integración con Microsoft To Do no está configurada por el administrador.'
      )
    }

    const data = await refreshMicrosoftAccessToken({
      credentials: creds,
      refreshToken: decrypt(account.refreshToken),
      scope: MS_TODO_SCOPE,
    })

    await prisma.oauth_accounts.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(data.access_token),
        refreshToken: data.refresh_token ? encrypt(data.refresh_token) : account.refreshToken,
        scope: data.scope ?? account.scope,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        updatedAt: new Date(),
      },
    })

    return data.access_token
  }

  private static async graphFetch(path: string, accessToken: string, init?: RequestInit) {
    return fetch(`${GRAPH_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  }

  static async getConnectedAccountEmail(accessToken: string): Promise<string | null> {
    const res = await this.graphFetch('/me?$select=mail,userPrincipalName', accessToken)
    if (!res.ok) return null
    const data = await res.json()
    return data.mail ?? data.userPrincipalName ?? null
  }

  static async listTaskLists(accessToken: string): Promise<{ id: string; displayName: string }[]> {
    const res = await this.graphFetch('/me/todo/lists', accessToken)
    if (!res.ok) throw new Error(`No se pudieron listar las listas de To Do: ${res.status}`)
    const data = await res.json()
    return (data.value ?? []).map((l: any) => ({ id: l.id, displayName: l.displayName }))
  }

  /** Reutiliza la lista "Tareas (Gestión Operaciones)" si ya existe, o la crea. */
  static async getOrCreateDefaultList(accessToken: string): Promise<string> {
    const existing = await this.listTaskLists(accessToken)
    const match = existing.find(l => l.displayName === MS_TODO_LIST_NAME)
    if (match) return match.id

    const res = await this.graphFetch('/me/todo/lists', accessToken, {
      method: 'POST',
      body: JSON.stringify({ displayName: MS_TODO_LIST_NAME }),
    })
    if (!res.ok) throw new Error(`No se pudo crear la lista de To Do: ${res.status}`)
    const data = await res.json()
    return data.id
  }

  static async createTask(
    accessToken: string,
    listId: string,
    input: MsTodoTaskInput
  ): Promise<MsTodoTaskResult> {
    const body: Record<string, unknown> = { title: input.title }
    if (input.status) body.status = toGraphStatus(input.status)
    if (input.dueDateTime) {
      body.dueDateTime = { dateTime: input.dueDateTime, timeZone: 'UTC' }
    }

    const res = await this.graphFetch(`/me/todo/lists/${listId}/tasks`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Error creando tarea en Microsoft To Do: ${res.status} — ${err}`)
    }
    const data = await res.json()
    return { id: data.id, etag: data['@odata.etag'] ?? '' }
  }

  static async updateTask(
    accessToken: string,
    listId: string,
    taskId: string,
    patch: { title?: string; dueDateTime?: string | null; status?: string }
  ): Promise<MsTodoTaskResult> {
    const body: Record<string, unknown> = {}
    if (patch.title !== undefined) body.title = patch.title
    if (patch.status !== undefined) body.status = toGraphStatus(patch.status)
    if (patch.dueDateTime !== undefined) {
      body.dueDateTime = patch.dueDateTime ? { dateTime: patch.dueDateTime, timeZone: 'UTC' } : null
    }

    const res = await this.graphFetch(`/me/todo/lists/${listId}/tasks/${taskId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Error actualizando tarea en Microsoft To Do: ${res.status} — ${err}`)
    }
    const data = await res.json()
    return { id: taskId, etag: data['@odata.etag'] ?? '' }
  }

  static async deleteTask(accessToken: string, listId: string, taskId: string): Promise<void> {
    const res = await this.graphFetch(`/me/todo/lists/${listId}/tasks/${taskId}`, accessToken, {
      method: 'DELETE',
    })
    // 404 = ya no existe del lado de Microsoft — no es un error a propagar.
    if (!res.ok && res.status !== 404) {
      const err = await res.text()
      throw new Error(`Error eliminando tarea en Microsoft To Do: ${res.status} — ${err}`)
    }
  }

  static async listTasks(accessToken: string, listId: string): Promise<MsTodoTaskSummary[]> {
    const res = await this.graphFetch(
      `/me/todo/lists/${listId}/tasks?$select=id,title,status,dueDateTime`,
      accessToken
    )
    if (!res.ok) throw new Error(`No se pudieron listar las tareas de To Do: ${res.status}`)
    const data = await res.json()
    return (data.value ?? []).map((t: any) => ({
      id: t.id,
      etag: t['@odata.etag'] ?? '',
      title: t.title,
      status: fromGraphStatus(t.status),
      dueDateTime: t.dueDateTime?.dateTime ? `${t.dueDateTime.dateTime}Z` : null,
    }))
  }

  /** Guarda por primera vez el token de una cuenta recién conectada. */
  static async saveNewAccount(params: {
    userId: string
    accessToken: string
    refreshToken: string
    scope?: string | null
    expiresIn: number
  }): Promise<void> {
    await prisma.oauth_accounts.upsert({
      where: {
        provider_providerId: { provider: MS_TODO_PROVIDER, providerId: params.userId },
      },
      update: {
        accessToken: encrypt(params.accessToken),
        refreshToken: encrypt(params.refreshToken),
        scope: params.scope ?? null,
        expiresAt: new Date(Date.now() + params.expiresIn * 1000),
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        provider: MS_TODO_PROVIDER,
        providerId: params.userId,
        userId: params.userId,
        accessToken: encrypt(params.accessToken),
        refreshToken: encrypt(params.refreshToken),
        scope: params.scope ?? null,
        expiresAt: new Date(Date.now() + params.expiresIn * 1000),
        updatedAt: new Date(),
      },
    })
  }
}

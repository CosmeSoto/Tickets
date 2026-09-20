/**
 * PlannerGraphService — Llamadas crudas a Microsoft Graph para Microsoft Planner.
 *
 * Mismo patrón que src/lib/services/backup-cloud-service.ts (OneDrive): la
 * cuenta dedicada de Microsoft 365 autoriza una vez (ver rutas
 * /api/admin/planner/cloud-auth/**), el refresh token queda en
 * system_settings ('plannerMicrosoftRefreshToken') y esta clase lo usa para
 * pedir un access token nuevo en cada llamada — sin SDK, fetch crudo contra
 * Graph v1.0, igual que ya se hace para OneDrive.
 *
 * Planner solo acepta permisos delegados (no hay modo "app-only" / cliente-
 * credenciales para /planner/*, a diferencia de casi toda otra API de
 * Graph) — por eso este flujo depende de una cuenta real que consintió una
 * vez, en vez de un service principal puro.
 */

import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'
const PLANNER_SCOPE =
  'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/Group.Read.All offline_access'
const REFRESH_TOKEN_KEY = 'plannerMicrosoftRefreshToken'

export interface PlannerGroup {
  id: string
  displayName: string
}

export interface PlannerPlan {
  id: string
  title: string
}

export interface PlannerBucket {
  id: string
  name: string
}

export interface PlannerTaskInput {
  planId: string
  bucketId?: string
  title: string
  dueDateTime?: string | null
  percentComplete?: number
  assigneeAadId?: string | null
}

export interface PlannerTaskResult {
  id: string
  etag: string
  planId: string
  bucketId: string | null
}

export interface PlannerTaskSummary {
  id: string
  etag: string
  title: string
  percentComplete: number
  dueDateTime: string | null
}

export class PlannerGraphService {
  /** Igual que BackupCloudService.getMicrosoftAccessToken, para el scope de Planner. */
  static async getAccessToken(): Promise<string> {
    const creds = await getOAuthCredentials('azure-ad-planner')
    if (!creds) {
      throw new Error(
        'La conexión con Microsoft Planner no está configurada. Ve a Configuración → Tareas/Planner para conectarla.'
      )
    }

    const tokenSetting = await prisma.system_settings.findUnique({
      where: { key: REFRESH_TOKEN_KEY },
    })
    if (!tokenSetting?.value) {
      throw new Error(
        'No hay una cuenta de Microsoft autorizada para Planner. Conéctala desde Configuración → Tareas/Planner.'
      )
    }

    const tenant = creds.tenantId ?? 'common'
    const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: tokenSetting.value,
        grant_type: 'refresh_token',
        scope: PLANNER_SCOPE,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(
        `Error obteniendo token de Microsoft Planner: ${err.error_description ?? err.error ?? res.status}. ` +
          'Es posible que el token haya expirado — vuelve a conectar la cuenta.'
      )
    }

    const data = await res.json()

    // Rotación de refresh token — igual que en backup-cloud-service.ts.
    if (data.refresh_token && data.refresh_token !== tokenSetting.value) {
      await prisma.system_settings.update({
        where: { key: REFRESH_TOKEN_KEY },
        data: { value: data.refresh_token, updatedAt: new Date() },
      })
    }

    return data.access_token
  }

  private static async graphFetch(path: string, accessToken: string, init?: RequestInit) {
    const res = await fetch(`${GRAPH_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
    return res
  }

  /** Grupos de Microsoft 365 (no de seguridad) de los que la cuenta conectada es miembro. */
  static async listGroups(accessToken: string): Promise<PlannerGroup[]> {
    const res = await this.graphFetch('/me/memberOf?$select=id,displayName,groupTypes', accessToken)
    if (!res.ok) throw new Error(`No se pudieron listar los grupos de Microsoft 365: ${res.status}`)
    const data = await res.json()
    return (data.value ?? [])
      .filter((g: any) => Array.isArray(g.groupTypes) && g.groupTypes.includes('Unified'))
      .map((g: any) => ({ id: g.id, displayName: g.displayName }))
  }

  static async listPlans(accessToken: string, groupId: string): Promise<PlannerPlan[]> {
    const res = await this.graphFetch(`/groups/${groupId}/planner/plans`, accessToken)
    if (!res.ok) throw new Error(`No se pudieron listar los planes del grupo: ${res.status}`)
    const data = await res.json()
    return (data.value ?? []).map((p: any) => ({ id: p.id, title: p.title }))
  }

  static async listBuckets(accessToken: string, planId: string): Promise<PlannerBucket[]> {
    const res = await this.graphFetch(`/planner/plans/${planId}/buckets`, accessToken)
    if (!res.ok) throw new Error(`No se pudieron listar los buckets del plan: ${res.status}`)
    const data = await res.json()
    return (data.value ?? []).map((b: any) => ({ id: b.id, name: b.name }))
  }

  /**
   * Todas las tareas del plan (v1.0, sin delta — la API de delta de Planner
   * solo existe en /beta, que Microsoft marca como no apto para producción).
   * El etag de cada tarea permite detectar cambios sin volver a escribir en
   * la base de datos las que siguen igual desde el último sondeo.
   */
  static async listTasks(accessToken: string, planId: string): Promise<PlannerTaskSummary[]> {
    const res = await this.graphFetch(`/planner/plans/${planId}/tasks`, accessToken)
    if (!res.ok) throw new Error(`No se pudieron listar las tareas del plan: ${res.status}`)
    const data = await res.json()
    return (data.value ?? []).map((t: any) => ({
      id: t.id,
      etag: t['@odata.etag'] ?? '',
      title: t.title,
      percentComplete: t.percentComplete ?? 0,
      dueDateTime: t.dueDateTime ?? null,
    }))
  }

  static async getOrCreateBucket(
    accessToken: string,
    planId: string,
    name: string
  ): Promise<string> {
    const existing = await this.listBuckets(accessToken, planId)
    const match = existing.find(b => b.name === name)
    if (match) return match.id

    const res = await this.graphFetch('/planner/buckets', accessToken, {
      method: 'POST',
      body: JSON.stringify({ name, planId, orderHint: ' !' }),
    })
    if (!res.ok) throw new Error(`No se pudo crear el bucket "${name}": ${res.status}`)
    const data = await res.json()
    return data.id
  }

  static async createTask(
    accessToken: string,
    input: PlannerTaskInput
  ): Promise<PlannerTaskResult> {
    const body: Record<string, unknown> = {
      planId: input.planId,
      title: input.title,
    }
    if (input.bucketId) body.bucketId = input.bucketId
    if (input.dueDateTime) body.dueDateTime = input.dueDateTime
    if (input.percentComplete !== undefined) body.percentComplete = input.percentComplete
    if (input.assigneeAadId) {
      body.assignments = {
        [input.assigneeAadId]: {
          '@odata.type': '#microsoft.graph.plannerAssignment',
          orderHint: ' !',
        },
      }
    }

    const res = await this.graphFetch('/planner/tasks', accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Error creando tarea en Planner: ${res.status} — ${err}`)
    }
    const data = await res.json()
    return {
      id: data.id,
      etag: res.headers.get('etag') ?? data['@odata.etag'] ?? '',
      planId: data.planId,
      bucketId: data.bucketId ?? null,
    }
  }

  static async updateTask(
    accessToken: string,
    taskId: string,
    etag: string,
    patch: Partial<Omit<PlannerTaskInput, 'planId'>>
  ): Promise<PlannerTaskResult> {
    const body: Record<string, unknown> = {}
    if (patch.title !== undefined) body.title = patch.title
    if (patch.dueDateTime !== undefined) body.dueDateTime = patch.dueDateTime
    if (patch.percentComplete !== undefined) body.percentComplete = patch.percentComplete
    if (patch.bucketId !== undefined) body.bucketId = patch.bucketId
    if (patch.assigneeAadId !== undefined) {
      body.assignments = patch.assigneeAadId
        ? {
            [patch.assigneeAadId]: {
              '@odata.type': '#microsoft.graph.plannerAssignment',
              orderHint: ' !',
            },
          }
        : {}
    }

    const res = await this.graphFetch(`/planner/tasks/${taskId}`, accessToken, {
      method: 'PATCH',
      headers: { 'If-Match': etag },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Error actualizando tarea en Planner: ${res.status} — ${err}`)
    }
    return {
      id: taskId,
      etag: res.headers.get('etag') ?? '',
      planId: '',
      bucketId: patch.bucketId ?? null,
    }
  }

  static async deleteTask(accessToken: string, taskId: string, etag: string): Promise<void> {
    const res = await this.graphFetch(`/planner/tasks/${taskId}`, accessToken, {
      method: 'DELETE',
      headers: { 'If-Match': etag },
    })
    // 404 = ya no existe del lado de Planner (borrada a mano ahí) — no es un error a propagar.
    if (!res.ok && res.status !== 404) {
      const err = await res.text()
      throw new Error(`Error eliminando tarea en Planner: ${res.status} — ${err}`)
    }
  }
}

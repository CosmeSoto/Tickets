/**
 * Constantes compartidas por los DOS flujos OAuth de Microsoft del módulo
 * Tareas/Planner — la cuenta de servicio compartida (admin, Planner) y la
 * cuenta personal por usuario (Microsoft To Do) — que desde este cambio
 * comparten un solo Redirect URI y un solo callback
 * (/api/planner/oauth-callback). Antes cada flujo tenía su propia ruta de
 * callback, obligando a registrar dos Redirect URI distintos en el portal de
 * Azure para un mismo App Registration — innecesario, ya que `state` alcanza
 * para que el callback distinga un flujo del otro.
 */
export const PLANNER_OAUTH_CALLBACK_PATH = '/api/planner/oauth-callback'
export const PLANNER_OAUTH_NONCE_COOKIE = 'planner_oauth_nonce'

export type PlannerOAuthFlow = 'admin-planner' | 'user-todo'

/**
 * Constantes del flujo OAuth para que cada usuario conecte su Drive personal
 * de adjuntos — ruta y callback propios, separados del callback de
 * Planner/Microsoft To Do (/api/planner/oauth-callback) a propósito: son
 * dominios distintos (Tareas vs. Adjuntos) y ese callback ya importa código
 * propio de Planner (personal_task_ms_todo_links) que no debería mezclarse
 * con lógica de adjuntos. Mismo App Registration ('azure-ad') igual, así que
 * solo hace falta registrar un Redirect URI más en el portal de Azure.
 */
export const PERSONAL_DRIVE_OAUTH_CALLBACK_PATH = '/api/attachments/personal-drive/oauth-callback'
export const PERSONAL_DRIVE_OAUTH_NONCE_COOKIE = 'personal_drive_oauth_nonce'

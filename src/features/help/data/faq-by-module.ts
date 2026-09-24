/**
 * Secciones y tipos del Centro de Ayuda — español, etiquetadas por módulo.
 * Se muestran solo si el usuario tiene el módulo habilitado (salvo `account`).
 *
 * El contenido real vive en la tabla `help_faqs` (editable desde
 * Configuración Sistema → Ayuda, sin tocar código) — ver
 * `src/components/settings/help-faqs-tab.tsx` y `/api/help/faqs`. El dato
 * semilla (`HELP_FAQS`) ya no vive aquí: se movió a
 * `prisma/seeds/help-faqs-data.ts` porque este archivo se importaba desde
 * `prisma/seeds/help-faqs.seed.ts`, que corre con `tsx` en el contenedor de
 * producción — donde solo se copia `prisma/`, no `src/` — y esa importación
 * fuera de límites hacía fallar el seed en silencio en cada rebuild.
 */

export type HelpModuleId =
  | 'account'
  | 'tickets'
  | 'inventory'
  | 'patrols'
  | 'knowledge'
  | 'forms'
  | 'credentials'
  | 'planner'
  | 'news'
  | 'processes'
  | 'access'

export interface HelpFaqItem {
  id: string
  module: HelpModuleId
  category: string
  question: string
  answer: string
  /** Roles para los que aplica; si empty = todos */
  roles?: Array<'ADMIN' | 'TECHNICIAN' | 'CLIENT'>
  keywords?: string[]
  /** Imagen o video (YouTube/Google Drive/imagen directa) — ver MediaUrlInput. */
  mediaUrl?: string | null
}

export interface HelpModuleSection {
  id: HelpModuleId
  title: string
  description: string
}

export const HELP_MODULE_SECTIONS: HelpModuleSection[] = [
  {
    id: 'account',
    title: 'Cuenta y acceso',
    description: 'Perfil, contraseña y notificaciones',
  },
  {
    id: 'tickets',
    title: 'Tickets / Soporte',
    description: 'Crear, seguir y responder solicitudes',
  },
  {
    id: 'inventory',
    title: 'Inventario',
    description: 'Activos, mantenimientos, contratos y proveedores',
  },
  {
    id: 'patrols',
    title: 'Rondas',
    description: 'Agenda, checkpoints e incidentes',
  },
  {
    id: 'knowledge',
    title: 'Base de conocimientos',
    description: 'Artículos y soluciones reutilizables',
  },
  {
    id: 'forms',
    title: 'Documentos',
    description: 'Formularios y documentos del área',
  },
  {
    id: 'credentials',
    title: 'Credenciales',
    description: 'Bóveda de secretos y accesos',
  },
  {
    id: 'planner',
    title: 'Tareas',
    description: 'Tablero Kanban y calendario, tareas de ticket e independientes',
  },
  {
    id: 'news',
    title: 'Noticias',
    description: 'Comunicados internos de la organización',
  },
  {
    id: 'processes',
    title: 'Procesos',
    description: 'Catálogo interno de procesos y procedimientos por área',
  },
  {
    id: 'access',
    title: 'Accesos',
    description: 'Pases QR para visitantes, contratistas y personal externo',
  },
]

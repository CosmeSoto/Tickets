/**
 * FAQs del Centro de Ayuda — español, etiquetadas por módulo.
 * Se muestran solo si el usuario tiene el módulo habilitado (salvo `account`).
 */

export type HelpModuleId =
  | 'account'
  | 'tickets'
  | 'inventory'
  | 'patrols'
  | 'knowledge'
  | 'forms'
  | 'credentials'

export interface HelpFaqItem {
  id: string
  module: HelpModuleId
  category: string
  question: string
  answer: string
  /** Roles para los que aplica; si empty = todos */
  roles?: Array<'ADMIN' | 'TECHNICIAN' | 'CLIENT' | 'CLIENT_MANAGER'>
  keywords?: string[]
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
]

export const HELP_FAQS: HelpFaqItem[] = [
  // ── Cuenta ──────────────────────────────────────────────────────────────
  {
    id: 'acc-1',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Cómo actualizo mi perfil?',
    answer:
      'Entra a «Mi Perfil» desde el menú de usuario (arriba a la derecha). Allí puedes actualizar nombre, datos de contacto y revisar tu acceso a módulos. Los cambios de rol o módulos los realiza un administrador.',
    keywords: ['perfil', 'datos', 'cuenta'],
  },
  {
    id: 'acc-2',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Qué hago si olvidé mi contraseña?',
    answer:
      'En la pantalla de inicio de sesión usa «¿Olvidaste tu contraseña?». Ingresa el correo registrado y recibirás un enlace para restablecerla. Si no llega, revisa spam o pide ayuda a un administrador.',
    keywords: ['contraseña', 'password', 'olvidé', 'reset'],
  },
  {
    id: 'acc-3',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Cómo configuro las notificaciones?',
    answer:
      'Desde Configuración / notificaciones (o Mi Perfil, según tu rol) puedes activar avisos en la aplicación y por correo para eventos como tickets, mantenimientos o rondas. Desactiva solo lo que no necesites para evitar saturación.',
    keywords: ['notificaciones', 'email', 'correo', 'avisos'],
  },
  {
    id: 'acc-4',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Por qué no veo un módulo en el menú?',
    answer:
      'El menú muestra solo los módulos habilitados para tu usuario y tus familias/áreas. Si necesitas Inventario, Rondas u otro módulo, un administrador debe activarlo en tu ficha de usuario o en la familia correspondiente.',
    keywords: ['módulos', 'menú', 'permisos', 'familia'],
  },

  // ── Tickets ─────────────────────────────────────────────────────────────
  {
    id: 'tkt-1',
    module: 'tickets',
    category: 'Tickets / Soporte',
    question: '¿Cómo creo un ticket de soporte?',
    answer:
      'Ve a «Crear Ticket», elige el área de soporte, escribe un título claro y una descripción detallada. El sistema sugerirá categorías según el texto; si ninguna encaja, usa «Explorar relacionadas» o el árbol completo. Adjunta capturas si ayudan. Al enviar, el equipo recibe la solicitud y puedes seguirla en «Mis Tickets».',
    keywords: ['crear', 'ticket', 'categoría', 'área'],
  },
  {
    id: 'tkt-2',
    module: 'tickets',
    category: 'Tickets / Soporte',
    question: '¿Qué significan los estados de un ticket?',
    answer:
      'Abierto: recién creado o en cola. En progreso: alguien del equipo ya lo atiende. Pendiente: se espera información tuya u otra dependencia. Resuelto: el equipo propuso una solución; confirma o vuelve a abrir si hace falta. Cerrado: finalizado.',
    keywords: ['estado', 'abierto', 'resuelto', 'cerrado'],
  },
  {
    id: 'tkt-3',
    module: 'tickets',
    category: 'Tickets / Soporte',
    question: '¿Puedo cambiar la prioridad después de crear el ticket?',
    answer:
      'Los clientes no cambian la prioridad una vez creado. Si es urgente, agrega un comentario explicando el impacto; el equipo puede reevaluar. Administradores y técnicos sí pueden ajustar prioridad según política interna.',
    keywords: ['prioridad', 'urgente'],
  },
  {
    id: 'tkt-4',
    module: 'tickets',
    category: 'Tickets / Soporte',
    question: '¿Cómo agrego información a un ticket existente?',
    answer:
      'Ábrelo desde la lista de tickets y usa la zona de comentarios. Puedes adjuntar archivos. Quien esté asignado recibirá notificación en la app y, si está configurado, por correo.',
    keywords: ['comentario', 'responder', 'adjunto'],
  },
  {
    id: 'tkt-5',
    module: 'tickets',
    category: 'Tickets / Soporte',
    question: '¿Las categorías sugeridas no son correctas, qué hago?',
    answer:
      'Escribe título y descripción con palabras concretas del problema (ej. «escanear», «impresora»). Revisa las sugerencias; si no alcanza, usa «Explorar relacionadas» (filtradas por tu texto) o «Ver todas las categorías del área». También puedes buscar con Ctrl+K.',
    keywords: ['categoría', 'sugerencias', 'escanear'],
  },
  {
    id: 'tkt-6',
    module: 'tickets',
    category: 'Tickets / Soporte',
    question: '¿Cómo veo el estado de mis tickets?',
    answer:
      'En «Mis Tickets» (o «Todos los Tickets» si eres administrador/técnico) verás el listado con estado actual. Abre cualquier ticket para el detalle, historial y comentarios.',
    keywords: ['estado', 'lista', 'seguimiento'],
  },

  // ── Inventario ──────────────────────────────────────────────────────────
  {
    id: 'inv-1',
    module: 'inventory',
    category: 'Inventario',
    question: '¿Dónde veo los equipos que me asignaron?',
    answer:
      'En Inventario / Mis Activos (o Activos, según tu rol) verás el listado de equipos vinculados a ti. Desde el detalle puedes consultar estado, ubicación y acciones permitidas (solicitar mantenimiento, actas, etc.).',
    keywords: ['equipo', 'activo', 'asignado'],
  },
  {
    id: 'inv-2',
    module: 'inventory',
    category: 'Inventario',
    question: '¿Cómo solicito o programo un mantenimiento?',
    answer:
      'Como cliente: desde Mantenimientos o el detalle del equipo puedes solicitar mantenimiento; el equipo técnico aprueba y programa. Como administrador/técnico: puedes programar de inmediato (individual o masivo por tipo) y elegir técnico interno o proveedor externo, con contrato opcional. El equipo pasa a estado «En mantenimiento» al programarse.',
    keywords: ['mantenimiento', 'proveedor', 'contrato', 'masivo'],
  },
  {
    id: 'inv-3',
    module: 'inventory',
    category: 'Inventario',
    question: '¿Qué es un mantenimiento con proveedor externo?',
    answer:
      'Cuando el trabajo lo hace un tercero (no el técnico interno), al programar o aprobar eliges «Proveedor externo» y, si aplica, un contrato de soporte/mantenimiento. Queda registrado en auditoría; el usuario asignado recibe aviso. Al completar puedes registrar factura y garantía del proveedor.',
    keywords: ['proveedor', 'externo', 'factura', 'garantía'],
  },
  {
    id: 'inv-4',
    module: 'inventory',
    category: 'Inventario',
    question: '¿Para qué sirven los contratos en inventario?',
    answer:
      'Los contratos documentan alquileres, licencias, mantenimiento o soporte con un proveedor. Puedes vincularlos a equipos o a un mantenimiento externo. El sistema envía alertas de vencimiento según la configuración del contrato.',
    keywords: ['contrato', 'suscripción', 'vencimiento'],
  },
  {
    id: 'inv-5',
    module: 'inventory',
    category: 'Inventario',
    question: '¿Quién puede gestionar proveedores y actas?',
    answer:
      'Depende de tus permisos de inventario y familia. Quienes gestionan inventario pueden crear/editar proveedores, actas de entrega/devolución y bajas. Los clientes suelen ver solo lo vinculado a sus activos. Toda acción relevante queda en auditoría.',
    keywords: ['proveedor', 'acta', 'permisos'],
    roles: ['ADMIN', 'TECHNICIAN', 'CLIENT_MANAGER'],
  },

  // ── Rondas ──────────────────────────────────────────────────────────────
  {
    id: 'pat-1',
    module: 'patrols',
    category: 'Rondas',
    question: '¿Cómo veo mis rondas programadas?',
    answer:
      'En el menú Rondas / Mis Rondas (o Agenda, según rol) verás las rondas asignadas con fecha y ruta. Completa los checkpoints según la instrucción de cada punto e reporta incidencias si detectas anomalías.',
    keywords: ['ronda', 'agenda', 'checkpoint'],
  },
  {
    id: 'pat-2',
    module: 'patrols',
    category: 'Rondas',
    question: '¿Qué hago si encuentro un incidente en una ronda?',
    answer:
      'Registra el incidente desde la ronda o desde Incidentes, con descripción y evidencia si es posible. El personal de supervisión podrá dar seguimiento desde el módulo de rondas.',
    keywords: ['incidente', 'anomalía'],
  },

  // ── Conocimientos ───────────────────────────────────────────────────────
  {
    id: 'kb-1',
    module: 'knowledge',
    category: 'Base de conocimientos',
    question: '¿Para qué sirve la Base de conocimientos?',
    answer:
      'Reúne artículos y soluciones reutilizables por área. Úsala antes de abrir un ticket o mientras categorizas un problema. Si tu usuario tiene el acceso desactivado, no aparecerá en el menú aunque el módulo de tickets esté activo.',
    keywords: ['conocimiento', 'artículo', 'kb'],
  },
  {
    id: 'kb-2',
    module: 'knowledge',
    category: 'Base de conocimientos',
    question: '¿Quién publica artículos?',
    answer:
      'Administradores y técnicos con permiso pueden crear y publicar artículos. Los clientes suelen consultar los publicados visibles para su área.',
    keywords: ['publicar', 'artículo'],
    roles: ['ADMIN', 'TECHNICIAN'],
  },

  // ── Documentos ──────────────────────────────────────────────────────────
  {
    id: 'frm-1',
    module: 'forms',
    category: 'Documentos',
    question: '¿Cómo uso el módulo de Documentos?',
    answer:
      'Desde Documentos/Formularios puedes completar o consultar los formularios habilitados para tu área. Si no ves la sección, el módulo no está activo para tu usuario.',
    keywords: ['formulario', 'documento'],
  },

  // ── Credenciales ────────────────────────────────────────────────────────
  {
    id: 'crd-1',
    module: 'credentials',
    category: 'Credenciales',
    question: '¿Qué es la bóveda de credenciales?',
    answer:
      'Es un espacio para guardar secretos de acceso de forma cifrada (no en texto plano en respaldos). Solo usuarios con el módulo y permisos adecuados pueden ver o revelar entradas; las acciones sensibles quedan auditadas.',
    keywords: ['credencial', 'bóveda', 'secreto', 'password'],
  },

  // ── Administración / auditoría / respaldos ──────────────────────────────
  {
    id: 'acc-5',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Qué queda registrado en la auditoría?',
    answer:
      'Acciones relevantes del sistema (tickets, inventario, mantenimientos, proveedores, actas, credenciales, etc.) generan registros de auditoría con usuario, fecha y detalle. Los clientes no ven el panel completo; administradores con permiso (p. ej. Super Admin) consultan Auditoría en el menú.',
    keywords: ['auditoría', 'historial', 'log'],
    roles: ['ADMIN', 'TECHNICIAN'],
  },
  {
    id: 'acc-6',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Cómo funcionan los respaldos y dumps?',
    answer:
      'Los respaldos del sistema y los dumps por módulo (p. ej. inventario con contratos y mantenimientos) los gestiona administración desde la configuración de respaldos. Los secretos de credenciales se exportan cifrados, no en texto plano. Restaurar un dump debe respetar el orden de dependencias (catálogos → contratos → mantenimientos, etc.).',
    keywords: ['backup', 'respaldo', 'dump', 'restaurar'],
    roles: ['ADMIN'],
  },
  {
    id: 'acc-7',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Recibiré correos además de avisos en la app?',
    answer:
      'Sí, si las notificaciones por correo están activas para tu usuario y el evento lo contempla (tickets, comentarios, mantenimientos programados, alertas de contratos, etc.). Revisa preferencias de notificación y la carpeta de spam si no llegan.',
    keywords: ['correo', 'email', 'notificación'],
  },
]

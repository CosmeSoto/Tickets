/**
 * FAQs del Centro de Ayuda — español, etiquetadas por módulo.
 * Se muestran solo si el usuario tiene el módulo habilitado (salvo `account`).
 *
 * El contenido real ahora vive en la tabla `help_faqs` (editable desde
 * Configuración Sistema → Ayuda, sin tocar código) — ver
 * `src/components/settings/help-faqs-tab.tsx` y `/api/help/faqs`. El array
 * `HELP_FAQS` de este archivo YA NO SE LEE EN TIEMPO DE EJECUCIÓN: solo sirve
 * como dato semilla para `prisma/seed.ts` (la primera carga de la tabla).
 * Editar este array después de esa siembra no tiene ningún efecto — usa la
 * pantalla de administración.
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
      'Los contratos documentan alquileres, licencias, mantenimiento o soporte. Cada línea (equipo) puede tener su propia fecha de renta. En Inventario → Pagos ves las cuotas: cada mes se cobra solo lo que sigue en renta. Tras agregar o devolver un activo, usa «Recalcular pendientes» en el contrato. Las alertas de vencimiento de contrato, de fin de renta de un equipo y de cuotas salen in-app, correo y Telegram (si están activos). Los dumps de inventario ya incluyen contratos, líneas y pagos.',
    keywords: ['contrato', 'suscripción', 'vencimiento', 'pago', 'renta'],
  },
  {
    id: 'inv-payments',
    module: 'inventory',
    category: 'Inventario',
    question: '¿Dónde se gestionan los pagos de contratos de renta?',
    answer:
      'En el menú Inventario → Pagos (justo debajo de Contratos). Ahí registras cuotas vencidas o del mes. El calendario de un contrato sigue en el detalle del contrato (generar / recalcular). El monto no es un único costo del encabezado si las líneas tienen precio: es la suma de equipos vigentes esa fecha.',
    keywords: ['pagos', 'cuota', 'mensual', 'renta'],
    roles: ['ADMIN', 'TECHNICIAN'],
  },
  {
    id: 'inv-5',
    module: 'inventory',
    category: 'Inventario',
    question: '¿Quién puede gestionar proveedores y actas?',
    answer:
      'Depende de tus permisos de inventario y familia. Quienes gestionan inventario pueden crear/editar proveedores, actas de entrega/devolución y bajas. Los clientes suelen ver solo lo vinculado a sus activos. Toda acción relevante queda en auditoría.',
    keywords: ['proveedor', 'acta', 'permisos'],
    roles: ['ADMIN', 'TECHNICIAN'],
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
  {
    id: 'pat-3',
    module: 'patrols',
    category: 'Rondas',
    question: '¿Qué es un checkpoint y cómo lo completo?',
    answer:
      'Un checkpoint es un punto físico de la ruta (con su propia instrucción) que debes marcar como completado al pasar por ahí durante la ronda — algunos piden foto o comentario según cómo esté configurado. Si un checkpoint no aparece o la ruta cambió, avisa a quien programa las rutas.',
    keywords: ['checkpoint', 'ruta', 'punto'],
  },
  {
    id: 'pat-4',
    module: 'patrols',
    category: 'Rondas',
    question: '¿Quién programa las rutas y la agenda de rondas?',
    answer:
      'Administradores y técnicos con permiso de gestión de rondas crean rutas (secuencia de checkpoints) y programan la agenda (quién, cuándo, con qué frecuencia). El personal asignado solo ve y ejecuta lo que le corresponde.',
    keywords: ['ruta', 'programación', 'agenda'],
    roles: ['ADMIN', 'TECHNICIAN'],
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
  {
    id: 'frm-2',
    module: 'forms',
    category: 'Documentos',
    question: '¿Quién crea o publica un formulario nuevo?',
    answer:
      'Administradores y técnicos con permiso de gestión de Documentos crean y publican formularios para su área. El resto de usuarios solo completa o consulta los que ya están publicados y habilitados para ellos.',
    keywords: ['formulario', 'publicar', 'crear'],
    roles: ['ADMIN', 'TECHNICIAN'],
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
  {
    id: 'crd-2',
    module: 'credentials',
    category: 'Credenciales',
    question: '¿Cómo comparto una credencial con otra persona sin decirle la contraseña?',
    answer:
      'Usa «Compartir» sobre la entrada y elige con quién (persona o área). La otra persona puede revelarla desde su propia sesión si tiene permiso — no hace falta enviarla por chat o correo. Revocar el acceso compartido no borra la credencial, solo quita la visibilidad de esa persona.',
    keywords: ['compartir', 'revelar', 'acceso'],
    roles: ['ADMIN', 'TECHNICIAN'],
  },

  // ── Tareas (Planner) ───────────────────────────────────────────────────
  {
    id: 'plnr-1',
    module: 'planner',
    category: 'Tareas',
    question: '¿Qué son las tareas independientes?',
    answer:
      'Además de las tareas que salen de un plan de resolución de un ticket, puedes crear tareas propias del día a día directamente desde el tablero o el calendario — sin que dependan de ningún ticket. Son tuyas: solo tú puedes editarlas o borrarlas.',
    keywords: ['tarea', 'independiente', 'tablero', 'calendario'],
  },
  {
    id: 'plnr-2',
    module: 'planner',
    category: 'Tareas',
    question: '¿Cómo creo una tarea desde el calendario?',
    answer:
      'En la vista Semana o Día, haz clic en un horario vacío para crear una tarea con esa fecha y hora ya cargadas. En la vista Mes, pasa el mouse sobre un día para ver el botón «+». También puedes usar «Nueva tarea» en la barra superior del tablero.',
    keywords: ['crear', 'calendario', 'semana', 'mes'],
  },
  {
    id: 'plnr-3',
    module: 'planner',
    category: 'Tareas',
    question: '¿Puedo sincronizar mis tareas con Microsoft To Do?',
    answer:
      'Sí, desde Mi Perfil → Microsoft To Do puedes vincular tu propia cuenta de Microsoft. Una vez conectada, tus tareas independientes se sincronizan automáticamente en ambos sentidos. Si no conectas ninguna cuenta, tus tareas simplemente quedan solo en la app — no es un error.',
    keywords: ['sincronizar', 'microsoft', 'to do', 'perfil'],
  },
  {
    id: 'plnr-4',
    module: 'planner',
    category: 'Tareas',
    question: '¿Dónde veo reportes de cumplimiento de tareas?',
    answer:
      'En Tareas → Reportes (en el sidebar, debajo del tablero) puedes filtrar por técnico, por origen (de ticket o independiente), por estado (cumplidas o pendientes/vencidas) y por área, en un rango de día/semana/mes o personalizado. Ver el reporte de otro técnico requiere permiso de gestión del módulo.',
    keywords: ['reporte', 'cumplimiento', 'vencida'],
  },

  // ── Noticias ─────────────────────────────────────────────────────────────
  {
    id: 'news-1',
    module: 'news',
    category: 'Noticias',
    question: '¿Dónde veo las noticias y anuncios de la organización?',
    answer:
      'En la sección "Centro de Noticias" de tu pantalla de inicio, con comunicados, anuncios, eventos y otras publicaciones internas separados en Alertas urgentes, Destacados y el resto, más recientes primero. Podés filtrar por tipo y por período (hoy/semana/mes). Algunas noticias solo son visibles para ciertas áreas o roles, según cómo las haya configurado quien las publicó. Si además tenés permiso para gestionar Noticias, vas a ver un menú "Noticias" aparte: ese es para crear y editar publicaciones, no para leerlas.',
    keywords: ['noticia', 'anuncio', 'comunicado', 'evento', 'inicio', 'dashboard'],
  },
  {
    id: 'news-2',
    module: 'news',
    category: 'Noticias',
    question: '¿Quién puede publicar una noticia?',
    answer:
      'Usuarios con permiso de gestión de Noticias pueden crear y publicar (texto, imágenes o video incrustado desde YouTube/Drive) desde el menú "Noticias". El resto de usuarios solo las consulta en el Centro de Noticias de su pantalla de inicio, según la visibilidad configurada para su área o rol.',
    keywords: ['publicar', 'crear', 'permiso'],
    roles: ['ADMIN', 'TECHNICIAN'],
  },

  // ── Procesos ─────────────────────────────────────────────────────────────
  {
    id: 'proc-1',
    module: 'processes',
    category: 'Procesos',
    question: '¿Para qué sirve el módulo de Procesos?',
    answer:
      'Es el catálogo interno de procesos y procedimientos de tu organización, organizados por área — con sus versiones y diagramas. Úsalo como referencia antes de ejecutar un procedimiento poco frecuente, en vez de repreguntar cada vez.',
    keywords: ['proceso', 'procedimiento', 'catálogo', 'diagrama'],
  },
  {
    id: 'proc-2',
    module: 'processes',
    category: 'Procesos',
    question: '¿Quién puede editar o publicar una nueva versión de un proceso?',
    answer:
      'Usuarios con permiso de gestión de Procesos de esa área. Cada edición relevante genera una nueva versión — las versiones anteriores no se pierden, quedan disponibles para consulta.',
    keywords: ['editar', 'versión', 'publicar'],
    roles: ['ADMIN', 'TECHNICIAN'],
  },

  // ── Accesos ──────────────────────────────────────────────────────────────
  {
    id: 'acc-9',
    module: 'access',
    category: 'Accesos',
    question: '¿Qué es el módulo de Accesos?',
    answer:
      'Genera pases QR verificables para personal externo, visitantes y contratistas que necesitan ingresar a tus instalaciones — por área, con fecha/hora de validez. Quien recibe el pase lo presenta y el personal de seguridad lo verifica escaneándolo.',
    keywords: ['acceso', 'pase', 'qr', 'visitante'],
  },
  {
    id: 'acc-10',
    module: 'access',
    category: 'Accesos',
    question: '¿Cómo genero o reviso un pase QR?',
    answer:
      'Desde Accesos, «Nuevo pase» pide los datos de la persona, el área y la validez. El QR generado se puede compartir o imprimir. Para revisar el historial de pases emitidos y su estado (usado, vencido, revocado), consulta el listado del módulo.',
    keywords: ['generar', 'revisar', 'historial'],
    roles: ['ADMIN', 'TECHNICIAN'],
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
  {
    id: 'acc-8',
    module: 'account',
    category: 'Cuenta y acceso',
    question: '¿Cómo se protegen mis datos personales?',
    answer:
      'Tratamos los datos conforme a la normativa aplicable de protección de datos personales (p. ej. LOPD Ecuador): minimización (solo lo necesario), control de acceso por rol/módulo, auditoría de acciones sensibles y cifrado de secretos en la bóveda de credenciales. El correo de contacto de soporte es el configurado por la organización en «Configuración del Sistema». Puedes consultar la Política de Privacidad y ejercer derechos de acceso, rectificación u oposición según el procedimiento indicado allí.',
    keywords: ['privacidad', 'LOPD', 'datos', 'personales', 'protección'],
  },
]

/**
 * Seed: Categorías TI bajo familia ADMINISTRACIÓN — departamento único
 * "Tecnologías de la Información".
 *
 * Antes había 5 departamentos separados (TI, Soporte Técnico, Seguridad
 * Informática, Usuarios y Privilegios, Telefonía) con 117 categorías entre
 * los cinco, hasta 3 niveles de profundidad y una por cada síntoma (ej. 14
 * categorías solo para fallas de impresora). Los 4 departamentos se
 * fusionaron en "Tecnologías de la Información" (ver
 * `department-family-map.ts` / `ensure-departments.ts`, mismo mecanismo
 * usado antes para consolidar "Mantenimiento"), y aquí se reduce el árbol a
 * 15 categorías: 3 contenedoras con 2 hijas (Incidentes/Solicitudes) donde
 * esa distinción cambia la urgencia real, y 6 categorías planas donde no.
 *
 * El detalle que antes vivía en el NOMBRE de cada categoría (una por
 * síntoma) ahora vive en su DESCRIPCIÓN — el selector de categorías al crear
 * un ticket ya trae un motor de sugerencias por título/descripción (Fuse.js,
 * `src/features/category-selection`) que arma sus "keywords" de búsqueda
 * extrayendo palabras de `name` + `description`
 * (`utils/search-index.ts:41-48`). Es decir, la descripción ya funciona como
 * bolsa de palabras clave: no hace falta una categoría por síntoma para que
 * el cliente que escribe "se atascó el papel" reciba la sugerencia correcta.
 *
 * Las 12 categorías seleccionables (no las 3 contenedoras) llevan además un
 * `priorityCeiling` inicial — techo automático de prioridad para tickets de
 * clientes (ver resolveInitialPriority en src/lib/tickets/priority-triage.ts):
 * HIGH en fallas que afectan a varias personas a la vez (red, correo/M365,
 * energía regulada, telefonía), URGENT (= sin recorte) en incidentes de
 * seguridad, LOW en todo lo que es puramente provisioning/compra, y MEDIUM en
 * el resto. Solo se aplica al crear la categoría — si ya existe, un admin
 * pudo haberlo ajustado a mano después y el seed no lo pisa (ver
 * category-upsert.ts).
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesTechnology(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptId = deptMap.get('Tecnologías de la Información')

  if (!deptId) {
    console.log(
      '⚠️  Departamento de Tecnologías de la Información no encontrado, saltando seed de categorías TI...'
    )
    return
  }

  // Los ids de las 15 categorías nuevas — se usan al final para desactivar
  // en bloque todo lo demás que quede bajo este departamento (ver abajo).
  const newIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    newIds.push(category.id)
    return category
  }

  // ==================== CONTENEDORAS CON INCIDENTES / SOLICITUDES ====================
  // Solo donde "se rompió" y "quiero algo nuevo" tienen urgencia realmente
  // distinta (importa para el priorityCeiling que se configure después).

  const redVpn = await create({
    name: 'Red, Internet y VPN',
    // Descripción deliberadamente neutra (sin "internet"/"VPN"/etc.): el
    // clic en una sugerencia llama onChange(categoryId) directo, sin
    // comprobar si tiene hijos (CategorySelector.tsx:417-422) — si esta
    // contenedora repitiera las palabras clave de sus hijas, a veces le
    // ganaría el score y un ticket podría quedar con una categoría no-hoja.
    description: 'Grupo con subcategorías',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 1,
    color: '#0EA5E9',
  })
  await create({
    name: 'Incidentes de Red y Conectividad',
    description:
      'Sin conexión, pérdida de internet, wifi caído, señal inalámbrica, daño de switch o router, pérdida de rutas, firewall bloqueando puertos, túnel VPN caído o inestable',
    level: 2,
    parentId: redVpn.id,
    departmentId: deptId,
    order: 1,
    color: '#EF4444',
    // Puede dejar sin trabajar a toda un área (wifi/switch caído).
    priorityCeiling: TicketPriority.HIGH,
  })
  await create({
    name: 'Solicitudes de Red y VPN',
    description:
      'Creación de SSID, alta o cambio de VPN de sitio o de usuario, Fortinet, reportes de tráfico o infraestructura de red',
    level: 2,
    parentId: redVpn.id,
    departmentId: deptId,
    order: 2,
    color: '#3B82F6',
    // Provisioning — nunca es una emergencia.
    priorityCeiling: TicketPriority.LOW,
  })

  const telefonia = await create({
    name: 'Telefonía',
    description: 'Grupo con subcategorías',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 2,
    color: '#8B5CF6',
  })
  await create({
    name: 'Incidentes de Telefonía',
    description:
      'Bocina o extensión dañada, extensión no funciona, no marca, sin tono, problemas con llamadas entrantes o salientes, teléfono IP sin red, central telefónica o PBX caída, buzón de voz o IVR no funciona',
    level: 2,
    parentId: telefonia.id,
    departmentId: deptId,
    order: 1,
    color: '#EF4444',
    // Incluye la central/PBX caída (afecta a todos), no solo una extensión.
    priorityCeiling: TicketPriority.HIGH,
  })
  await create({
    name: 'Solicitudes de Telefonía',
    description: 'Cambio o alta de extensión, configurar desvío de llamadas o buzón de voz',
    level: 2,
    parentId: telefonia.id,
    departmentId: deptId,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  const seguridad = await create({
    name: 'Seguridad de la Información',
    description: 'Grupo con subcategorías',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 8,
    color: '#DC2626',
  })
  await create({
    name: 'Incidentes de Seguridad',
    description:
      'Divulgación no autorizada o fuga de información, intentos fallidos de inicio de sesión, ataques informáticos, malware, phishing o correo sospechoso, cuenta de correo comprometida, buzón en cuarentena o bloqueado',
    level: 2,
    parentId: seguridad.id,
    departmentId: deptId,
    order: 1,
    color: '#EF4444',
    // Sin techo real (URGENT = sin recorte): un incidente de seguridad en
    // curso es justo el caso que nunca debe quedar capado por debajo de lo
    // que el cliente pide.
    priorityCeiling: TicketPriority.URGENT,
  })
  await create({
    name: 'Requerimientos de Seguridad',
    description:
      'Definición de políticas de seguridad, aprobación de servicio VPN, capacitación o sensibilización en seguridad, validación de altas, bajas o modificación de cuentas de usuario',
    level: 2,
    parentId: seguridad.id,
    departmentId: deptId,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== PLANAS (una sola categoría) ====================

  await create({
    name: 'Impresión y Escaneo',
    description:
      'Impresora, fotocopiadora, escáner, impresora de etiquetas: atasco de papel, no imprime, no fotocopia, no escanea, no digitaliza, líneas al imprimir, escanear o fotocopiar, baja calidad de imagen, ruido anormal, no enciende, bloqueada, cola de impresión, sin conexión de red, cable dañado, no imprime stickers',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 3,
    color: '#EC4899',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Correo y Microsoft 365',
    description:
      'Outlook, correo electrónico, Microsoft 365, Exchange, buzón: no recibe correos, no puede enviar, buzón lleno, correo en spam o cuarentena, correo rebotado, Outlook no abre o no inicia, no sincroniza, perfil de correo dañado, firma o configuración local, error al iniciar sesión en M365, servicio de correo no disponible o intermitente, cola de correo retenida, conector SMTP',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 4,
    color: '#6366F1',
    // Un correo/M365 caído deja a todos sin poder trabajar.
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Cuentas y Accesos',
    description:
      'Alta, baja o modificación de cuenta de usuario, correo o VPN: crear o eliminar cuenta de correo, cambio de contraseña, alias o redirección, lista de distribución o grupo, buzón compartido, aumento de cuota de buzón, creación o desactivación de usuario en M365, creación o baja de usuario VPN, modificación de perfil y privilegios de acceso VPN',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 5,
    color: '#22C55E',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Energía Regulada',
    description: 'UPS, batería, estabilizador, energía eléctrica regulada: en batería, no enciende',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 6,
    color: '#F59E0B',
    // Riesgo de daño a equipos o corte de energía si no se atiende pronto.
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Equipos de Cómputo',
    description:
      'Computadora, laptop, hardware: verificación de partes, preparación de equipos nuevos, revisión técnica, instalación de sistema operativo o software base, reparación de hardware o componentes',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 7,
    color: '#10B981',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Compras y Suministros TI',
    description:
      'Adquisición o renovación de equipos de cómputo, impresoras, energía regulada (UPS, baterías), consumibles como tóner, papel, cables, partes o piezas de repuesto, mantenimiento programado de energía regulada',
    level: 1,
    parentId: null,
    departmentId: deptId,
    order: 9,
    color: '#06B6D4',
    // Compras/adquisiciones: nunca es una emergencia — es el bucket
    // pensado justo para que estas solicitudes no compitan por prioridad
    // urgente con fallas reales.
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== RETIRO DE LAS CATEGORÍAS VIEJAS ====================
  // La fusión de departamentos (ensureDepartments, corre antes que este seed)
  // ya reasignó las ~117 categorías viejas de los 5 departamentos originales
  // a este mismo `deptId` — solo cambiaron de departamento, conservan su
  // nombre/nivel/parentId de antes. En vez de listar cada una con su
  // parentId exacto (perdimos esas variables al reescribir este archivo, y
  // sería frágil reconstruirlas), se desactiva en bloque todo lo que sigue
  // activo bajo este departamento y no es uno de los 15 ids nuevos de
  // arriba (por id, no por nombre — varias categorías viejas comparten
  // nombre con una nueva pero a otro nivel/padre, ej. "Energía Regulada").
  // `isActive:false` conserva el historial de cualquier ticket que ya las
  // use (no se borran filas).
  const oldCategories = await prisma.categories.findMany({
    where: { departmentId: deptId, isActive: true, id: { notIn: newIds } },
    select: { id: true },
  })
  if (oldCategories.length > 0) {
    await prisma.categories.updateMany({
      where: { id: { in: oldCategories.map(c => c.id) } },
      data: { isActive: false, updatedAt: new Date() },
    })
  }

  console.log(
    `✅ Categorías TI (Administración): ${newIds.length} categorías consolidadas bajo "Tecnologías de la Información", ${oldCategories.length} retiradas`
  )
}

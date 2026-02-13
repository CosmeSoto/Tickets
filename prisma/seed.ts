import { PrismaClient, UserRole, TicketStatus, TicketPriority } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')

  // Limpiar datos existentes
  await prisma.article_votes.deleteMany()
  await prisma.knowledge_articles.deleteMany()
  await prisma.ticket_history.deleteMany()
  await prisma.comments.deleteMany()
  await prisma.attachments.deleteMany()
  await prisma.notifications.deleteMany()
  await prisma.notification_preferences.deleteMany()
  await prisma.technician_assignments.deleteMany()
  await prisma.tickets.deleteMany()
  await prisma.categories.deleteMany()
  await prisma.audit_logs.deleteMany()
  await prisma.oauth_accounts.deleteMany()
  await prisma.sessions.deleteMany()
  await prisma.accounts.deleteMany()
  await prisma.users.deleteMany()
  await prisma.departments.deleteMany()

  const now = new Date()

  // Crear departamentos primero
  const deptTech = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Tecnología',
      description: 'Departamento de Tecnología e Innovación',
      color: '#3B82F6',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptSupport = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Soporte Técnico',
      description: 'Soporte y Atención al Usuario',
      color: '#10B981',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptDev = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Desarrollo',
      description: 'Desarrollo de Aplicaciones',
      color: '#EC4899',
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptSales = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Ventas',
      description: 'Departamento de Ventas',
      color: '#F59E0B',
      order: 4,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptMarketing = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Marketing',
      description: 'Departamento de Marketing',
      color: '#8B5CF6',
      order: 5,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Departamentos creados')

  // Crear usuarios
  const adminPassword = await bcrypt.hash('admin123', 12)
  const techPassword = await bcrypt.hash('tech123', 12)
  const clientPassword = await bcrypt.hash('client123', 12)

  const admin = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'admin@tickets.com',
      name: 'Administrador Sistema',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      departmentId: deptTech.id,
      phone: '+1234567890',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const technician1 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'tecnico1@tickets.com',
      name: 'Juan Pérez',
      passwordHash: techPassword,
      role: UserRole.TECHNICIAN,
      departmentId: deptSupport.id,
      phone: '+1234567891',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const technician2 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'tecnico2@tickets.com',
      name: 'María García',
      passwordHash: techPassword,
      role: UserRole.TECHNICIAN,
      departmentId: deptDev.id,
      phone: '+1234567892',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const client1 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'cliente1@empresa.com',
      name: 'Carlos López',
      passwordHash: clientPassword,
      role: UserRole.CLIENT,
      departmentId: deptSales.id,
      phone: '+1234567893',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const client2 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'cliente2@empresa.com',
      name: 'Ana Martínez',
      passwordHash: clientPassword,
      role: UserRole.CLIENT,
      departmentId: deptMarketing.id,
      phone: '+1234567894',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Usuarios creados')

  // Crear categorías jerárquicas
  const hardwareCategory = await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Hardware',
      description: 'Problemas relacionados con hardware',
      level: 1,
      color: '#EF4444',
      order: 1,
      departmentId: deptSupport.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const softwareCategory = await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Software',
      description: 'Problemas relacionados con software',
      level: 1,
      color: '#3B82F6',
      order: 2,
      departmentId: deptDev.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const networkCategory = await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Red y Conectividad',
      description: 'Problemas de red e internet',
      level: 1,
      color: '#10B981',
      order: 3,
      departmentId: deptTech.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  // Subcategorías
  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Computadoras',
      description: 'Problemas con PCs y laptops',
      level: 2,
      parentId: hardwareCategory.id,
      color: '#F87171',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Impresoras',
      description: 'Problemas con impresoras',
      level: 2,
      parentId: hardwareCategory.id,
      color: '#F87171',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Aplicaciones',
      description: 'Problemas con aplicaciones',
      level: 2,
      parentId: softwareCategory.id,
      color: '#60A5FA',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Sistema Operativo',
      description: 'Problemas con Windows/Mac/Linux',
      level: 2,
      parentId: softwareCategory.id,
      color: '#60A5FA',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Categorías creadas')

  // Crear asignaciones de técnicos
  await prisma.technician_assignments.create({
    data: {
      id: randomUUID(),
      technicianId: technician1.id,
      categoryId: hardwareCategory.id,
      priority: 1,
      maxTickets: 10,
      autoAssign: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.technician_assignments.create({
    data: {
      id: randomUUID(),
      technicianId: technician2.id,
      categoryId: softwareCategory.id,
      priority: 1,
      maxTickets: 15,
      autoAssign: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.technician_assignments.create({
    data: {
      id: randomUUID(),
      technicianId: technician1.id,
      categoryId: networkCategory.id,
      priority: 2,
      maxTickets: 8,
      autoAssign: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Asignaciones de técnicos creadas')

  // Crear tickets de ejemplo
  const ticket1 = await prisma.tickets.create({
    data: {
      id: randomUUID(),
      title: 'Computadora no enciende',
      description: 'La computadora del escritorio no enciende después del corte de luz de ayer.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      clientId: client1.id,
      categoryId: hardwareCategory.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const ticket2 = await prisma.tickets.create({
    data: {
      id: randomUUID(),
      title: 'Error en aplicación de ventas',
      description: 'La aplicación de ventas se cierra inesperadamente al intentar generar reportes.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      clientId: client2.id,
      assigneeId: technician2.id,
      categoryId: softwareCategory.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const ticket3 = await prisma.tickets.create({
    data: {
      id: randomUUID(),
      title: 'Internet lento en oficina',
      description: 'La conexión a internet está muy lenta en toda la oficina desde esta mañana.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      clientId: client1.id,
      assigneeId: technician1.id,
      categoryId: networkCategory.id,
      resolvedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Tickets de ejemplo creados')

  // Crear comentarios
  await prisma.comments.create({
    data: {
      id: randomUUID(),
      content: 'He revisado el ticket y necesito más información sobre el modelo de la computadora.',
      isInternal: false,
      ticketId: ticket1.id,
      authorId: technician1.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.comments.create({
    data: {
      id: randomUUID(),
      content: 'Es una Dell OptiPlex 7090, comprada el año pasado.',
      isInternal: false,
      ticketId: ticket1.id,
      authorId: client1.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.comments.create({
    data: {
      id: randomUUID(),
      content: 'Nota interna: Revisar fuente de poder, posible daño por sobretensión.',
      isInternal: true,
      ticketId: ticket1.id,
      authorId: technician1.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Comentarios creados')

  // Crear historial de tickets
  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      action: 'created',
      comment: 'Ticket creado por el cliente',
      ticketId: ticket1.id,
      userId: client1.id,
      createdAt: now,
    },
  })

  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      action: 'assigned',
      field: 'assigneeId',
      newValue: technician2.id,
      comment: 'Ticket asignado automáticamente',
      ticketId: ticket2.id,
      userId: admin.id,
      createdAt: now,
    },
  })

  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      action: 'status_changed',
      field: 'status',
      oldValue: 'OPEN',
      newValue: 'IN_PROGRESS',
      comment: 'Técnico comenzó a trabajar en el ticket',
      ticketId: ticket2.id,
      userId: technician2.id,
      createdAt: now,
    },
  })

  console.log('✅ Historial de tickets creado')

  // Crear preferencias de notificación
  await prisma.notification_preferences.create({
    data: {
      userId: admin.id,
      emailEnabled: true,
      teamsEnabled: false,
      inAppEnabled: true,
      ticketCreated: true,
      ticketUpdated: true,
      ticketAssigned: true,
      ticketResolved: true,
      commentAdded: true,
    },
  })

  await prisma.notification_preferences.create({
    data: {
      userId: technician1.id,
      emailEnabled: true,
      teamsEnabled: false,
      inAppEnabled: true,
      ticketCreated: false,
      ticketUpdated: true,
      ticketAssigned: true,
      ticketResolved: false,
      commentAdded: true,
    },
  })

  console.log('✅ Preferencias de notificación creadas')

  // Crear notificaciones de ejemplo
  await prisma.notifications.create({
    data: {
      id: randomUUID(),
      title: 'Nuevo ticket asignado',
      message: 'Se te ha asignado el ticket: Error en aplicación de ventas',
      type: 'INFO',
      userId: technician2.id,
      ticketId: ticket2.id,
      isRead: false,
      createdAt: now,
    },
  })

  await prisma.notifications.create({
    data: {
      id: randomUUID(),
      title: 'Ticket resuelto',
      message: 'Tu ticket "Internet lento en oficina" ha sido resuelto',
      type: 'SUCCESS',
      userId: client1.id,
      ticketId: ticket3.id,
      isRead: true,
      createdAt: now,
    },
  })

  console.log('✅ Notificaciones creadas')

  // Crear configuración del sitio
  const siteConfigs = [
    {
      id: randomUUID(),
      key: 'site_name',
      value: 'Sistema de Tickets Moderno',
      description: 'Nombre del sitio web',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'company_name',
      value: 'Mi Empresa',
      description: 'Nombre de la empresa',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'support_email',
      value: 'soporte@miempresa.com',
      description: 'Email de soporte técnico',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'max_file_size',
      value: '10485760',
      description: 'Tamaño máximo de archivo en bytes (10MB)',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'allowed_file_types',
      value: 'pdf,doc,docx,txt,png,jpg,jpeg,gif',
      description: 'Tipos de archivo permitidos',
      updatedAt: now,
    },
  ]

  for (const config of siteConfigs) {
    await prisma.site_config.upsert({
      where: { key: config.key },
      update: config,
      create: config,
    })
  }

  console.log('✅ Configuración del sitio creada')

  // Obtener categorías para artículos de conocimiento
  const categories = await prisma.categories.findMany()
  const catNetwork = categories.find(c => c.name === 'Red y Conectividad')
  const catHardware = categories.find(c => c.name === 'Hardware')
  const catSoftware = categories.find(c => c.name === 'Software')
  const catSecurity = categories.find(c => c.name === 'Seguridad')

  // Obtener tickets resueltos para asociar
  const resolvedTickets = await prisma.tickets.findMany({
    where: { status: TicketStatus.RESOLVED },
    take: 5
  })

  // Crear artículos de conocimiento basados en tickets resueltos
  const knowledgeArticles = [
    {
      id: randomUUID(),
      title: 'Cómo configurar VPN en Windows 10/11',
      summary: 'Guía paso a paso para configurar la conexión VPN corporativa en sistemas Windows',
      content: `# Configuración de VPN en Windows

## Requisitos previos
- Credenciales de VPN proporcionadas por IT
- Windows 10 o 11 actualizado
- Conexión a internet estable

## Pasos de configuración

### 1. Abrir Configuración de VPN
1. Presiona \`Windows + I\` para abrir Configuración
2. Ve a **Red e Internet**
3. Selecciona **VPN** en el menú lateral

### 2. Agregar conexión VPN
1. Click en **Agregar una conexión VPN**
2. Completa los siguientes campos:
   - **Proveedor de VPN**: Windows (integrado)
   - **Nombre de conexión**: VPN Corporativa
   - **Nombre o dirección del servidor**: vpn.empresa.com
   - **Tipo de VPN**: Automático
   - **Tipo de información de inicio de sesión**: Nombre de usuario y contraseña

### 3. Conectar
1. Click en la conexión VPN creada
2. Ingresa tus credenciales corporativas
3. Click en **Conectar**

## Solución de problemas comunes

### Error "No se puede establecer conexión"
- Verifica tu conexión a internet
- Confirma que el servidor VPN esté activo
- Revisa que tus credenciales sean correctas

### Conexión lenta
- Prueba cambiar el protocolo VPN
- Verifica tu ancho de banda
- Contacta a soporte si persiste

## Contacto
Si el problema persiste, crea un ticket de soporte.`,
      categoryId: catNetwork?.id || categories[0].id,
      tags: ['vpn', 'windows', 'conexion', 'red'],
      sourceTicketId: resolvedTickets[0]?.id,
      authorId: technician1.id,
      views: 45,
      helpfulVotes: 38,
      notHelpfulVotes: 2,
      isPublished: true,
      createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 días atrás
      updatedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
    },
    {
      id: randomUUID(),
      title: 'Solución: Impresora no imprime documentos',
      summary: 'Pasos para resolver problemas comunes de impresión en red',
      content: `# Solución de Problemas de Impresión

## Diagnóstico inicial

### 1. Verificar conexión
- La impresora está encendida
- Cable de red conectado (o WiFi activo)
- Luz de estado verde

### 2. Verificar cola de impresión
1. Abre **Panel de Control** > **Dispositivos e impresoras**
2. Click derecho en tu impresora
3. Selecciona **Ver lo que se está imprimiendo**
4. Si hay documentos atascados, elimínalos

### 3. Reiniciar servicio de impresión
\`\`\`
1. Presiona Windows + R
2. Escribe: services.msc
3. Busca "Cola de impresión"
4. Click derecho > Reiniciar
\`\`\`

### 4. Reinstalar controlador
1. Desinstala la impresora
2. Descarga el controlador más reciente del fabricante
3. Instala y configura nuevamente

## Problemas específicos

### Imprime páginas en blanco
- Verifica niveles de tinta/tóner
- Ejecuta limpieza de cabezales
- Revisa configuración de color

### Error "Impresora sin conexión"
- Verifica conexión de red
- Establece como impresora predeterminada
- Reinicia el equipo

### Impresión muy lenta
- Reduce calidad de impresión
- Verifica espacio en disco
- Actualiza controladores

## Prevención
- Mantén controladores actualizados
- Limpieza regular de impresora
- Usa papel de calidad

Si ninguna solución funciona, crea un ticket de soporte.`,
      categoryId: catHardware?.id || categories[0].id,
      tags: ['impresora', 'hardware', 'impresion', 'red'],
      sourceTicketId: resolvedTickets[1]?.id,
      authorId: technician2.id,
      views: 67,
      helpfulVotes: 52,
      notHelpfulVotes: 5,
      isPublished: true,
      createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
    {
      id: randomUUID(),
      title: 'Resetear contraseña de correo corporativo',
      summary: 'Procedimiento para restablecer tu contraseña de email',
      content: `# Reseteo de Contraseña de Correo

## Método 1: Auto-servicio (Recomendado)

### Portal de usuario
1. Ve a https://portal.empresa.com
2. Click en "¿Olvidaste tu contraseña?"
3. Ingresa tu email corporativo
4. Recibirás un código en tu email personal
5. Ingresa el código y crea nueva contraseña

## Método 2: Contactar a IT

Si no tienes acceso a tu email personal:
1. Llama a extensión 1234
2. Proporciona tu número de empleado
3. Verifica tu identidad
4. IT restablecerá tu contraseña

## Requisitos de contraseña

Tu nueva contraseña debe:
- Tener mínimo 12 caracteres
- Incluir mayúsculas y minúsculas
- Contener al menos un número
- Incluir un carácter especial (@, #, $, etc.)
- No usar contraseñas anteriores

## Configurar en dispositivos

### Outlook Desktop
1. Archivo > Configuración de cuenta
2. Selecciona tu cuenta
3. Cambiar > Actualizar contraseña
4. Reinicia Outlook

### Móvil (iOS/Android)
1. Configuración > Cuentas
2. Selecciona cuenta corporativa
3. Actualiza contraseña
4. Sincroniza

## Prevención
- Usa un gestor de contraseñas
- Activa autenticación de dos factores
- Cambia contraseña cada 90 días

¿Problemas? Crea un ticket de soporte.`,
      categoryId: catSoftware?.id || categories[0].id,
      tags: ['contraseña', 'email', 'outlook', 'acceso'],
      sourceTicketId: resolvedTickets[2]?.id,
      authorId: technician1.id,
      views: 123,
      helpfulVotes: 98,
      notHelpfulVotes: 8,
      isPublished: true,
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      id: randomUUID(),
      title: 'Acceso denegado a carpetas compartidas',
      summary: 'Cómo solicitar y configurar permisos de carpetas de red',
      content: `# Acceso a Carpetas Compartidas

## Verificar permisos actuales

### Windows
1. Click derecho en la carpeta
2. Propiedades > Seguridad
3. Revisa tu usuario en la lista

### Solicitar acceso

Si no tienes permisos:
1. Identifica la carpeta exacta (ruta completa)
2. Determina el nivel de acceso necesario:
   - **Lectura**: Solo ver archivos
   - **Escritura**: Crear y modificar
   - **Control total**: Administrar permisos

3. Crea ticket con:
   - Ruta de carpeta
   - Nivel de acceso requerido
   - Justificación de negocio
   - Aprobación de tu supervisor

## Tiempo de respuesta
- Solicitudes estándar: 24-48 horas
- Solicitudes urgentes: 4-8 horas (requiere aprobación)

## Mapear unidad de red

Una vez tengas permisos:
1. Abre Explorador de archivos
2. Click en "Este equipo"
3. Cinta > "Conectar a unidad de red"
4. Selecciona letra de unidad
5. Ingresa ruta: \`\\\\servidor\\carpeta\`
6. Marca "Reconectar al iniciar sesión"
7. Click en Finalizar

## Problemas comunes

### "No se puede acceder"
- Verifica conexión VPN
- Confirma que estás en red corporativa
- Revisa que la ruta sea correcta

### "Acceso denegado"
- Espera a que se apliquen permisos (hasta 15 min)
- Cierra sesión y vuelve a iniciar
- Verifica con IT que permisos fueron aplicados

## Buenas prácticas
- No compartas credenciales
- Solicita solo permisos necesarios
- Reporta accesos no autorizados

¿Necesitas ayuda? Crea un ticket.`,
      categoryId: catSecurity?.id || catNetwork?.id || categories[0].id,
      tags: ['permisos', 'carpetas', 'red', 'acceso'],
      authorId: technician2.id,
      views: 89,
      helpfulVotes: 71,
      notHelpfulVotes: 6,
      isPublished: true,
      createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
    },
    {
      id: randomUUID(),
      title: 'Configurar firma de correo en Outlook',
      summary: 'Crear y configurar firma corporativa en Outlook',
      content: `# Configuración de Firma de Correo

## Outlook Desktop

### Crear firma
1. Archivo > Opciones > Correo
2. Click en "Firmas..."
3. Click en "Nueva"
4. Nombra tu firma (ej: "Firma Corporativa")
5. Diseña tu firma con:
   - Nombre completo
   - Cargo
   - Departamento
   - Teléfono
   - Email
   - Logo corporativo (opcional)

### Aplicar automáticamente
1. En "Elegir firma predeterminada"
2. Selecciona tu cuenta
3. Mensajes nuevos: [Tu firma]
4. Respuestas/reenvíos: [Tu firma] o [Ninguna]
5. Click en Aceptar

## Outlook Web (OWA)

1. Click en engranaje (Configuración)
2. Ver toda la configuración
3. Correo > Redactar y responder
4. Firma de correo electrónico
5. Escribe tu firma
6. Guarda cambios

## Plantilla corporativa

Usa esta estructura:
\`\`\`
[Nombre Completo]
[Cargo] | [Departamento]
[Nombre de Empresa]

📞 [Teléfono]
📧 [Email]
🌐 [Sitio web]
\`\`\`

## Móvil

### iOS
1. Configuración > Mail
2. Firma
3. Edita firma
4. Guarda

### Android
1. Gmail > Configuración
2. Selecciona cuenta
3. Firma para móvil
4. Edita y guarda

## Consejos
- Mantén firma simple y profesional
- No uses imágenes muy grandes
- Incluye solo información relevante
- Actualiza cuando cambies de cargo

¿Problemas? Contacta a soporte.`,
      categoryId: catSoftware?.id || categories[0].id,
      tags: ['outlook', 'email', 'firma', 'configuracion'],
      authorId: technician1.id,
      views: 54,
      helpfulVotes: 45,
      notHelpfulVotes: 3,
      isPublished: true,
      createdAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    },
  ]

  for (const article of knowledgeArticles) {
    await prisma.knowledge_articles.create({ data: article })
  }

  console.log('✅ Artículos de conocimiento creados')

  console.log('🎉 Seed completado exitosamente!')
  console.log('\n📋 Usuarios creados:')
  console.log('👤 Admin: admin@tickets.com / admin123')
  console.log('🔧 Técnico 1: tecnico1@tickets.com / tech123')
  console.log('🔧 Técnico 2: tecnico2@tickets.com / tech123')
  console.log('👥 Cliente 1: cliente1@empresa.com / client123')
  console.log('👥 Cliente 2: cliente2@empresa.com / client123')
  console.log('\n📚 Artículos de conocimiento: 5 artículos creados')
}

main()
  .catch(e => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

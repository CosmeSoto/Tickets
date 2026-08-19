/**
 * Seed: Categorías TI bajo familia ADMINISTRACIÓN
 *
 * Departamentos: Tecnologías de la Información, Soporte Técnico, Seguridad Informática,
 * Usuarios y Privilegios, Telefonía.
 */

import { PrismaClient } from '@prisma/client'
import { upsertCategory, deactivateCategory } from './category-upsert'

export async function seedCategoriesTechnology(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptInfraId = deptMap.get('Tecnologías de la Información')
  const deptSoporteId = deptMap.get('Soporte Técnico')
  const deptSeguridadId = deptMap.get('Seguridad Informática')
  const deptUsuariosId = deptMap.get('Usuarios y Privilegios')
  const deptTelefoniaId = deptMap.get('Telefonía')

  if (!deptInfraId || !deptSoporteId || !deptSeguridadId || !deptUsuariosId || !deptTelefoniaId) {
    console.log('⚠️  Departamentos de Tecnología no encontrados, saltando seed de categorías TI...')
    return
  }

  // ==================== INFRAESTRUCTURA ====================
  const fallaErrorInfra = await upsertCategory(prisma, {
    name: 'Incidente de infraestructura',
    formerNames: ['Falla o Error'],
    description: 'Caídas y fallas de red, energía, impresión y servicios centrales',
    level: 1,
    parentId: null,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoInfra = await upsertCategory(prisma, {
    name: 'Solicitud de infraestructura',
    formerNames: ['Solicitud o Requerimiento'],
    description: 'Altas de red, energía y servicios de plataforma (no cuentas de usuario)',
    level: 1,
    parentId: null,
    departmentId: deptInfraId,
    order: 2,
    color: '#3B82F6',
  })

  const networking = await upsertCategory(prisma, {
    name: 'Networking',
    description: 'Redes, conectividad, comunicaciones, firewall, VPN, central telefónica',
    level: 2,
    parentId: fallaErrorInfra.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#10B981',
  })
  const energiaRegulada = await upsertCategory(prisma, {
    name: 'Energía Regulada',
    description: 'UPS, baterías, energía eléctrica, estabilizadores',
    level: 2,
    parentId: fallaErrorInfra.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#F59E0B',
  })
  const gestionOffice365 = await upsertCategory(prisma, {
    name: 'Plataforma Microsoft 365',
    formerNames: ['Gestión de Usuarios Office 365'],
    description: 'Caída o degradación de Microsoft 365 / correo como servicio central',
    level: 2,
    parentId: fallaErrorInfra.id,
    departmentId: deptInfraId,
    order: 3,
    color: '#8B5CF6',
  })
  const impresion = await upsertCategory(prisma, {
    name: 'Impresión',
    description: 'Impresoras, fotocopiadoras, problemas de impresión',
    level: 2,
    parentId: fallaErrorInfra.id,
    departmentId: deptInfraId,
    order: 4,
    color: '#EC4899',
  })

  const correoServicio = await upsertCategory(prisma, {
    name: 'Servicio de correo',
    description:
      'Exchange / Microsoft 365 como plataforma (caída del servicio, no del buzón de un usuario)',
    level: 2,
    parentId: fallaErrorInfra.id,
    departmentId: deptInfraId,
    order: 5,
    color: '#6366F1',
  })

  const solicitudRequerimientoN2Infra = await upsertCategory(prisma, {
    name: 'Red, VPN y plataforma',
    formerNames: ['Solicitud o Requerimiento'],
    description: 'Solicitudes de red, SSID, VPN de sitio y plataforma (no altas de usuario)',
    level: 2,
    parentId: solicitudRequerimientoInfra.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#3B82F6',
  })
  const energiaReguladaSolicitud = await upsertCategory(prisma, {
    name: 'Energía Regulada',
    description: 'Solicitudes de energía regulada, UPS, baterías',
    level: 2,
    parentId: solicitudRequerimientoInfra.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#F59E0B',
  })

  // N3 - Networking
  await upsertCategory(prisma, {
    name: 'Pérdida de Conexión',
    description: 'Sin conexión de red, caída de conectividad',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Sin acceso a internet',
    description: 'No hay acceso a internet, falla de conexión WAN',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Daño de Equipos Comunicaciones',
    description: 'Equipos de red dañados, switch, router',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 3,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Pérdida de Rutas Comunicación',
    description: 'Rutas de red perdidas, routing',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 4,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Pérdida de Comunicación Inalámbrica',
    description: 'WiFi caído, señal inalámbrica',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 5,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Firewall',
    description: 'Problemas con firewall, bloqueo de puertos',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 6,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Central Telefónica',
    description: 'Problemas con PBX, central telefónica',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 7,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'VPN de sitio / túnel',
    formerNames: ['VPN'],
    description: 'Túnel VPN de infraestructura caído o inestable',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 8,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Servicio de correo no disponible',
    description: 'Nadie puede enviar ni recibir; caída de Exchange / Microsoft 365',
    level: 3,
    parentId: correoServicio.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Cola de correo retenida',
    description: 'Mensajes quedan en cola del servidor o conector SMTP',
    level: 3,
    parentId: correoServicio.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Conector SMTP o relé',
    description: 'Falla del relé, conector o envío desde aplicaciones internas',
    level: 3,
    parentId: correoServicio.id,
    departmentId: deptInfraId,
    order: 3,
    color: '#EF4444',
  })

  // N3 - Solicitudes Infraestructura
  await upsertCategory(prisma, {
    name: 'Creación de SSID',
    description: 'Solicitud de nueva red WiFi, SSID',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'VPN de sitio',
    formerNames: ['VPN'],
    description: 'Alta o cambio de túnel VPN de infraestructura',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Fortinet',
    description: 'Solicitud relacionada con Fortinet, firewall Fortinet',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 3,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Reportes de red',
    formerNames: ['Reportes'],
    description: 'Solicitud de reportes de infraestructura o tráfico',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 4,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Asignación de Licencia de plataforma',
    formerNames: ['Asignación de Licencia'],
    description: 'Licencia de software o servicio de infraestructura (no buzón de usuario)',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 5,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Teams (servicio)',
    formerNames: ['Teams'],
    description: 'Incidencia o solicitud del servicio Teams a nivel de plataforma',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 6,
    color: '#3B82F6',
  })

  // N3 - Energía Regulada (Falla)
  await upsertCategory(prisma, {
    name: 'En Batería',
    description: 'UPS funcionando en batería, sin corriente',
    level: 3,
    parentId: energiaRegulada.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'No Enciende',
    description: 'Equipo de energía no enciende',
    level: 3,
    parentId: energiaRegulada.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#EF4444',
  })

  // N3 - Energía Regulada (Solicitudes)
  await upsertCategory(prisma, {
    name: 'Nuevos Equipos',
    description: 'Solicitud de nuevos equipos de energía',
    level: 3,
    parentId: energiaReguladaSolicitud.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Mantenimiento',
    description: 'Solicitud de mantenimiento de equipos',
    level: 3,
    parentId: energiaReguladaSolicitud.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Reemplazo de Partes',
    description: 'Solicitud de reemplazo de componentes',
    level: 3,
    parentId: energiaReguladaSolicitud.id,
    departmentId: deptInfraId,
    order: 3,
    color: '#3B82F6',
  })

  // N3 - Office 365 (Falla de plataforma)
  await upsertCategory(prisma, {
    name: 'Plataforma Intermitente',
    description: 'Office 365 / correo institucional intermitente para toda el área',
    level: 3,
    parentId: gestionOffice365.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })

  // N3 - Impresión (completo según hoja de cálculo)
  await upsertCategory(prisma, {
    name: 'Atasco de Papel',
    description: 'Impresora atascada, papel trabado',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Baja Calidad de Imagen',
    description: 'Impresión con baja calidad, borrosa',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 2,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Cable de Impresora Dañado',
    description: 'Cable de red o USB dañado',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 3,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Impresora Bloqueada',
    description: 'Impresora bloqueada, cola de impresión',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 4,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Impresora sin Conexión/Red',
    description: 'Impresora sin conexión de red',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 5,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'La Impresora no Digitaliza/Escanea',
    description: 'Escáner no funciona',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 6,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'La Impresora no Enciende',
    description: 'Impresora no enciende',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 7,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'La Impresora no Fotocopia',
    description: 'Función de fotocopiado no funciona',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 8,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'La Impresora no Imprime',
    description: 'Impresora no imprime',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 9,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Líneas al Escanear',
    description: 'Aparecen líneas al escanear',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 10,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Líneas al Fotocopiar',
    description: 'Aparecen líneas al fotocopiar',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 11,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Líneas al Imprimir',
    description: 'Aparecen líneas al imprimir',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 12,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'No Imprime Stickers',
    description: 'Impresora de etiquetas no imprime stickers',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 13,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Ruido al Imprimir',
    description: 'Impresora hace ruido anormal al imprimir',
    level: 3,
    parentId: impresion.id,
    departmentId: deptInfraId,
    order: 14,
    color: '#EF4444',
  })

  // ==================== SOPORTE TÉCNICO ====================
  const fallaErrorSoporte = await upsertCategory(prisma, {
    name: 'Incidente de equipo',
    formerNames: ['Falla o Error'],
    description: 'Hardware, sistema o aplicaciones de escritorio que no funcionan',
    level: 1,
    parentId: null,
    departmentId: deptSoporteId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoSoporte = await upsertCategory(prisma, {
    name: 'Solicitud de soporte',
    formerNames: ['Solicitud o Requerimiento'],
    description: 'Preparación de equipos, adquisiciones y suministros',
    level: 1,
    parentId: null,
    departmentId: deptSoporteId,
    order: 2,
    color: '#3B82F6',
  })

  const equipos = await upsertCategory(prisma, {
    name: 'Equipos',
    description: 'Computadoras, laptops, equipos de cómputo',
    level: 2,
    parentId: fallaErrorSoporte.id,
    departmentId: deptSoporteId,
    order: 1,
    color: '#10B981',
  })
  const correoCliente = await upsertCategory(prisma, {
    name: 'Correo en el equipo',
    description: 'Outlook u otro cliente de correo en el computador del usuario',
    level: 2,
    parentId: fallaErrorSoporte.id,
    departmentId: deptSoporteId,
    order: 2,
    color: '#6366F1',
  })
  const solicitudRequerimientoN2Soporte = await upsertCategory(prisma, {
    name: 'Equipamiento',
    formerNames: ['Solicitud o Requerimiento'],
    description: 'Renovación o adquisición de equipos',
    level: 2,
    parentId: solicitudRequerimientoSoporte.id,
    departmentId: deptSoporteId,
    order: 1,
    color: '#3B82F6',
  })
  const suministros = await upsertCategory(prisma, {
    name: 'Suministros',
    description: 'Solicitudes de suministros y materiales',
    level: 2,
    parentId: solicitudRequerimientoSoporte.id,
    departmentId: deptSoporteId,
    order: 2,
    color: '#F59E0B',
  })

  await upsertCategory(prisma, {
    name: 'Verificación de Partes',
    description: 'Verificación de componentes, hardware',
    level: 3,
    parentId: equipos.id,
    departmentId: deptSoporteId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Preparación Equipos',
    description: 'Preparación de equipos nuevos',
    level: 3,
    parentId: equipos.id,
    departmentId: deptSoporteId,
    order: 2,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Revisión Equipos',
    description: 'Revisión técnica de equipos',
    level: 3,
    parentId: equipos.id,
    departmentId: deptSoporteId,
    order: 3,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Instalar Software Base',
    description: 'Instalación de sistema operativo y software base',
    level: 3,
    parentId: equipos.id,
    departmentId: deptSoporteId,
    order: 4,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Reparación de Equipos',
    description: 'Reparación de hardware, componentes',
    level: 3,
    parentId: equipos.id,
    departmentId: deptSoporteId,
    order: 5,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Outlook no abre o no inicia',
    description: 'El cliente de correo no arranca o se cierra',
    level: 3,
    parentId: correoCliente.id,
    departmentId: deptSoporteId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Outlook no sincroniza',
    description: 'No baja ni envía correo desde el computador; perfil o caché dañado',
    level: 3,
    parentId: correoCliente.id,
    departmentId: deptSoporteId,
    order: 2,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Perfil de correo dañado',
    description: 'Hay que recrear el perfil de Outlook o el OST',
    level: 3,
    parentId: correoCliente.id,
    departmentId: deptSoporteId,
    order: 3,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Firma o configuración local de correo',
    description: 'Firma, cuenta adicional o datos de cuenta en el equipo',
    level: 3,
    parentId: correoCliente.id,
    departmentId: deptSoporteId,
    order: 4,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Renovación de Equipo',
    description: 'Solicitud de renovación de equipo',
    level: 3,
    parentId: solicitudRequerimientoN2Soporte.id,
    departmentId: deptSoporteId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Adquisición Equipos',
    description: 'Solicitud de compra de equipos',
    level: 3,
    parentId: solicitudRequerimientoN2Soporte.id,
    departmentId: deptSoporteId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Adquisición de Impresoras',
    description: 'Solicitud de compra de impresoras',
    level: 3,
    parentId: solicitudRequerimientoN2Soporte.id,
    departmentId: deptSoporteId,
    order: 3,
    color: '#3B82F6',
  })

  await upsertCategory(prisma, {
    name: 'Solicitud de partes o consumibles',
    formerNames: ['Verificación de Partes'],
    description: 'Toner, papel, cables u otros consumibles de soporte',
    level: 3,
    parentId: suministros.id,
    departmentId: deptSoporteId,
    order: 1,
    color: '#F59E0B',
  })

  // ==================== SEGURIDAD DE LA INFORMACIÓN ====================
  const incidentes = await upsertCategory(prisma, {
    name: 'Incidentes',
    description: 'Incidentes de seguridad de la información',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadId,
    order: 1,
    color: '#EF4444',
  })
  const requerimientosSeguridad = await upsertCategory(prisma, {
    name: 'Requerimientos',
    description: 'Requerimientos de seguridad de la información',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadId,
    order: 2,
    color: '#3B82F6',
  })

  await upsertCategory(prisma, {
    name: 'Divulgación no Autorizada de Información Confidencial',
    description: 'Fuga de información, datos confidenciales',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Capacitación en seguridad de la información',
    formerNames: ['Sensibilización y Entrenamiento a Usuarios'],
    description: 'Charla o material de concienciación (no es un incidente)',
    level: 3,
    parentId: requerimientosSeguridad.id,
    departmentId: deptSeguridadId,
    order: 6,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Sucesivos Intentos Fallidos de Login',
    description: 'Múltiples intentos de acceso fallidos',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 3,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Ataques Informáticos',
    description: 'Cyberataques, hacking, malware',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 4,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Phishing o correo sospechoso',
    description: 'Correo de suplantación, enlace o archivo malicioso',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 6,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Cuenta de correo comprometida',
    description: 'Envíos no reconocidos, reenvíos automáticos o acceso indebido al buzón',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 7,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Buzón en cuarentena o bloqueado',
    description: 'Microsoft / antivirus retuvo correo o bloqueó la cuenta',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 8,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Informes de Validación de Alta de Cuentas Usuarias',
    description: 'Validación de nuevas cuentas',
    level: 3,
    parentId: requerimientosSeguridad.id,
    departmentId: deptSeguridadId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Informes sobre Validación de Baja de Cuentas Usuarias',
    description: 'Validación de cuentas eliminadas',
    level: 3,
    parentId: requerimientosSeguridad.id,
    departmentId: deptSeguridadId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Informe sobre Validación de Modificación de Cuentas Usuarias',
    description: 'Validación de cambios en cuentas',
    level: 3,
    parentId: requerimientosSeguridad.id,
    departmentId: deptSeguridadId,
    order: 3,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Definición de Políticas de Seguridad de la Información',
    description: 'Creación de políticas de seguridad',
    level: 3,
    parentId: requerimientosSeguridad.id,
    departmentId: deptSeguridadId,
    order: 4,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Aprobación del Servicio VPN',
    description: 'Aprobación de acceso VPN',
    level: 3,
    parentId: requerimientosSeguridad.id,
    departmentId: deptSeguridadId,
    order: 5,
    color: '#3B82F6',
  })

  // ==================== USUARIOS Y PRIVILEGIOS ====================
  const fallaErrorUsuarios = await upsertCategory(prisma, {
    name: 'Incidente de acceso o correo',
    formerNames: ['Falla o Error'],
    description: 'No puede entrar a M365, VPN o su buzón',
    level: 1,
    parentId: null,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoUsuarios = await upsertCategory(prisma, {
    name: 'Solicitud de usuarios y privilegios',
    formerNames: ['Solicitud o Requerimiento'],
    description: 'Altas, bajas, grupos, buzones y accesos',
    level: 1,
    parentId: null,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#3B82F6',
  })

  const m365Fallas = await upsertCategory(prisma, {
    name: 'Microsoft 365',
    description: 'Problemas con Office 365, Microsoft 365',
    level: 2,
    parentId: fallaErrorUsuarios.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#8B5CF6',
  })
  const correoIncidentes = await upsertCategory(prisma, {
    name: 'Correo electrónico',
    description: 'Problemas del buzón (un usuario o un grupo), no la caída total del servicio',
    level: 2,
    parentId: fallaErrorUsuarios.id,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#6366F1',
  })
  const correoSolicitudes = await upsertCategory(prisma, {
    name: 'Correo electrónico',
    description: 'Altas, bajas, alias, grupos y buzones compartidos',
    level: 2,
    parentId: solicitudRequerimientoUsuarios.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#6366F1',
  })
  const m365Solicitudes = await upsertCategory(prisma, {
    name: 'Microsoft 365',
    description: 'Altas y bajas de usuario en Microsoft 365',
    level: 2,
    parentId: solicitudRequerimientoUsuarios.id,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#8B5CF6',
  })
  const vpnUsuarios = await upsertCategory(prisma, {
    name: 'VPN',
    description: 'Solicitudes de VPN, acceso remoto',
    level: 2,
    parentId: solicitudRequerimientoUsuarios.id,
    departmentId: deptUsuariosId,
    order: 3,
    color: '#10B981',
  })

  await upsertCategory(prisma, {
    name: 'Error al Iniciar Sesión en M365',
    description: 'No puede iniciar sesión en Microsoft 365',
    level: 3,
    parentId: m365Fallas.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Servicio no Disponible en M365',
    description:
      'Un usuario no entra a M365; si nadie entra, usar Incidente de infraestructura → Servicio de correo',
    level: 3,
    parentId: m365Fallas.id,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'No recibe correos',
    description: 'El buzón no entra correo (un usuario o un grupo)',
    level: 3,
    parentId: correoIncidentes.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'No puede enviar correos',
    description: 'El envío falla, rebota o queda en bandeja de salida',
    level: 3,
    parentId: correoIncidentes.id,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Buzón lleno',
    description: 'Cuota de buzón agotada',
    level: 3,
    parentId: correoIncidentes.id,
    departmentId: deptUsuariosId,
    order: 3,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Correo en spam o cuarentena',
    description: 'Mensajes legítimos caen en spam o política de retención',
    level: 3,
    parentId: correoIncidentes.id,
    departmentId: deptUsuariosId,
    order: 4,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Correo rebotado',
    description: 'NDR / destinatario inexistente o bloqueado',
    level: 3,
    parentId: correoIncidentes.id,
    departmentId: deptUsuariosId,
    order: 5,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Cambio de Contraseña Correo',
    description: 'Solicitud de cambio de contraseña de correo',
    level: 3,
    parentId: m365Solicitudes.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Creación de Usuario M365',
    description: 'Solicitud de nuevo usuario en M365',
    level: 3,
    parentId: m365Solicitudes.id,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Desactivación de Usuarios en M365',
    description: 'Solicitud de desactivar usuario M365',
    level: 3,
    parentId: m365Solicitudes.id,
    departmentId: deptUsuariosId,
    order: 3,
    color: '#3B82F6',
  })

  await upsertCategory(prisma, {
    name: 'Crear cuenta de correo',
    description: 'Alta de buzón o cuenta de correo institucional',
    level: 3,
    parentId: correoSolicitudes.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Baja de cuenta de correo',
    description: 'Desactivar o eliminar buzón',
    level: 3,
    parentId: correoSolicitudes.id,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Alias o redirección de correo',
    description: 'Alias, reenvío o regla de bandeja',
    level: 3,
    parentId: correoSolicitudes.id,
    departmentId: deptUsuariosId,
    order: 3,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Lista de distribución o grupo',
    description: 'Alta, baja o miembros de un grupo de correo',
    level: 3,
    parentId: correoSolicitudes.id,
    departmentId: deptUsuariosId,
    order: 4,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Buzón compartido',
    description: 'Permisos sobre buzón de área o gerencia',
    level: 3,
    parentId: correoSolicitudes.id,
    departmentId: deptUsuariosId,
    order: 5,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Aumento de cuota de buzón',
    description: 'Ampliar espacio del correo',
    level: 3,
    parentId: correoSolicitudes.id,
    departmentId: deptUsuariosId,
    order: 6,
    color: '#3B82F6',
  })

  await upsertCategory(prisma, {
    name: 'Creación de Usuario VPN',
    description: 'Solicitud de nuevo usuario VPN',
    level: 3,
    parentId: vpnUsuarios.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Baja de Usuario VPN',
    description: 'Solicitud de eliminar usuario VPN',
    level: 3,
    parentId: vpnUsuarios.id,
    departmentId: deptUsuariosId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Modificación Perfil y Privilegios Acceso VPN',
    description: 'Cambio de permisos VPN',
    level: 3,
    parentId: vpnUsuarios.id,
    departmentId: deptUsuariosId,
    order: 3,
    color: '#3B82F6',
  })

  // ==================== TELEFONÍA ====================
  const fallaErrorTelefonia = await upsertCategory(prisma, {
    name: 'Incidente de telefonía',
    formerNames: ['Falla o Error'],
    description: 'Extensiones, llamadas y central telefónica',
    level: 1,
    parentId: null,
    departmentId: deptTelefoniaId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoTelefonia = await upsertCategory(prisma, {
    name: 'Solicitud de telefonía',
    formerNames: ['Solicitud o Requerimiento'],
    description: 'Altas, cambios y desvíos de extensión',
    level: 1,
    parentId: null,
    departmentId: deptTelefoniaId,
    order: 2,
    color: '#3B82F6',
  })

  await upsertCategory(prisma, {
    name: 'Daño de Bocina',
    description: 'Bocina del teléfono dañada',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 1,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Daño de Extensión',
    description: 'Extensión telefónica dañada',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 2,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Extensión no funciona',
    formerNames: ['No Funciona la Extensión'],
    description: 'La extensión no da tono, no marca o está fuera de servicio',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 3,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Problemas con Llamadas Entrantes y Salientes',
    description: 'Problemas con llamadas',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 4,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Teléfono sin Red',
    description: 'Teléfono IP sin conexión de red',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 5,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Central telefónica / PBX',
    description: 'Falla de la central, no de una extensión aislada',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 6,
    color: '#EF4444',
  })
  await upsertCategory(prisma, {
    name: 'Buzón de voz o desvío',
    description: 'Buzón de voz, IVR o desvío de llamadas no funciona',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 7,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Cambio de Extensión',
    description: 'Solicitud de cambio de extensión',
    level: 2,
    parentId: solicitudRequerimientoTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 1,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Solicitud de Extensión',
    description: 'Solicitud de nueva extensión',
    level: 2,
    parentId: solicitudRequerimientoTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 2,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Desvío o buzón de voz',
    description: 'Configurar desvío, IVR o buzón de voz',
    level: 2,
    parentId: solicitudRequerimientoTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 3,
    color: '#3B82F6',
  })

  await deactivateCategory(prisma, {
    name: 'Central Telefónica',
    departmentId: deptInfraId,
    level: 3,
    parentId: networking.id,
  })
  await deactivateCategory(prisma, {
    name: 'Creación de Cuenta',
    departmentId: deptInfraId,
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
  })
  await deactivateCategory(prisma, {
    name: 'Reseteo Contraseña',
    departmentId: deptInfraId,
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
  })
  await deactivateCategory(prisma, {
    name: 'Sensibilización y Entrenamiento a Usuarios',
    departmentId: deptSeguridadId,
    level: 3,
    parentId: incidentes.id,
  })

  console.log(
    '✅ Categorías TI (Administración): infraestructura, soporte, seguridad, usuarios/correo y telefonía'
  )
}

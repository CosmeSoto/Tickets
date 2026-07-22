/**
 * Seed: Categorías TI bajo familia ADMINISTRACIÓN
 *
 * Departamentos: Tecnologías de la Información, Soporte Técnico, Seguridad Informática,
 * Usuarios y Privilegios, Telefonía.
 */

import { PrismaClient } from '@prisma/client'
import { upsertCategory } from './category-upsert'

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
    name: 'Falla o Error',
    description: 'Incidentes y fallas en infraestructura',
    level: 1,
    parentId: null,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoInfra = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes y requerimientos de infraestructura',
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
    name: 'Gestión de Usuarios Office 365',
    description: 'Plataforma Microsoft 365, Teams, licencias, cuentas',
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

  const solicitudRequerimientoN2Infra = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes generales de infraestructura',
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
    name: 'VPN',
    description: 'Problemas con VPN, túnel VPN caído',
    level: 3,
    parentId: networking.id,
    departmentId: deptInfraId,
    order: 8,
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
    name: 'VPN',
    description: 'Solicitud de acceso VPN, configuración VPN',
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
    name: 'Reportes',
    description: 'Solicitud de reportes de infraestructura',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 4,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Creación de Cuenta',
    description: 'Solicitud de creación de cuenta de usuario',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 5,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Reseteo Contraseña',
    description: 'Solicitud de reseteo de contraseña',
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

  // N3 - Office 365 (Falla)
  await upsertCategory(prisma, {
    name: 'Plataforma Intermitente',
    description: 'Office 365 intermitente, inestable',
    level: 3,
    parentId: gestionOffice365.id,
    departmentId: deptInfraId,
    order: 1,
    color: '#EF4444',
  })

  // N3 - Solicitud N2 — adicionales faltantes
  await upsertCategory(prisma, {
    name: 'Asignación de Licencia',
    description: 'Solicitud de asignación de licencia de software',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 7,
    color: '#3B82F6',
  })
  await upsertCategory(prisma, {
    name: 'Teams',
    description: 'Solicitud relacionada con Microsoft Teams',
    level: 3,
    parentId: solicitudRequerimientoN2Infra.id,
    departmentId: deptInfraId,
    order: 8,
    color: '#3B82F6',
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
    name: 'Falla o Error',
    description: 'Incidentes y fallas en soporte técnico',
    level: 1,
    parentId: null,
    departmentId: deptSoporteId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoSoporte = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes y requerimientos de soporte técnico',
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
  const solicitudRequerimientoN2Soporte = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes generales de soporte',
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
    name: 'Verificación de Partes',
    description: 'Verificación de partes y suministros',
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
    name: 'Sensibilización y Entrenamiento a Usuarios',
    description: 'Capacitación en seguridad',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 2,
    color: '#EF4444',
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
    name: 'Accesos o Intentos no Autorizados',
    description: 'Acceso no autorizado a sistemas',
    level: 3,
    parentId: incidentes.id,
    departmentId: deptSeguridadId,
    order: 5,
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
    name: 'Falla o Error',
    description: 'Problemas con usuarios y privilegios',
    level: 1,
    parentId: null,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoUsuarios = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes de usuarios y privilegios',
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
  const m365Solicitudes = await upsertCategory(prisma, {
    name: 'Microsoft 365',
    description: 'Solicitudes relacionadas con M365',
    level: 2,
    parentId: solicitudRequerimientoUsuarios.id,
    departmentId: deptUsuariosId,
    order: 1,
    color: '#8B5CF6',
  })
  const vpnUsuarios = await upsertCategory(prisma, {
    name: 'VPN',
    description: 'Solicitudes de VPN, acceso remoto',
    level: 2,
    parentId: solicitudRequerimientoUsuarios.id,
    departmentId: deptUsuariosId,
    order: 2,
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
    description: 'Servicio M365 caído, no disponible',
    level: 3,
    parentId: m365Fallas.id,
    departmentId: deptUsuariosId,
    order: 2,
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
    name: 'Falla o Error',
    description: 'Problemas con telefonía',
    level: 1,
    parentId: null,
    departmentId: deptTelefoniaId,
    order: 1,
    color: '#EF4444',
  })
  const solicitudRequerimientoTelefonia = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes de telefonía',
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
    name: 'No Funciona la Extensión',
    description: 'Extensión no funciona',
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
    description: 'Teléfono sin conexión de red',
    level: 2,
    parentId: fallaErrorTelefonia.id,
    departmentId: deptTelefoniaId,
    order: 5,
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

  console.log('✅ Categorías (5 departamentos con jerarquía N1 → N2 → N3)')
}

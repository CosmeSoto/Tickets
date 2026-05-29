/**
 * Seed: Categories (Categorías de Tickets)
 *
 * Crea la jerarquía completa de categorías para los diferentes departamentos.
 * Extraído del seed principal para mejor mantenibilidad.
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const now = new Date()

async function upsertCategory(
  prisma: PrismaClient,
  data: {
    name: string
    description: string
    level: number
    parentId: string | null
    departmentId: string
    order: number
    color: string
  }
) {
  const existing = await prisma.categories.findFirst({
    where: { name: data.name, level: data.level, parentId: data.parentId },
  })
  if (existing) {
    return prisma.categories.update({
      where: { id: existing.id },
      data: {
        description: data.description,
        departmentId: data.departmentId,
        order: data.order,
        color: data.color,
        updatedAt: now,
      },
    })
  }
  return prisma.categories.create({
    data: { id: randomUUID(), ...data, isActive: true, createdAt: now, updatedAt: now },
  })
}

export async function seedCategories(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptInfraId = deptMap.get('Tecnologías de la Información')!
  const deptSoporteId = deptMap.get('Soporte Técnico')!
  const deptSeguridadId = deptMap.get('Seguridad Informática')!
  const deptUsuariosId = deptMap.get('Usuarios y Privilegios')!
  const deptTelefoniaId = deptMap.get('Telefonía')!

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

// ============================================
// 13. UNIDADES DE MEDIDA
// ============================================

// ============================================
// CATEGORÍAS OTRAS FAMILIAS
// ============================================

export async function seedCategoriesOtherFamilies(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  // Solo crear si el departamento existe en el mapa
  const get = (name: string) => deptMap.get(name)

  // ── MANTENIMIENTO CIVIL ──────────────────────────────────────────────────
  const deptCivil = get('Mantenimiento Civil')
  if (deptCivil) {
    const fallasCivil = await upsertCategory(prisma, {
      name: 'Falla o Daño',
      description: 'Daños en infraestructura civil',
      level: 1,
      parentId: null,
      departmentId: deptCivil,
      order: 1,
      color: '#EF4444',
    })
    const solicCivil = await upsertCategory(prisma, {
      name: 'Solicitud de Trabajo',
      description: 'Solicitudes de trabajos civiles',
      level: 1,
      parentId: null,
      departmentId: deptCivil,
      order: 2,
      color: '#3B82F6',
    })
    await upsertCategory(prisma, {
      name: 'Filtraciones / Goteras',
      description: 'Filtraciones de agua, goteras en techo',
      level: 2,
      parentId: fallasCivil.id,
      departmentId: deptCivil,
      order: 1,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Daño en Paredes / Pisos',
      description: 'Grietas, fisuras, daños en superficies',
      level: 2,
      parentId: fallasCivil.id,
      departmentId: deptCivil,
      order: 2,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Puertas / Ventanas',
      description: 'Daños en puertas, ventanas, cerraduras',
      level: 2,
      parentId: fallasCivil.id,
      departmentId: deptCivil,
      order: 3,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Plomería / Sanitarios',
      description: 'Problemas de plomería, sanitarios, tuberías',
      level: 2,
      parentId: fallasCivil.id,
      departmentId: deptCivil,
      order: 4,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Remodelación / Adecuación',
      description: 'Trabajos de remodelación o adecuación de espacios',
      level: 2,
      parentId: solicCivil.id,
      departmentId: deptCivil,
      order: 1,
      color: '#3B82F6',
    })
    await upsertCategory(prisma, {
      name: 'Pintura',
      description: 'Trabajos de pintura interior o exterior',
      level: 2,
      parentId: solicCivil.id,
      departmentId: deptCivil,
      order: 2,
      color: '#3B82F6',
    })
    await upsertCategory(prisma, {
      name: 'Instalación de Mobiliario',
      description: 'Instalación de muebles, estantes, divisiones',
      level: 2,
      parentId: solicCivil.id,
      departmentId: deptCivil,
      order: 3,
      color: '#3B82F6',
    })
  }

  // ── MANTENIMIENTO ELÉCTRICO ──────────────────────────────────────────────
  const deptElec = get('Mantenimiento Eléctrico')
  if (deptElec) {
    const fallasElec = await upsertCategory(prisma, {
      name: 'Falla Eléctrica',
      description: 'Fallas en instalaciones eléctricas',
      level: 1,
      parentId: null,
      departmentId: deptElec,
      order: 1,
      color: '#EF4444',
    })
    const solicElec = await upsertCategory(prisma, {
      name: 'Solicitud Eléctrica',
      description: 'Solicitudes de trabajos eléctricos',
      level: 1,
      parentId: null,
      departmentId: deptElec,
      order: 2,
      color: '#3B82F6',
    })
    await upsertCategory(prisma, {
      name: 'Sin Energía / Corte',
      description: 'Corte de energía, sin suministro eléctrico',
      level: 2,
      parentId: fallasElec.id,
      departmentId: deptElec,
      order: 1,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Cortocircuito / Sobrecarga',
      description: 'Cortocircuito, sobrecarga eléctrica',
      level: 2,
      parentId: fallasElec.id,
      departmentId: deptElec,
      order: 2,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Luminaria Dañada',
      description: 'Lámparas, focos, luminarias dañadas',
      level: 2,
      parentId: fallasElec.id,
      departmentId: deptElec,
      order: 3,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Tomacorriente / Interruptor',
      description: 'Tomacorrientes o interruptores dañados',
      level: 2,
      parentId: fallasElec.id,
      departmentId: deptElec,
      order: 4,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Instalación Eléctrica Nueva',
      description: 'Solicitud de nueva instalación eléctrica',
      level: 2,
      parentId: solicElec.id,
      departmentId: deptElec,
      order: 1,
      color: '#3B82F6',
    })
    await upsertCategory(prisma, {
      name: 'Cambio de Luminaria',
      description: 'Solicitud de cambio o mejora de luminarias',
      level: 2,
      parentId: solicElec.id,
      departmentId: deptElec,
      order: 2,
      color: '#3B82F6',
    })
  }

  // ── SEGURIDAD FÍSICA ─────────────────────────────────────────────────────
  const deptSeg = get('Seguridad Física')
  if (deptSeg) {
    const incSeg = await upsertCategory(prisma, {
      name: 'Incidente de Seguridad',
      description: 'Incidentes de seguridad física',
      level: 1,
      parentId: null,
      departmentId: deptSeg,
      order: 1,
      color: '#EF4444',
    })
    const solicSeg = await upsertCategory(prisma, {
      name: 'Solicitud de Seguridad',
      description: 'Solicitudes al área de seguridad',
      level: 1,
      parentId: null,
      departmentId: deptSeg,
      order: 2,
      color: '#3B82F6',
    })
    await upsertCategory(prisma, {
      name: 'Acceso No Autorizado',
      description: 'Persona no autorizada en área restringida',
      level: 2,
      parentId: incSeg.id,
      departmentId: deptSeg,
      order: 1,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Robo / Hurto',
      description: 'Robo o hurto de bienes',
      level: 2,
      parentId: incSeg.id,
      departmentId: deptSeg,
      order: 2,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Vandalismo',
      description: 'Daños intencionales a la propiedad',
      level: 2,
      parentId: incSeg.id,
      departmentId: deptSeg,
      order: 3,
      color: '#EF4444',
    })
    await upsertCategory(prisma, {
      name: 'Acceso a Área Restringida',
      description: 'Solicitud de acceso a área restringida',
      level: 2,
      parentId: solicSeg.id,
      departmentId: deptSeg,
      order: 1,
      color: '#3B82F6',
    })
    await upsertCategory(prisma, {
      name: 'Credencial / Carnet',
      description: 'Solicitud de credencial o carnet de acceso',
      level: 2,
      parentId: solicSeg.id,
      departmentId: deptSeg,
      order: 2,
      color: '#3B82F6',
    })
  }

  // ── LIMPIEZA ─────────────────────────────────────────────────────────────
  const deptLimp = get('Limpieza')
  if (deptLimp) {
    const solicLimp = await upsertCategory(prisma, {
      name: 'Solicitud de Limpieza',
      description: 'Solicitudes al servicio de limpieza',
      level: 1,
      parentId: null,
      departmentId: deptLimp,
      order: 1,
      color: '#06B6D4',
    })
    await upsertCategory(prisma, {
      name: 'Limpieza de Área',
      description: 'Solicitud de limpieza de un área específica',
      level: 2,
      parentId: solicLimp.id,
      departmentId: deptLimp,
      order: 1,
      color: '#06B6D4',
    })
    await upsertCategory(prisma, {
      name: 'Limpieza Profunda',
      description: 'Solicitud de limpieza profunda o desinfección',
      level: 2,
      parentId: solicLimp.id,
      departmentId: deptLimp,
      order: 2,
      color: '#06B6D4',
    })
    await upsertCategory(prisma, {
      name: 'Derrame / Emergencia',
      description: 'Limpieza urgente por derrame u emergencia',
      level: 2,
      parentId: solicLimp.id,
      departmentId: deptLimp,
      order: 3,
      color: '#EF4444',
    })
  }

  // ── GESTIÓN ADMINISTRATIVA ───────────────────────────────────────────────
  const deptAdmin = get('Administración')
  if (deptAdmin) {
    const solicAdmin = await upsertCategory(prisma, {
      name: 'Solicitud Administrativa',
      description: 'Solicitudes al área administrativa',
      level: 1,
      parentId: null,
      departmentId: deptAdmin,
      order: 1,
      color: '#6B7280',
    })
    await upsertCategory(prisma, {
      name: 'Documentos / Certificados',
      description: 'Solicitud de documentos o certificados',
      level: 2,
      parentId: solicAdmin.id,
      departmentId: deptAdmin,
      order: 1,
      color: '#6B7280',
    })
    await upsertCategory(prisma, {
      name: 'Permisos / Autorizaciones',
      description: 'Solicitud de permisos o autorizaciones',
      level: 2,
      parentId: solicAdmin.id,
      departmentId: deptAdmin,
      order: 2,
      color: '#6B7280',
    })
    await upsertCategory(prisma, {
      name: 'Facturación / Pagos',
      description: 'Consultas o solicitudes de facturación',
      level: 2,
      parentId: solicAdmin.id,
      departmentId: deptAdmin,
      order: 3,
      color: '#6B7280',
    })
  }

  console.log('✅ Categorías otras familias (Mantenimiento, Seguridad, Servicios, Administrativa)')
}

// ============================================

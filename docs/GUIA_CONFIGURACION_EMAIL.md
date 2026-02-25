# Guía de Configuración del Sistema de Email

## 📋 Índice
1. [Resumen del Sistema](#resumen-del-sistema)
2. [Configuración SMTP](#configuración-smtp)
3. [Probar el Sistema](#probar-el-sistema)
4. [Configurar Cron Job](#configurar-cron-job)
5. [Templates Disponibles](#templates-disponibles)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Resumen del Sistema

El sistema de email está **completamente implementado** y listo para usar. Solo requiere configuración SMTP.

### Características Implementadas ✅
- ✅ Servicio de email con nodemailer
- ✅ Cola de emails con reintentos automáticos (3 intentos)
- ✅ Templates profesionales HTML + texto plano
- ✅ Pool de conexiones para mejor performance
- ✅ Registro en auditoría de emails enviados
- ✅ Limpieza automática de emails antiguos
- ✅ Test de conexión SMTP

### Archivos del Sistema
```
src/lib/services/email/
├── email-service.ts              # Servicio principal
└── templates/
    ├── ticket-created.ts         # Confirmación al cliente
    ├── ticket-assigned.ts        # Notificación al técnico
    └── ticket-resolved.ts        # Cierre de ticket
```

---

## 🔧 Configuración SMTP

### Opción 1: Variables de Entorno (Recomendado para Producción)

Edita el archivo `.env` en la raíz del proyecto:

```env
# Configuración SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-app
EMAIL_FROM=Sistema de Tickets <noreply@tu-dominio.com>
```

### Opción 2: Base de Datos (Recomendado para Desarrollo)

Configura desde **Admin > Configuración** en la interfaz web:

1. Ir a `/admin/settings`
2. Buscar sección "Configuración de Email"
3. Completar los campos:
   - `smtp_host`: Servidor SMTP
   - `smtp_port`: Puerto (587 para TLS, 465 para SSL)
   - `smtp_user`: Usuario/Email
   - `smtp_password`: Contraseña
   - `smtp_secure`: true/false (true para puerto 465)
   - `email_from`: Email remitente

---

## 📧 Proveedores SMTP Populares

### Gmail (Desarrollo/Testing)

**Configuración:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-contraseña-app
EMAIL_FROM=Sistema de Tickets <tu-email@gmail.com>
```

**Pasos importantes:**
1. Habilitar "Verificación en 2 pasos" en tu cuenta de Google
2. Generar una "Contraseña de aplicación":
   - Ir a https://myaccount.google.com/security
   - Buscar "Contraseñas de aplicaciones"
   - Crear nueva contraseña para "Correo"
   - Usar esa contraseña en `SMTP_PASS`

**Límites:**
- 500 emails/día (cuenta gratuita)
- 2,000 emails/día (Google Workspace)

---

### SendGrid (Producción Recomendado)

**Configuración:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=tu-api-key-de-sendgrid
EMAIL_FROM=Sistema de Tickets <noreply@tu-dominio.com>
```

**Pasos:**
1. Crear cuenta en https://sendgrid.com
2. Verificar dominio (importante para deliverability)
3. Crear API Key en Settings > API Keys
4. Usar "apikey" como usuario y el API Key como contraseña

**Ventajas:**
- ✅ 100 emails/día gratis
- ✅ Excelente deliverability
- ✅ Analytics y tracking
- ✅ Templates avanzados
- ✅ Soporte profesional

**Límites:**
- 100 emails/día (plan gratuito)
- 40,000+ emails/mes (planes pagos desde $15/mes)

---

### AWS SES (Producción Escalable)

**Configuración:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-access-key-id
SMTP_PASS=tu-secret-access-key
EMAIL_FROM=Sistema de Tickets <noreply@tu-dominio.com>
```

**Pasos:**
1. Crear cuenta AWS
2. Ir a Amazon SES
3. Verificar dominio o email
4. Crear credenciales SMTP en "SMTP Settings"
5. Solicitar salir del "Sandbox" (para producción)

**Ventajas:**
- ✅ Muy económico ($0.10 por 1,000 emails)
- ✅ Altamente escalable
- ✅ Integración con AWS
- ✅ Excelente para alto volumen

**Límites:**
- Sandbox: 200 emails/día, solo emails verificados
- Producción: Sin límite (previa aprobación)

---

### Mailgun (Alternativa Profesional)

**Configuración:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@tu-dominio.mailgun.org
SMTP_PASS=tu-contraseña-mailgun
EMAIL_FROM=Sistema de Tickets <noreply@tu-dominio.com>
```

**Ventajas:**
- ✅ 5,000 emails/mes gratis (primeros 3 meses)
- ✅ API potente
- ✅ Validación de emails
- ✅ Logs detallados

---

### Outlook/Office 365

**Configuración:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@tu-empresa.com
SMTP_PASS=tu-contraseña
EMAIL_FROM=Sistema de Tickets <tu-email@tu-empresa.com>
```

**Límites:**
- 10,000 emails/día (Office 365)

---

## 🧪 Probar el Sistema

### 1. Probar Conexión SMTP

**Desde la interfaz web:**
1. Ir a `/admin/settings`
2. Configurar SMTP
3. Click en "Probar Conexión"
4. Verificar mensaje de éxito

**Desde API:**
```bash
curl -X POST http://localhost:3000/api/admin/settings/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "tu-email@ejemplo.com"
  }'
```

**Respuesta esperada:**
```json
{
  "success": true,
  "message": "Email de prueba enviado correctamente"
}
```

### 2. Enviar Email de Prueba

**Código de ejemplo:**
```typescript
import { EmailService } from '@/lib/services/email/email-service'

// Enviar email inmediato
await EmailService.sendEmail({
  to: 'destinatario@ejemplo.com',
  subject: 'Prueba del Sistema',
  html: '<h1>Hola</h1><p>Este es un email de prueba</p>',
  text: 'Hola\n\nEste es un email de prueba'
})

// Enviar con template
await EmailService.sendEmail({
  to: 'destinatario@ejemplo.com',
  subject: 'Ticket Creado',
  template: 'ticket-created',
  templateData: {
    ticketId: '123',
    ticketTitle: 'Problema con login',
    ticketNumber: 'TKT-001',
    clientName: 'Juan Pérez',
    category: 'Soporte Técnico',
    priority: 'HIGH',
    description: 'No puedo iniciar sesión',
    ticketUrl: 'https://tu-dominio.com/tickets/123'
  }
})

// Agregar a cola (envío diferido)
await EmailService.queueEmail({
  to: 'destinatario@ejemplo.com',
  subject: 'Notificación Programada',
  template: 'ticket-assigned',
  templateData: { /* ... */ },
  scheduledAt: new Date(Date.now() + 3600000) // En 1 hora
})
```

### 3. Verificar Cola de Emails

**Ver emails pendientes:**
```sql
-- Conectar a la base de datos
SELECT * FROM email_queue 
WHERE status = 'pending' 
ORDER BY scheduledAt ASC;
```

**Ver emails fallidos:**
```sql
SELECT * FROM email_queue 
WHERE status = 'failed' 
ORDER BY createdAt DESC;
```

---

## ⏰ Configurar Cron Job

El sistema usa una cola de emails que debe procesarse periódicamente.

### Opción 1: Cron Job del Sistema (Linux/Mac)

**Editar crontab:**
```bash
crontab -e
```

**Agregar línea (procesar cada 5 minutos):**
```bash
*/5 * * * * curl -X GET https://tu-dominio.com/api/cron/process-email-queue
```

**Alternativa con autenticación:**
```bash
*/5 * * * * curl -X GET https://tu-dominio.com/api/cron/process-email-queue \
  -H "Authorization: Bearer tu-token-secreto"
```

### Opción 2: Vercel Cron Jobs

**Crear archivo `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/process-email-queue",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Opción 3: GitHub Actions

**Crear `.github/workflows/email-queue.yml`:**
```yaml
name: Process Email Queue

on:
  schedule:
    - cron: '*/5 * * * *'  # Cada 5 minutos
  workflow_dispatch:  # Permitir ejecución manual

jobs:
  process-queue:
    runs-on: ubuntu-latest
    steps:
      - name: Process Email Queue
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/cron/process-email-queue \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### Opción 4: Node.js Scheduler (Desarrollo)

**Crear `scripts/email-queue-processor.js`:**
```javascript
const cron = require('node-cron')

// Ejecutar cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] Processing email queue...')
  
  try {
    const response = await fetch('http://localhost:3000/api/cron/process-email-queue')
    const data = await response.json()
    console.log('[CRON] Result:', data)
  } catch (error) {
    console.error('[CRON] Error:', error)
  }
})

console.log('[CRON] Email queue processor started')
```

**Ejecutar:**
```bash
node scripts/email-queue-processor.js
```

### Verificar Cron Job

**Endpoint de procesamiento:**
```
GET /api/cron/process-email-queue
```

**Respuesta esperada:**
```json
{
  "success": true,
  "sent": 5,
  "failed": 0,
  "message": "Procesados 5 emails exitosamente"
}
```

---

## 📧 Templates Disponibles

### 1. ticket-created
**Cuándo se envía:** Cuando un cliente crea un nuevo ticket

**Datos requeridos:**
```typescript
{
  ticketId: string
  ticketTitle: string
  ticketNumber: string
  clientName: string
  category: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  description: string
  ticketUrl: string
}
```

**Uso:**
```typescript
await EmailService.sendEmail({
  to: cliente.email,
  subject: `Ticket #${ticket.number} Creado`,
  template: 'ticket-created',
  templateData: {
    ticketId: ticket.id,
    ticketTitle: ticket.title,
    ticketNumber: ticket.number,
    clientName: cliente.name,
    category: ticket.category.name,
    priority: ticket.priority,
    description: ticket.description,
    ticketUrl: `${process.env.NEXT_PUBLIC_APP_URL}/tickets/${ticket.id}`
  }
})
```

### 2. ticket-assigned
**Cuándo se envía:** Cuando se asigna un ticket a un técnico

**Datos requeridos:**
```typescript
{
  ticketId: string
  ticketTitle: string
  ticketNumber: string
  technicianName: string
  clientName: string
  category: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  description: string
  ticketUrl: string
}
```

**Uso:**
```typescript
await EmailService.sendEmail({
  to: tecnico.email,
  subject: `Nuevo Ticket Asignado: #${ticket.number}`,
  template: 'ticket-assigned',
  templateData: {
    ticketId: ticket.id,
    ticketTitle: ticket.title,
    ticketNumber: ticket.number,
    technicianName: tecnico.name,
    clientName: cliente.name,
    category: ticket.category.name,
    priority: ticket.priority,
    description: ticket.description,
    ticketUrl: `${process.env.NEXT_PUBLIC_APP_URL}/technician/tickets/${ticket.id}`
  }
})
```

### 3. ticket-resolved
**Cuándo se envía:** Cuando se resuelve un ticket

**Datos requeridos:**
```typescript
{
  ticketId: string
  ticketTitle: string
  ticketNumber: string
  clientName: string
  technicianName: string
  resolution: string
  ticketUrl: string
}
```

---

## 🔍 Troubleshooting

### Error: "Configuración SMTP no encontrada"

**Causa:** No hay configuración SMTP en la base de datos ni en variables de entorno

**Solución:**
1. Verificar archivo `.env` tiene las variables SMTP
2. O configurar desde Admin > Configuración
3. Reiniciar el servidor después de cambiar `.env`

### Error: "Invalid login: 535 Authentication failed"

**Causa:** Credenciales incorrectas o autenticación bloqueada

**Solución Gmail:**
1. Verificar que usas "Contraseña de aplicación", no tu contraseña normal
2. Habilitar "Verificación en 2 pasos"
3. Generar nueva contraseña de aplicación

**Solución SendGrid:**
1. Verificar que usas "apikey" como usuario
2. Verificar que el API Key es correcto
3. Verificar que el API Key tiene permisos de envío

### Error: "Connection timeout"

**Causa:** Puerto bloqueado o firewall

**Solución:**
1. Verificar que el puerto 587 está abierto
2. Probar con puerto 465 (SSL) cambiando `SMTP_SECURE=true`
3. Verificar firewall del servidor
4. Verificar que el proveedor SMTP permite conexiones desde tu IP

### Emails no se envían (quedan en "pending")

**Causa:** Cron job no está configurado

**Solución:**
1. Configurar cron job (ver sección anterior)
2. O procesar manualmente: `curl http://localhost:3000/api/cron/process-email-queue`
3. Verificar logs del servidor

### Emails van a spam

**Causa:** Falta configuración de dominio (SPF, DKIM, DMARC)

**Solución:**
1. Verificar dominio en el proveedor SMTP
2. Configurar registros DNS:
   - SPF: `v=spf1 include:_spf.sendgrid.net ~all`
   - DKIM: Proporcionado por el proveedor
   - DMARC: `v=DMARC1; p=none; rua=mailto:admin@tu-dominio.com`
3. Usar email "from" del dominio verificado
4. Evitar palabras spam en asunto/contenido

### Ver logs de emails

**Logs del servidor:**
```bash
# Ver logs en tiempo real
tail -f logs/app.log | grep EMAIL-SERVICE

# Buscar errores
grep "EMAIL-SERVICE.*Error" logs/app.log
```

**Logs en base de datos:**
```sql
-- Ver últimos emails enviados
SELECT * FROM audit_logs 
WHERE action = 'EMAIL_SENT' 
ORDER BY "createdAt" DESC 
LIMIT 20;

-- Ver emails fallidos
SELECT * FROM email_queue 
WHERE status = 'failed' 
ORDER BY "createdAt" DESC;
```

---

## 📊 Monitoreo y Mantenimiento

### Limpieza Automática

El sistema limpia automáticamente emails antiguos:

```typescript
// Limpiar emails de más de 30 días
await EmailService.cleanupOldEmails(30)
```

**Configurar limpieza automática (cron):**
```bash
# Limpiar cada día a las 2 AM
0 2 * * * curl http://localhost:3000/api/cron/cleanup-old-emails
```

### Métricas Importantes

**Monitorear:**
- Tasa de envío exitoso (> 95%)
- Tiempo promedio de envío (< 5 segundos)
- Emails en cola (< 100)
- Emails fallidos (< 5%)

**Query de métricas:**
```sql
-- Estadísticas de emails (últimos 7 días)
SELECT 
  status,
  COUNT(*) as total,
  AVG(attempts) as avg_attempts
FROM email_queue
WHERE "createdAt" > NOW() - INTERVAL '7 days'
GROUP BY status;
```

---

## 🎯 Checklist de Configuración

### Configuración Inicial
- [ ] Elegir proveedor SMTP (Gmail, SendGrid, AWS SES, etc.)
- [ ] Obtener credenciales SMTP
- [ ] Configurar variables de entorno o base de datos
- [ ] Reiniciar servidor

### Pruebas
- [ ] Probar conexión SMTP desde Admin > Configuración
- [ ] Enviar email de prueba
- [ ] Verificar recepción del email
- [ ] Verificar que no va a spam

### Producción
- [ ] Configurar cron job para procesar cola
- [ ] Verificar dominio en proveedor SMTP
- [ ] Configurar registros DNS (SPF, DKIM, DMARC)
- [ ] Configurar limpieza automática
- [ ] Configurar monitoreo de métricas

### Seguridad
- [ ] Usar variables de entorno para credenciales
- [ ] No commitear credenciales en git
- [ ] Usar contraseñas de aplicación (no contraseñas reales)
- [ ] Limitar acceso al endpoint de cron
- [ ] Habilitar rate limiting

---

## 📚 Recursos Adicionales

### Documentación de Proveedores
- **Gmail:** https://support.google.com/mail/answer/7126229
- **SendGrid:** https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api
- **AWS SES:** https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html
- **Mailgun:** https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp

### Herramientas Útiles
- **Mail Tester:** https://www.mail-tester.com/ (verificar spam score)
- **MX Toolbox:** https://mxtoolbox.com/ (verificar DNS)
- **Mailtrap:** https://mailtrap.io/ (testing en desarrollo)

---

## 🆘 Soporte

Si tienes problemas:
1. Revisar esta guía completa
2. Verificar logs del servidor
3. Verificar configuración SMTP
4. Probar con otro proveedor SMTP
5. Contactar soporte del proveedor SMTP

---

**Última actualización:** 25 de febrero de 2026  
**Versión:** 1.0  
**Estado:** Documentación Completa ✅

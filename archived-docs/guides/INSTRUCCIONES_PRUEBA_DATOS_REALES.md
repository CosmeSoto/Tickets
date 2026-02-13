# 🧪 Instrucciones para Probar Datos Reales - Sistema de Tickets

## ✅ ESTADO ACTUAL VERIFICADO

### 📊 Base de Datos Confirmada
- ✅ **5 usuarios** creados correctamente
- ✅ **3 tickets** con datos reales
- ✅ **7 categorías** activas
- ✅ **3 comentarios** en tickets
- ✅ **Passwords** funcionando correctamente

### 🔐 Credenciales Verificadas
- **Admin**: admin@tickets.com / admin123 ✅
- **Técnico 1**: tecnico1@tickets.com / tech123 ✅
- **Técnico 2**: tecnico2@tickets.com / tech123 ✅
- **Cliente 1**: cliente1@empresa.com / client123 ✅
- **Cliente 2**: cliente2@empresa.com / client123 ✅

### 🛠️ APIs Funcionando
- ✅ `/api/auth/session` - Devuelve sesión vacía sin login
- ✅ `/api/reports` - Devuelve 401 sin autenticación (correcto)
- ✅ `/api/auth/csrf` - Funcionando
- ✅ `/api/auth/providers` - Funcionando

## 🎯 PASOS PARA PROBAR DATOS REALES

### Paso 1: Acceder a la Página de Pruebas
1. Abrir navegador en: **http://localhost:3000/test-auth**
2. Esta página te permitirá hacer login y probar todas las APIs

### Paso 2: Hacer Login como Admin
1. En la página de pruebas, usar las credenciales:
   - **Email**: admin@tickets.com
   - **Password**: admin123
2. Hacer clic en "Iniciar Sesión"
3. Verificar que aparezca la información de sesión

### Paso 3: Probar APIs de Reportes
1. Una vez logueado, hacer clic en los botones de prueba:
   - **Test Reports Tickets** - Debe devolver datos reales
   - **Test Reports Technicians** - Debe mostrar técnicos con estadísticas
   - **Test Reports Categories** - Debe mostrar categorías con métricas
2. Verificar en los resultados que se muestren datos reales, no vacíos

### Paso 4: Acceder a Reportes Completos
1. Hacer clic en "Ir a Reportes (Admin)"
2. Verificar que se carguen los gráficos con datos reales
3. Probar los filtros avanzados
4. Verificar las 4 pestañas: Resumen, Tickets, Técnicos, Categorías

### Paso 5: Verificar Datos en Consola
1. Abrir DevTools (F12)
2. Ver la pestaña Console
3. Buscar logs que muestren:
   ```
   🔍 Cargando reporte de tickets con params: ...
   ✅ Datos de tickets recibidos: { totalTickets: 3, ... }
   ```

## 🔍 PÁGINAS DE DEBUG DISPONIBLES

### 1. Página de Test de Autenticación
- **URL**: http://localhost:3000/test-auth
- **Función**: Login manual y prueba de APIs
- **Uso**: Para verificar que la autenticación funciona

### 2. Página de Debug de Reportes
- **URL**: http://localhost:3000/admin/reports/debug
- **Función**: Debug detallado de reportes
- **Uso**: Para ver información técnica de sesión y APIs

### 3. Login Normal
- **URL**: http://localhost:3000/login
- **Función**: Login estándar del sistema
- **Uso**: Para acceso normal al sistema

## 📋 DATOS ESPERADOS EN REPORTES

### Tickets (3 tickets reales):
```json
{
  "totalTickets": 3,
  "openTickets": 1,
  "inProgressTickets": 1,
  "resolvedTickets": 1,
  "ticketsByPriority": {
    "HIGH": 1,
    "MEDIUM": 1,
    "LOW": 1
  },
  "ticketsByCategory": [
    { "categoryName": "Hardware", "count": 1 },
    { "categoryName": "Software", "count": 1 },
    { "categoryName": "Red y Conectividad", "count": 1 }
  ]
}
```

### Técnicos (2 técnicos):
```json
[
  {
    "technicianName": "María García",
    "totalAssigned": 1,
    "resolved": 0,
    "inProgress": 1
  },
  {
    "technicianName": "Juan Pérez", 
    "totalAssigned": 1,
    "resolved": 1,
    "inProgress": 0
  }
]
```

### Categorías (7 categorías):
```json
[
  {
    "categoryName": "Hardware",
    "totalTickets": 1,
    "resolvedTickets": 0
  },
  {
    "categoryName": "Software", 
    "totalTickets": 1,
    "resolvedTickets": 0
  }
  // ... más categorías
]
```

## ❌ PROBLEMAS CONOCIDOS Y SOLUCIONES

### Problema: "No hay información en reportes"
**Causa**: No estás logueado como ADMIN
**Solución**: 
1. Ir a http://localhost:3000/test-auth
2. Hacer login con admin@tickets.com / admin123
3. Probar las APIs desde ahí

### Problema: "Error 401 No autorizado"
**Causa**: Sesión expirada o no válida
**Solución**:
1. Cerrar sesión completamente
2. Limpiar cookies del navegador
3. Hacer login nuevamente

### Problema: "APIs devuelven datos vacíos"
**Causa**: Base de datos sin datos
**Solución**:
```bash
cd sistema-tickets-nextjs
npx prisma db seed
```

## 🎯 VERIFICACIÓN FINAL

### ✅ Checklist de Funcionamiento:
- [ ] Login exitoso con admin@tickets.com
- [ ] Sesión muestra rol ADMIN
- [ ] API `/api/reports?type=tickets` devuelve 3 tickets
- [ ] API `/api/reports?type=technicians` devuelve 2 técnicos
- [ ] API `/api/reports?type=categories` devuelve 7 categorías
- [ ] Gráficos en reportes muestran datos reales
- [ ] Filtros funcionan correctamente
- [ ] Exportación CSV funciona

### 🚀 Si Todo Funciona:
El sistema está **100% conectado a datos reales** de PostgreSQL. Los reportes muestran:
- **3 tickets reales** con diferentes estados y prioridades
- **2 técnicos** con estadísticas de rendimiento
- **7 categorías** con métricas de tickets
- **Gráficos interactivos** con datos reales
- **Filtros avanzados** funcionando
- **Exportación CSV** con datos reales

## 📞 SOPORTE

Si encuentras algún problema:
1. Revisar la consola del navegador (F12)
2. Verificar que el servidor esté corriendo en puerto 3000
3. Confirmar que PostgreSQL esté funcionando
4. Usar las páginas de debug para diagnosticar
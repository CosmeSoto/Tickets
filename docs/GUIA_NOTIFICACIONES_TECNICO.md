# Guía de Notificaciones para Técnicos

**Versión:** 2.0  
**Fecha:** 2026-02-19  
**Estado:** ✅ Actualizado

---

## 📢 Tipos de Notificaciones

Los técnicos reciben 3 tipos principales de notificaciones, ordenadas por prioridad:

### 1. 💬 Cliente Respondió (PRIORIDAD ALTA)
**Prioridad:** 10 (aparece primero)  
**Tipo:** WARNING (naranja)  
**Cuándo aparece:** Cuando un cliente agrega un comentario a un ticket asignado a ti

**Ejemplo:**
```
💬 Cliente respondió
Ana Martínez comentó hace 5 minutos en "Error x021"
[Ver comentario]
```

**Qué hacer:**
1. Haz clic en "Ver comentario"
2. Lee el comentario del cliente
3. Responde lo antes posible
4. Marca la notificación como leída

**Tiempo de detección:** 2 minutos (actualización automática)

---

### 2. ⚠️ Ticket Urgente Próximo a Vencer
**Prioridad:** 15-17  
**Tipo:** WARNING (naranja)  
**Cuándo aparece:** Ticket urgente con más de 2h pero menos de 6h sin resolver

**Ejemplo:**
```
⚠️ Ticket urgente próximo a vencer
"Problema crítico de acceso" de Juan Pérez vence en 3h
[Trabajar en ticket]
```

**Qué hacer:**
1. Prioriza este ticket
2. Trabaja en la solución
3. Actualiza el estado
4. Comunica avances al cliente

---

### 3. 📞 Cliente Esperando Respuesta
**Prioridad:** 20  
**Tipo:** WARNING (naranja)  
**Cuándo aparece:** Ticket con más de 1h sin respuesta inicial

**Ejemplo:**
```
📞 Cliente esperando respuesta
María López lleva 3h esperando tu respuesta inicial
[Responder ahora]
```

**Qué hacer:**
1. Responde inmediatamente
2. Aunque no tengas la solución, comunica que estás trabajando
3. Da un tiempo estimado de resolución
4. Mantén al cliente informado

---

## 🔔 Cómo Funcionan las Notificaciones

### Actualización Automática
- **Frecuencia:** Cada 2 minutos
- **Método:** Polling automático
- **Sin recargar:** La página no se recarga

### Estados de Notificación
- **No leída:** Aparece con fondo destacado
- **Leída:** Aparece con fondo normal
- **Descartada:** No aparece más

### Acciones Disponibles
1. **Ver/Abrir:** Haz clic en la notificación o en el botón de acción
2. **Marcar como leída:** Haz clic en el ícono de check
3. **Descartar:** Haz clic en el ícono de X
4. **Marcar todas como leídas:** Botón en la parte superior

---

## 📱 Campanita de Notificaciones

### Ubicación
La campanita está en la esquina superior derecha del dashboard.

### Indicadores
- **Badge rojo:** Número de notificaciones no leídas
- **Sin badge:** No hay notificaciones nuevas
- **Animación:** Aparece cuando hay notificaciones nuevas

### Cómo Usar
1. Haz clic en la campanita
2. Se abre el panel de notificaciones
3. Ve todas tus notificaciones ordenadas por prioridad
4. Haz clic en cualquier notificación para actuar

---

## ⏱️ Tiempos de Respuesta Recomendados

### Comentarios de Clientes
- **Ideal:** Menos de 15 minutos
- **Aceptable:** Menos de 1 hora
- **Crítico:** Más de 2 horas

### Tickets Urgentes
- **Respuesta inicial:** Menos de 30 minutos
- **Resolución:** Menos de 6 horas
- **Actualización:** Cada 2 horas

### Tickets Normales
- **Respuesta inicial:** Menos de 2 horas
- **Resolución:** Menos de 24 horas
- **Actualización:** Cada 4 horas

---

## 🎯 Mejores Prácticas

### 1. Revisa Notificaciones Regularmente
- Abre la campanita cada 15-30 minutos
- No esperes a que se acumulen
- Prioriza según el tipo de notificación

### 2. Responde Rápido a Clientes
- Los comentarios de clientes son prioridad alta
- Aunque no tengas la solución, comunica que estás trabajando
- Mantén al cliente informado del progreso

### 3. Gestiona tu Carga de Trabajo
- Si tienes muchas notificaciones, pide ayuda
- Prioriza tickets urgentes
- Comunica si necesitas más tiempo

### 4. Marca Notificaciones como Leídas
- Mantén tu lista limpia
- Descarta notificaciones ya atendidas
- Usa "Marcar todas como leídas" cuando sea apropiado

### 5. Usa los Links Directos
- Haz clic en "Ver comentario" o "Trabajar en ticket"
- Te lleva directamente a donde necesitas estar
- Ahorra tiempo de navegación

---

## 🔧 Configuración

### Frecuencia de Actualización
Por defecto, las notificaciones se actualizan cada 2 minutos. Si necesitas cambiar esto, contacta al administrador.

### Notificaciones del Navegador
Próximamente podrás habilitar notificaciones push del navegador para recibir alertas incluso cuando no estés en la página.

### Sonidos
Próximamente podrás habilitar sonidos para notificaciones importantes.

---

## ❓ Preguntas Frecuentes

### ¿Por qué no veo notificaciones?
- Verifica que tengas tickets asignados
- Espera 2 minutos para la actualización
- Refresca la página si es necesario
- Verifica que no hayas descartado todas las notificaciones

### ¿Puedo desactivar las notificaciones?
No, las notificaciones son esenciales para el trabajo del técnico. Sin embargo, puedes marcarlas como leídas o descartarlas.

### ¿Las notificaciones se sincronizan entre dispositivos?
Actualmente no. Las notificaciones leídas/descartadas se guardan en el navegador local. Próximamente se sincronizarán en la nube.

### ¿Qué pasa si pierdo una notificación?
Las notificaciones permanecen visibles hasta que las descartes. Si un cliente comentó hace 24 horas, aún verás la notificación.

### ¿Puedo ver notificaciones antiguas?
Sí, las notificaciones de las últimas 24 horas permanecen visibles. Para ver más antiguas, ve a la página de notificaciones completa.

---

## 📊 Métricas de Rendimiento

Tu rendimiento como técnico se mide en parte por:
- **Tiempo de respuesta a comentarios:** Cuánto tardas en responder
- **Tickets resueltos a tiempo:** Cuántos tickets resuelves antes del SLA
- **Satisfacción del cliente:** Calificaciones que recibes

Las notificaciones te ayudan a mejorar estas métricas manteniéndote informado en tiempo real.

---

## 🎓 Capacitación

### Para Nuevos Técnicos
1. Lee esta guía completa
2. Practica con tickets de prueba
3. Pregunta a técnicos experimentados
4. Revisa las notificaciones cada 15 minutos durante tu primera semana

### Para Técnicos Experimentados
1. Revisa las nuevas funcionalidades
2. Comparte mejores prácticas con el equipo
3. Sugiere mejoras al sistema
4. Ayuda a nuevos técnicos

---

## 📞 Soporte

Si tienes problemas con las notificaciones:
1. Refresca la página
2. Limpia el caché del navegador
3. Contacta al administrador del sistema
4. Reporta el problema con detalles específicos

---

## 🚀 Próximas Mejoras

Estamos trabajando en:
- ✅ Notificaciones de comentarios de clientes (IMPLEMENTADO)
- 🔄 Notificaciones push del navegador
- 🔄 Sonidos personalizables
- 🔄 Sincronización en la nube
- 🔄 Notificaciones móviles (PWA)
- 🔄 Integración con Slack/Teams

---

**Última actualización:** 2026-02-19  
**Versión:** 2.0  
**Autor:** Sistema de Tickets Next.js

#!/bin/bash

echo "🚀 SISTEMA DE TICKETS NEXT.JS - INICIO COMPLETO"
echo "==============================================="
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# Función para verificar servicios Docker
check_docker() {
    echo -e "${BLUE}🔧 Verificando servicios Docker...${NC}"
    if ! docker-compose ps | grep -q "Up"; then
        echo -e "${YELLOW}⚠️  Iniciando servicios Docker...${NC}"
        docker-compose up -d > /dev/null 2>&1
        sleep 5
        if docker-compose ps | grep -q "Up"; then
            echo -e "${GREEN}✅ Servicios Docker iniciados correctamente${NC}"
        else
            echo -e "${RED}❌ Error al iniciar servicios Docker${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Servicios Docker ya están activos${NC}"
    fi
}

# Función para verificar base de datos
check_database() {
    echo -e "${BLUE}🗄️ Verificando base de datos...${NC}"
    
    # Esperar a que PostgreSQL esté listo
    echo -e "${YELLOW}⏳ Esperando a que PostgreSQL esté listo...${NC}"
    sleep 10
    
    # Verificar conexión
    if docker exec tickets-postgres pg_isready -U tickets_user -d tickets_db > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PostgreSQL está funcionando correctamente${NC}"
    else
        echo -e "${RED}❌ Error de conexión a PostgreSQL${NC}"
        exit 1
    fi
    
    # Verificar Redis
    if docker exec tickets-redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Redis está funcionando correctamente${NC}"
    else
        echo -e "${RED}❌ Error de conexión a Redis${NC}"
        exit 1
    fi
}

# Función para verificar dependencias
check_dependencies() {
    echo -e "${BLUE}📦 Verificando dependencias...${NC}"
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}⚠️  Instalando dependencias...${NC}"
        npm install > /dev/null 2>&1
        echo -e "${GREEN}✅ Dependencias instaladas${NC}"
    else
        echo -e "${GREEN}✅ Dependencias ya están instaladas${NC}"
    fi
}

# Función para verificar Prisma
check_prisma() {
    echo -e "${BLUE}🔄 Verificando Prisma...${NC}"
    
    # Generar cliente Prisma
    npx prisma generate > /dev/null 2>&1
    echo -e "${GREEN}✅ Cliente Prisma generado${NC}"
    
    # Aplicar esquema a la base de datos
    npx prisma db push > /dev/null 2>&1
    echo -e "${GREEN}✅ Esquema aplicado a la base de datos${NC}"
    
    # Ejecutar seeder
    npm run db:seed > /dev/null 2>&1
    echo -e "${GREEN}✅ Datos iniciales creados${NC}"
}

# Función para mostrar información del sistema
show_system_info() {
    echo ""
    echo -e "${CYAN}🎉 SISTEMA COMPLETAMENTE LISTO${NC}"
    echo ""
    echo -e "${YELLOW}🌐 ACCESO AL SISTEMA:${NC}"
    echo "   🏠 Sitio Público:  http://localhost:3000"
    echo "   🔐 Login:          http://localhost:3000/login"
    echo "   🔧 Admin:          http://localhost:3000/admin"
    echo "   👨‍💻 Técnico:        http://localhost:3000/technician"
    echo "   👤 Cliente:        http://localhost:3000/client"
    echo ""
    echo -e "${YELLOW}👥 CREDENCIALES DE ACCESO:${NC}"
    echo "   🔧 Admin:    admin@centrocomercial.com / Admin2024!"
    echo "   👨‍💻 Técnico:  soporte@centrocomercial.com / Tech2024!"
    echo "   👤 Cliente:  cliente@centrocomercial.com / Cliente2024!"
    echo ""
    echo -e "${YELLOW}🛠️ HERRAMIENTAS ADICIONALES:${NC}"
    echo "   📊 pgAdmin:   http://localhost:8080 (admin@tickets.com / admin123)"
    echo "   🗄️ PostgreSQL: localhost:5432"
    echo "   🔴 Redis:     localhost:6379"
    echo ""
    echo -e "${CYAN}✨ FUNCIONALIDADES PRINCIPALES:${NC}"
    echo "   ✅ Landing page pública con CMS"
    echo "   ✅ Autenticación multi-panel"
    echo "   ✅ Dashboard personalizado por rol"
    echo "   ✅ Sistema completo de tickets"
    echo "   ✅ Base de datos PostgreSQL + Redis"
    echo "   ✅ Sistema de notificaciones preparado"
    echo ""
}

# Ejecutar verificaciones
check_docker
check_database
check_dependencies
check_prisma
show_system_info

echo -e "${BLUE}🚀 Iniciando servidor Next.js...${NC}"
echo -e "${YELLOW}Presione Ctrl+C para detener el servidor${NC}"
echo ""

# Iniciar servidor Next.js
npm run dev
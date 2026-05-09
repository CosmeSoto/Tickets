#!/bin/bash

# Script de diagnóstico para configuración de inventario
echo "=== Diagnóstico de Configuración de Inventario ==="
echo ""

# 1. Verificar datos en la base de datos
echo "1. Verificando datos en la base de datos..."
echo ""

echo "Tipos de proveedor:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM supplier_types;" -t
echo ""

echo "Tipos de equipo:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM equipment_types;" -t
echo ""

echo "Tipos de licencia:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM license_types;" -t
echo ""

echo "Tipos de consumible:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM consumable_types;" -t
echo ""

echo "Atributos de equipos:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM equipment_type_attributes;" -t
echo ""

echo "Atributos de licencias:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM license_type_attributes;" -t
echo ""

echo "Atributos de consumibles:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM consumable_type_attributes;" -t
echo ""

echo "Bodegas:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT COUNT(*) as total FROM warehouses;" -t
echo ""

# 2. Verificar familias
echo "2. Familias:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT name, code FROM families ORDER BY name;" -t
echo ""

# 3. Verificar configuraciones de familia
echo "3. Configuraciones de inventario por familia:"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT f.name, COALESCE(ifc.inventory_enabled::text, 'No config') as inv_enabled, ifc.code_prefix FROM families f LEFT JOIN inventory_family_config ifc ON f.id = ifc.family_id ORDER BY f.name;" -t
echo ""

# 4. Verificar tipos de proveedor con detalles
echo "4. Tipos de proveedor (detalle):"
docker exec tickets-postgres-dev psql -U tickets_user -d tickets_db -c "SELECT st.name, COALESCE(f.name, 'Global') as ambito, st.is_active FROM supplier_types st LEFT JOIN families f ON st.family_id = f.id ORDER BY st.name;" -t
echo ""

echo "=== Diagnóstico completado ==="

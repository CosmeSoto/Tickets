-- Retira el sistema legacy de atributos por familia (family_custom_fields).
--
-- Quedó duplicado con el catálogo de atributos por TIPO de activo
-- (equipment_type_attributes / license_type_attributes / consumable_type_attributes,
-- editable desde "Gestionar atributos" — ver AttributeManagerDialog / TypeAttributesInput),
-- que es el único que los formularios de creación/edición usan hoy para capturar valores.
-- La tabla family_custom_fields nunca tuvo una pantalla de administración alcanzable desde
-- la UI (su API — src/lib/services/custom-fields.service.ts — no tenía ningún consumidor
-- en el frontend) y sus campos sembrados ("marca", "modelo") no coinciden con ningún
-- fieldName que el formulario actual pueda llegar a guardar en equipment_custom_values,
-- así que no hay datos vivos que preservar.
--
-- DropForeignKey
ALTER TABLE "family_custom_fields" DROP CONSTRAINT IF EXISTS "family_custom_fields_family_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "family_custom_fields";

-- Unique constraint para categorías con padre (nivel 2+)
-- Previene duplicados: misma categoría en el mismo padre y nivel
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_parentId_level_key"
ON "categories" ("name", "parentId", "level")
WHERE "parentId" IS NOT NULL;

-- Unique constraint para categorías raíz (nivel 1, sin padre)
-- Previene duplicados: misma categoría raíz en el mismo nivel
CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_level_root_key"
ON "categories" ("name", "level")
WHERE "parentId" IS NULL;

-- Index para búsquedas por nombre+nivel
CREATE INDEX IF NOT EXISTS "categories_name_level_idx"
ON "categories" ("name", "level");

-- =============================================================================
-- usuarios_restore.sql
-- Propósito: Restaurar los usuarios base del sistema cuando se reconstruya
--            cualquier contenedor (dev o producción) y la BD quede vacía.
--            Usar SOLO de forma manual cuando sea necesario DESPUÉS del seed.
--
-- IMPORTANTE: Los departmentId usan UUIDs deterministas generados por el seed.
--   Si el seed cambia los nombres de departamentos, estos IDs dejarán de funcionar.
--
-- Cómo ejecutar (desde la raíz del proyecto):
--
--   Desarrollo:
--     cat prisma/scripts/usuarios_restore.sql | docker compose -f docker-compose.dev.yml exec -T postgres psql -U tickets_user -d tickets_db
--
--   Producción:
--     cat prisma/scripts/usuarios_restore.sql | docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres psql -U tickets_user -d tickets_db
--
-- =============================================================================

-- Víctor Andrés García Vélez — CLIENT — Contabilidad
INSERT INTO users ("id", "email", "name", "passwordHash", "role", "departmentId", "phone", "avatar", "isActive", "isEmailVerified", "canManageInventory", "ticketsEnabled", "inventoryEnabled", "patrols_enabled", "news_enabled", "can_manage_news", "forms_enabled", "can_manage_forms", "lastLogin", "oauthProvider", "oauthId", "createdAt", "updatedAt", "is_super_admin", "can_request_assets")
VALUES ('b0f98aa3-1a87-4f80-87cf-eea53b8af4b4', 'andres.garcia@paseosanfrancisco.ec', 'Víctor Andrés García Vélez', '$2b$10$Ws4BlZF5mFcFQ5f3itmz0uYWFt2niPu18TZTxzyH7uzsDmT/PKfPG', 'CLIENT', '7bf358e1-86c3-4446-afaa-718986aab7ea', '0984605366', NULL, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '2026-05-29 15:47:32.252', NULL, NULL, '2026-05-29 15:47:24.21', '2026-05-29 15:47:24.21', FALSE, FALSE)
ON CONFLICT ("email") DO UPDATE SET "name"=EXCLUDED."name", "passwordHash"=EXCLUDED."passwordHash", "role"=EXCLUDED."role", "departmentId"=EXCLUDED."departmentId", "phone"=EXCLUDED."phone", "updatedAt"=EXCLUDED."updatedAt";

-- Tania Guamán — CLIENT — Administración
INSERT INTO users ("id", "email", "name", "passwordHash", "role", "departmentId", "phone", "avatar", "isActive", "isEmailVerified", "canManageInventory", "ticketsEnabled", "inventoryEnabled", "patrols_enabled", "news_enabled", "can_manage_news", "forms_enabled", "can_manage_forms", "lastLogin", "oauthProvider", "oauthId", "createdAt", "updatedAt", "is_super_admin", "can_request_assets")
VALUES ('960fac91-905a-4d10-8ceb-0744a536e31e', 'tania.guaman@paseosanfrancisco.ec', 'Tania Guamán', '$2b$10$wpOrU.jUO2Dc2Ln1ij2lu.kOaYj9Dd2cmsRIlaM36ClIIIEoHdy6q', 'CLIENT', '8e42b2b5-4b9a-4687-a614-73d9a08583c0', NULL, NULL, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, '2026-05-27 20:27:16.543', NULL, NULL, '2026-05-27 20:26:31.016', '2026-05-29 15:48:28.548', FALSE, FALSE)
ON CONFLICT ("email") DO UPDATE SET "name"=EXCLUDED."name", "passwordHash"=EXCLUDED."passwordHash", "role"=EXCLUDED."role", "departmentId"=EXCLUDED."departmentId", "phone"=EXCLUDED."phone", "updatedAt"=EXCLUDED."updatedAt";

-- Cosme Soto — CLIENT — Soporte Técnico
INSERT INTO users ("id", "email", "name", "passwordHash", "role", "departmentId", "phone", "avatar", "isActive", "isEmailVerified", "canManageInventory", "ticketsEnabled", "inventoryEnabled", "patrols_enabled", "news_enabled", "can_manage_news", "forms_enabled", "can_manage_forms", "lastLogin", "oauthProvider", "oauthId", "createdAt", "updatedAt", "is_super_admin", "can_request_assets")
VALUES ('a353f244-cc28-489e-881b-afc6a4b39157', 'cosme.soto@paseosanfrancisco.ec', 'Cosme Soto', '$2b$10$bnD3Jf4d17vltfxEqNBSuu.5I899KggfcnGfpa3jo61Av7/MUsKiq', 'CLIENT', 'cf46476c-96ee-44c8-90e8-8fa057cb10d3', '0986024121', NULL, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, '2026-05-27 21:18:51.554', NULL, NULL, '2026-05-27 17:41:36.87', '2026-05-29 15:48:42.167', FALSE, FALSE)
ON CONFLICT ("email") DO UPDATE SET "name"=EXCLUDED."name", "passwordHash"=EXCLUDED."passwordHash", "role"=EXCLUDED."role", "departmentId"=EXCLUDED."departmentId", "phone"=EXCLUDED."phone", "updatedAt"=EXCLUDED."updatedAt";

-- Cristian Salguero — ADMIN — Seguridad y Salud Ocupacional
INSERT INTO users ("id", "email", "name", "passwordHash", "role", "departmentId", "phone", "avatar", "isActive", "isEmailVerified", "canManageInventory", "ticketsEnabled", "inventoryEnabled", "patrols_enabled", "news_enabled", "can_manage_news", "forms_enabled", "can_manage_forms", "lastLogin", "oauthProvider", "oauthId", "createdAt", "updatedAt", "is_super_admin", "can_request_assets")
VALUES ('41eb5e39-3710-4209-a3b9-4f45d81c1ae9', 'cristian.salguero@paseosanfrancisco.ec', 'Cristian Francisco Salguero Andrade', '$2b$10$bFRRwFtWN6wYseGhZt.uY.0/cLl.InHvKapTUKU9YUZS1a3UE4M1a', 'ADMIN', '9bc286e5-5caf-4751-881f-c677e350bb90', '+593987928931', NULL, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, TRUE, FALSE, TRUE, FALSE, '2026-05-29 16:12:58.849', NULL, NULL, '2026-05-29 16:12:50.778', '2026-05-29 17:56:23.408', FALSE, FALSE)
ON CONFLICT ("email") DO UPDATE SET "name"=EXCLUDED."name", "passwordHash"=EXCLUDED."passwordHash", "role"=EXCLUDED."role", "departmentId"=EXCLUDED."departmentId", "phone"=EXCLUDED."phone", "updatedAt"=EXCLUDED."updatedAt";

-- Administrador del Sistema — ADMIN SuperAdmin — Administración
INSERT INTO users ("id", "email", "name", "passwordHash", "role", "departmentId", "phone", "avatar", "isActive", "isEmailVerified", "canManageInventory", "ticketsEnabled", "inventoryEnabled", "patrols_enabled", "news_enabled", "can_manage_news", "forms_enabled", "can_manage_forms", "lastLogin", "oauthProvider", "oauthId", "createdAt", "updatedAt", "is_super_admin", "can_request_assets")
VALUES ('e2dac125-a972-429a-a238-2c522e168dbb', 'internet.freecom@gmail.com', 'Administrador del Sistema', '$2b$12$5zGrFVe4D.6Gyv69wU/1KuShV3C7BuVJfZ0lp/DlZhmrQ2lqGIYPm', 'ADMIN', '8e42b2b5-4b9a-4687-a614-73d9a08583c0', '+593999999999', NULL, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, '2026-06-01 14:06:01.698', NULL, NULL, '2026-05-29 14:28:33.125', '2026-05-29 14:28:33.125', TRUE, FALSE)
ON CONFLICT ("email") DO UPDATE SET "name"=EXCLUDED."name", "passwordHash"=EXCLUDED."passwordHash", "role"=EXCLUDED."role", "departmentId"=EXCLUDED."departmentId", "phone"=EXCLUDED."phone", "updatedAt"=EXCLUDED."updatedAt";

-- Christian Almachi — ADMIN — Seguridad Física
INSERT INTO users ("id", "email", "name", "passwordHash", "role", "departmentId", "phone", "avatar", "isActive", "isEmailVerified", "canManageInventory", "ticketsEnabled", "inventoryEnabled", "patrols_enabled", "news_enabled", "can_manage_news", "forms_enabled", "can_manage_forms", "lastLogin", "oauthProvider", "oauthId", "createdAt", "updatedAt", "is_super_admin", "can_request_assets")
VALUES ('d44740a4-c94b-4864-bee5-5bd525681091', 'christian.almachi@paseosanfrancisco.ec', 'Christian Almachi', '$2b$10$VCDAy775o6VZWqVYG6CJNOUWSIcU3o5ICEasFKZC7iLbki39RYrGK', 'ADMIN', '32a98473-16b1-4f90-a773-b1aef0332969', '+593987985551', NULL, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, '2026-06-02 21:25:47.345', NULL, NULL, '2026-06-02 21:25:42.444', '2026-06-02 21:27:25.571', FALSE, FALSE)
ON CONFLICT ("email") DO UPDATE SET "name"=EXCLUDED."name", "passwordHash"=EXCLUDED."passwordHash", "role"=EXCLUDED."role", "departmentId"=EXCLUDED."departmentId", "phone"=EXCLUDED."phone", "updatedAt"=EXCLUDED."updatedAt";

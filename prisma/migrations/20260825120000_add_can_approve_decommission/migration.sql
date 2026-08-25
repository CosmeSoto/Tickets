-- Permiso: ADMIN (no super admin) habilitado para aprobar bajas definitivas de activos.
-- Antes, solo el Super Admin podía aprobar; los ADMIN de área (los verdaderos stakeholders
-- del día a día) quedaban bloqueados. Este flag, otorgado por Super Admin desde Gestión de
-- Usuarios, delega esa aprobación a un ADMIN concreto (con el mismo scope por familia que
-- ya aplica al resto de sus permisos de administrador).
ALTER TABLE "users"
  ADD COLUMN "can_approve_decommission" BOOLEAN NOT NULL DEFAULT false;

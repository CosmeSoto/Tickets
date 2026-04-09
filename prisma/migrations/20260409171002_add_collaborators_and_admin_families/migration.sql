-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_super_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "admin_family_assignments" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_family_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_collaborators" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "collaborator_id" TEXT NOT NULL,
    "added_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_family_assignments_admin_id_is_active_idx" ON "admin_family_assignments"("admin_id", "is_active");

-- CreateIndex
CREATE INDEX "admin_family_assignments_family_id_is_active_idx" ON "admin_family_assignments"("family_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "admin_family_assignments_admin_id_family_id_key" ON "admin_family_assignments"("admin_id", "family_id");

-- CreateIndex
CREATE INDEX "ticket_collaborators_ticket_id_idx" ON "ticket_collaborators"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_collaborators_collaborator_id_idx" ON "ticket_collaborators"("collaborator_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_collaborators_ticket_id_collaborator_id_key" ON "ticket_collaborators"("ticket_id", "collaborator_id");

-- AddForeignKey
ALTER TABLE "admin_family_assignments" ADD CONSTRAINT "admin_family_assignments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_family_assignments" ADD CONSTRAINT "admin_family_assignments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_collaborators" ADD CONSTRAINT "ticket_collaborators_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_collaborators" ADD CONSTRAINT "ticket_collaborators_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_collaborators" ADD CONSTRAINT "ticket_collaborators_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'INVENTORY', 'TICKET_FAMILY_CHANGE');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketSource" AS ENUM ('WEB', 'EMAIL', 'PHONE', 'CHAT', 'API', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TECHNICIAN', 'CLIENT');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DAMAGED', 'RETIRED');

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "OwnershipType" AS ENUM ('FIXED_ASSET', 'RENTAL', 'LOAN');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PERMANENT', 'TEMPORARY', 'LOAN');

-- CreateEnum
CREATE TYPE "ActStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('EQUIPMENT', 'CONSUMABLE', 'LICENSE', 'MIXED');

-- CreateEnum
CREATE TYPE "DecommissionAssetType" AS ENUM ('EQUIPMENT', 'LICENSE');

-- CreateEnum
CREATE TYPE "DecommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryActType" AS ENUM ('EQUIPMENT_ASSIGNMENT', 'MRO_DELIVERY', 'SERVICE_COMPLETION', 'ASSET_TRANSFER', 'CONTRACT_RENEWAL');

-- CreateEnum
CREATE TYPE "AssetSubtype" AS ENUM ('EQUIPMENT', 'MRO', 'LICENSE');

-- CreateEnum
CREATE TYPE "FormSection" AS ENUM ('FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'STOCK_MRO', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "LicenseScope" AS ENUM ('INDIVIDUAL', 'DEPARTMENT', 'COMPANY');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('SOFTWARE', 'SERVICE_EXTERNAL', 'MAINTENANCE', 'INSURANCE', 'SLA');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('LINEAR', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION');

-- CreateEnum
CREATE TYPE "ConsumableStatus" AS ENUM ('ACTIVE', 'LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRED', 'RETIRED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "checksum" TEXT,
    "compressed" BOOLEAN NOT NULL DEFAULT false,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "departmentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT DEFAULT '#6B7280',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#3B82F6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "family_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "teamsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketCreated" BOOLEAN NOT NULL DEFAULT true,
    "ticketUpdated" BOOLEAN NOT NULL DEFAULT true,
    "ticketAssigned" BOOLEAN NOT NULL DEFAULT true,
    "ticketResolved" BOOLEAN NOT NULL DEFAULT true,
    "commentAdded" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "userId" TEXT NOT NULL,
    "ticketId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT NOT NULL,
    "tenantId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "redirectUri" TEXT,
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_assignments" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "maxTickets" INTEGER,
    "autoAssign" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "comment" TEXT,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_ratings" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "technicianId" TEXT,
    "rating" INTEGER NOT NULL,
    "feedback" TEXT,
    "responseTime" INTEGER NOT NULL,
    "technicalSkill" INTEGER NOT NULL,
    "communication" INTEGER NOT NULL,
    "problemResolution" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "clientId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "categoryId" TEXT NOT NULL,
    "createdById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "slaDeadline" TIMESTAMP(3),
    "estimatedTime" INTEGER,
    "actualTime" INTEGER,
    "tags" TEXT[],
    "source" "TicketSource" NOT NULL DEFAULT 'WEB',
    "ticket_code" VARCHAR(30),
    "family_id" TEXT,
    "code_is_manual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "pushNotifications" BOOLEAN NOT NULL DEFAULT true,
    "ticketUpdates" BOOLEAN NOT NULL DEFAULT true,
    "systemAlerts" BOOLEAN NOT NULL DEFAULT true,
    "weeklyReport" BOOLEAN NOT NULL DEFAULT false,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketCreated" BOOLEAN NOT NULL DEFAULT true,
    "ticketAssigned" BOOLEAN NOT NULL DEFAULT true,
    "statusChanged" BOOLEAN NOT NULL DEFAULT true,
    "newComments" BOOLEAN NOT NULL DEFAULT true,
    "ticketUpdated" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '08:00',
    "autoAssignEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentTickets" INTEGER NOT NULL DEFAULT 10,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "language" TEXT NOT NULL DEFAULT 'es',
    "timezone" TEXT NOT NULL DEFAULT 'America/Guayaquil',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "templateName" TEXT,
    "templateData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CLIENT',
    "departmentId" TEXT,
    "phone" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3),
    "oauthProvider" TEXT,
    "oauthId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "categoryId" TEXT NOT NULL,
    "tags" TEXT[],
    "sourceTicketId" TEXT,
    "authorId" TEXT NOT NULL,
    "family_id" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_votes" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_plans" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total_tasks" INTEGER NOT NULL DEFAULT 0,
    "completed_tasks" INTEGER NOT NULL DEFAULT 0,
    "estimated_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(3),
    "target_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resolution_tasks" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "estimated_hours" DOUBLE PRECISION,
    "actual_hours" DOUBLE PRECISION,
    "start_time" TEXT,
    "end_time" TEXT,
    "assigned_to" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolution_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_knowledge_articles" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "events" TEXT[],
    "secret" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "headers" JSONB,
    "timeout_ms" INTEGER NOT NULL DEFAULT 30000,
    "retry_count" INTEGER NOT NULL DEFAULT 3,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_triggered_at" TIMESTAMP(3),

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "event" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "response_status" INTEGER,
    "response_body" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category_id" TEXT,
    "family_id" TEXT,
    "priority" VARCHAR(20) NOT NULL,
    "response_time_hours" INTEGER NOT NULL,
    "resolution_time_hours" INTEGER NOT NULL,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT false,
    "business_hours_start" VARCHAR(8) NOT NULL DEFAULT '09:00:00',
    "business_hours_end" VARCHAR(8) NOT NULL DEFAULT '18:00:00',
    "business_days" VARCHAR(50) NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_violations" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sla_policy_id" TEXT NOT NULL,
    "violation_type" VARCHAR(50) NOT NULL,
    "expected_at" TIMESTAMP(3) NOT NULL,
    "actual_at" TIMESTAMP(3),
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "severity" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sla_metrics" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sla_policy_id" TEXT NOT NULL,
    "response_deadline" TIMESTAMP(3),
    "resolution_deadline" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "response_sla_met" BOOLEAN,
    "resolution_sla_met" BOOLEAN,
    "response_time_minutes" INTEGER,
    "resolution_time_minutes" INTEGER,
    "business_hours_elapsed" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_sla_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_analytics" (
    "id" TEXT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "client_id" TEXT NOT NULL,
    "category_id" TEXT,
    "search_query" VARCHAR(255),
    "time_to_select" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_content" (
    "id" TEXT NOT NULL,
    "hero_title" TEXT NOT NULL DEFAULT 'Soporte Técnico Profesional',
    "hero_subtitle" TEXT NOT NULL DEFAULT 'Resolvemos tus problemas técnicos de manera rápida y eficiente',
    "hero_cta_primary" TEXT NOT NULL DEFAULT 'Crear Ticket de Soporte',
    "hero_cta_primary_url" TEXT NOT NULL DEFAULT '/login',
    "hero_cta_secondary" TEXT NOT NULL DEFAULT 'Ver Servicios',
    "hero_cta_secondary_url" TEXT NOT NULL DEFAULT '#servicios',
    "hero_image_url" TEXT,
    "services_title" TEXT NOT NULL DEFAULT 'Nuestros Servicios',
    "services_subtitle" TEXT NOT NULL DEFAULT 'Ofrecemos soporte técnico integral para todas tus necesidades tecnológicas',
    "services_enabled" BOOLEAN NOT NULL DEFAULT true,
    "company_name" TEXT NOT NULL DEFAULT 'Sistema de Tickets',
    "company_tagline" TEXT NOT NULL DEFAULT 'Soporte técnico profesional',
    "company_logo_light_url" TEXT,
    "company_logo_dark_url" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "contact_address" TEXT,
    "footer_text" TEXT NOT NULL DEFAULT '© 2024 Sistema de Tickets. Todos los derechos reservados.',
    "meta_title" TEXT NOT NULL DEFAULT 'Sistema de Tickets - Soporte Técnico Profesional',
    "meta_description" TEXT NOT NULL DEFAULT 'Sistema profesional de gestión de tickets de soporte técnico',
    "meta_keywords" TEXT,
    "show_stats" BOOLEAN NOT NULL DEFAULT false,
    "show_testimonials" BOOLEAN NOT NULL DEFAULT false,
    "show_faq" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "landing_page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_services" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "icon" TEXT NOT NULL,
    "icon_color" TEXT NOT NULL DEFAULT 'blue',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "link_url" TEXT,
    "link_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_banners" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "image_url_dark" TEXT,
    "link_url" TEXT,
    "link_text" TEXT,
    "position" TEXT NOT NULL DEFAULT 'hero',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_page_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "family_id" TEXT,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "EquipmentCondition" NOT NULL DEFAULT 'GOOD',
    "ownership_type" "OwnershipType" NOT NULL DEFAULT 'FIXED_ASSET',
    "purchase_date" TIMESTAMP(3),
    "purchase_price" DOUBLE PRECISION,
    "warranty_expiration" TIMESTAMP(3),
    "specifications" JSONB,
    "accessories" TEXT[],
    "location" TEXT,
    "notes" TEXT,
    "photo_url" TEXT,
    "qr_code" TEXT NOT NULL,
    "rental_provider" TEXT,
    "rental_contract_number" TEXT,
    "rental_start_date" TIMESTAMP(3),
    "rental_end_date" TIMESTAMP(3),
    "rental_monthly_cost" DOUBLE PRECISION,
    "rental_contact_name" TEXT,
    "rental_contact_email" TEXT,
    "rental_contact_phone" TEXT,
    "rental_notes" TEXT,
    "supplier_id" TEXT,
    "invoice_number" VARCHAR(100),
    "purchase_order_number" VARCHAR(100),
    "useful_life_years" DOUBLE PRECISION,
    "residual_value" DOUBLE PRECISION DEFAULT 0,
    "warehouse_id" TEXT,
    "acquisition_mode" "OwnershipType",
    "depreciation_rate" DOUBLE PRECISION,
    "depreciation_method" "DepreciationMethod",
    "total_units" DOUBLE PRECISION,
    "used_units" DOUBLE PRECISION,
    "contract_start_date" TIMESTAMP(3),
    "contract_end_date" TIMESTAMP(3),
    "contract_renewal_cost" DOUBLE PRECISION,
    "contract_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_attachments" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_assignments" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "deliverer_id" TEXT NOT NULL,
    "assignment_type" "AssignmentType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "actual_end_date" TIMESTAMP(3),
    "accessories" TEXT[],
    "observations" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_acts" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "assignment_id" TEXT,
    "equipment_snapshot" JSONB NOT NULL,
    "deliverer_info" JSONB NOT NULL,
    "receiver_info" JSONB NOT NULL,
    "accessories" TEXT[],
    "observations" TEXT,
    "terms_version" TEXT NOT NULL DEFAULT '1.0',
    "status" "ActStatus" NOT NULL DEFAULT 'PENDING',
    "acceptance_token" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "signature_timestamp" TIMESTAMP(3),
    "signature_ip" TEXT,
    "signature_user_agent" TEXT,
    "verification_hash" TEXT,
    "pdf_path" TEXT,
    "act_type" "DeliveryActType" NOT NULL DEFAULT 'EQUIPMENT_ASSIGNMENT',
    "reference_id" TEXT,
    "reference_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_acts" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "delivery_act_id" TEXT NOT NULL,
    "equipment_condition" "EquipmentCondition" NOT NULL,
    "inspection_notes" TEXT,
    "return_date" TIMESTAMP(3) NOT NULL,
    "receiver_info" JSONB NOT NULL,
    "deliverer_info" JSONB NOT NULL,
    "status" "ActStatus" NOT NULL DEFAULT 'PENDING',
    "acceptance_token" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "signature_timestamp" TIMESTAMP(3),
    "signature_ip" TEXT,
    "signature_user_agent" TEXT,
    "verification_hash" TEXT,
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "technician_id" TEXT,
    "requested_by_id" TEXT,
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "parts_replaced" TEXT[],
    "ticket_id" TEXT,
    "notes" TEXT,
    "previous_status" "EquipmentStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "family_id" TEXT,

    CONSTRAINT "license_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_licenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "key" TEXT,
    "purchase_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),
    "cost" DOUBLE PRECISION,
    "vendor" TEXT,
    "notes" TEXT,
    "assigned_to_equipment" TEXT,
    "assigned_to_user" TEXT,
    "assigned_to_department" TEXT,
    "supplier_id" TEXT,
    "renewal_cost" DOUBLE PRECISION,
    "renewal_date" TIMESTAMP(3),
    "invoice_number" VARCHAR(100),
    "purchase_order_number" VARCHAR(100),
    "license_scope" "LicenseScope",
    "contract_type" "ContractType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "software_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumable_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "family_id" TEXT,

    CONSTRAINT "consumable_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumables" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "unit_of_measure_id" TEXT NOT NULL,
    "assigned_equipment_id" TEXT,
    "current_stock" DOUBLE PRECISION NOT NULL,
    "min_stock" DOUBLE PRECISION NOT NULL,
    "max_stock" DOUBLE PRECISION NOT NULL,
    "cost_per_unit" DOUBLE PRECISION,
    "location" TEXT,
    "notes" TEXT,
    "compatible_equipment" TEXT[],
    "supplier_id" TEXT,
    "warehouse_id" TEXT,
    "status" "ConsumableStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiration_date" TIMESTAMP(3),
    "expiry_alert_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consumables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "consumable_id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "user_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "assigned_to_equipment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" "SupplierType" NOT NULL,
    "tax_id" VARCHAR(20),
    "email" VARCHAR(200),
    "phone" VARCHAR(50),
    "address" TEXT,
    "website" TEXT,
    "contact_name" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decommission_requests" (
    "id" TEXT NOT NULL,
    "asset_type" "DecommissionAssetType" NOT NULL,
    "equipment_id" TEXT,
    "license_id" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "condition" "EquipmentCondition",
    "status" "DecommissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decommission_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decommission_attachments" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decommission_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decommission_acts" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "approved_by_id" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decommission_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_counters" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "folio_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "color" VARCHAR(20) DEFAULT '#6B7280',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "location" VARCHAR(200),
    "description" TEXT,
    "manager_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_manager_families" (
    "id" TEXT NOT NULL,
    "manager_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_manager_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_attachments" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "license_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_family_config" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "allowed_subtypes" "AssetSubtype"[],
    "visible_sections" "FormSection"[],
    "required_sections" "FormSection"[],
    "require_financial_for_new" BOOLEAN NOT NULL DEFAULT true,
    "sections_by_mode" JSONB,
    "default_depreciation_method" "DepreciationMethod",
    "default_useful_life_years" DOUBLE PRECISION,
    "default_residual_value_pct" DOUBLE PRECISION,
    "code_prefix" VARCHAR(10),
    "auto_approve_decommission" BOOLEAN NOT NULL DEFAULT false,
    "require_delivery_act" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_family_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_family_config" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "tickets_enabled" BOOLEAN NOT NULL DEFAULT true,
    "code_prefix" VARCHAR(10),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "auto_assign_respects_families" BOOLEAN NOT NULL DEFAULT true,
    "alert_volume_threshold" INTEGER,
    "business_hours_start" VARCHAR(8) NOT NULL DEFAULT '09:00:00',
    "business_hours_end" VARCHAR(8) NOT NULL DEFAULT '18:00:00',
    "business_days" VARCHAR(50) NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_family_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_family_assignments" (
    "id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_family_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_code_counters" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_sequence" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_code_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "attachments_ticketId_createdAt_idx" ON "attachments"("ticketId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "attachments_uploadedBy_createdAt_idx" ON "attachments"("uploadedBy", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "backups_status_createdAt_idx" ON "backups"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "backups_type_status_idx" ON "backups"("type", "status");

-- CreateIndex
CREATE INDEX "categories_departmentId_idx" ON "categories"("departmentId");

-- CreateIndex
CREATE INDEX "categories_parentId_level_isActive_idx" ON "categories"("parentId", "level", "isActive");

-- CreateIndex
CREATE INDEX "categories_name_level_idx" ON "categories"("name", "level");

-- CreateIndex
CREATE INDEX "comments_ticketId_createdAt_idx" ON "comments"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE INDEX "departments_isActive_order_idx" ON "departments"("isActive", "order");

-- CreateIndex
CREATE INDEX "departments_family_id_idx" ON "departments"("family_id");

-- CreateIndex
CREATE INDEX "notifications_ticketId_idx" ON "notifications"("ticketId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "oauth_accounts_provider_providerId_key" ON "oauth_accounts"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_configs_provider_key" ON "oauth_configs"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_isPublished_createdAt_idx" ON "pages"("isPublished", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE UNIQUE INDEX "site_config_key_key" ON "site_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "technician_assignments_categoryId_isActive_autoAssign_idx" ON "technician_assignments"("categoryId", "isActive", "autoAssign");

-- CreateIndex
CREATE INDEX "technician_assignments_technicianId_isActive_idx" ON "technician_assignments"("technicianId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "technician_assignments_technicianId_categoryId_key" ON "technician_assignments"("technicianId", "categoryId");

-- CreateIndex
CREATE INDEX "ticket_history_ticketId_createdAt_idx" ON "ticket_history"("ticketId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_ratings_ticketId_key" ON "ticket_ratings"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_ratings_rating_createdAt_idx" ON "ticket_ratings"("rating", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ticket_ratings_technicianId_createdAt_idx" ON "ticket_ratings"("technicianId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_code_key" ON "tickets"("ticket_code");

-- CreateIndex
CREATE INDEX "tickets_assigneeId_status_idx" ON "tickets"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "tickets_categoryId_status_idx" ON "tickets"("categoryId", "status");

-- CreateIndex
CREATE INDEX "tickets_clientId_createdAt_idx" ON "tickets"("clientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tickets_createdById_idx" ON "tickets"("createdById");

-- CreateIndex
CREATE INDEX "tickets_source_status_idx" ON "tickets"("source", "status");

-- CreateIndex
CREATE INDEX "tickets_status_priority_idx" ON "tickets"("status", "priority");

-- CreateIndex
CREATE INDEX "tickets_title_description_idx" ON "tickets"("title", "description");

-- CreateIndex
CREATE INDEX "tickets_family_id_status_idx" ON "tickets"("family_id", "status");

-- CreateIndex
CREATE INDEX "tickets_ticket_code_idx" ON "tickets"("ticket_code");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "user_settings_userId_idx" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "email_queue_status_scheduledAt_idx" ON "email_queue"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "email_queue_createdAt_idx" ON "email_queue"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "email_queue_toEmail_idx" ON "email_queue"("toEmail");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE INDEX "users_name_email_idx" ON "users"("name", "email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_expiresAt_idx" ON "password_reset_tokens"("token", "expiresAt");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_createdAt_idx" ON "password_reset_tokens"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_sourceTicketId_key" ON "knowledge_articles"("sourceTicketId");

-- CreateIndex
CREATE INDEX "knowledge_articles_categoryId_isPublished_idx" ON "knowledge_articles"("categoryId", "isPublished");

-- CreateIndex
CREATE INDEX "knowledge_articles_authorId_createdAt_idx" ON "knowledge_articles"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "knowledge_articles_views_idx" ON "knowledge_articles"("views" DESC);

-- CreateIndex
CREATE INDEX "knowledge_articles_helpfulVotes_idx" ON "knowledge_articles"("helpfulVotes" DESC);

-- CreateIndex
CREATE INDEX "knowledge_articles_title_content_idx" ON "knowledge_articles"("title", "content");

-- CreateIndex
CREATE INDEX "knowledge_articles_family_id_isPublished_idx" ON "knowledge_articles"("family_id", "isPublished");

-- CreateIndex
CREATE INDEX "article_votes_articleId_isHelpful_idx" ON "article_votes"("articleId", "isHelpful");

-- CreateIndex
CREATE UNIQUE INDEX "article_votes_articleId_userId_key" ON "article_votes"("articleId", "userId");

-- CreateIndex
CREATE INDEX "resolution_plans_ticket_id_idx" ON "resolution_plans"("ticket_id");

-- CreateIndex
CREATE INDEX "resolution_plans_created_by_idx" ON "resolution_plans"("created_by");

-- CreateIndex
CREATE INDEX "resolution_tasks_plan_id_idx" ON "resolution_tasks"("plan_id");

-- CreateIndex
CREATE INDEX "resolution_tasks_assigned_to_idx" ON "resolution_tasks"("assigned_to");

-- CreateIndex
CREATE INDEX "resolution_tasks_start_time_end_time_idx" ON "resolution_tasks"("start_time", "end_time");

-- CreateIndex
CREATE INDEX "ticket_knowledge_articles_ticket_id_idx" ON "ticket_knowledge_articles"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_knowledge_articles_article_id_idx" ON "ticket_knowledge_articles"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_knowledge_articles_ticket_id_article_id_key" ON "ticket_knowledge_articles"("ticket_id", "article_id");

-- CreateIndex
CREATE INDEX "webhooks_is_active_idx" ON "webhooks"("is_active");

-- CreateIndex
CREATE INDEX "webhook_logs_webhook_id_created_at_idx" ON "webhook_logs"("webhook_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "webhook_logs_event_created_at_idx" ON "webhook_logs"("event", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sla_policies_is_active_category_id_priority_idx" ON "sla_policies"("is_active", "category_id", "priority");

-- CreateIndex
CREATE INDEX "sla_policies_is_active_family_id_priority_idx" ON "sla_policies"("is_active", "family_id", "priority");

-- CreateIndex
CREATE INDEX "sla_violations_ticket_id_is_resolved_idx" ON "sla_violations"("ticket_id", "is_resolved");

-- CreateIndex
CREATE INDEX "sla_violations_sla_policy_id_created_at_idx" ON "sla_violations"("sla_policy_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_sla_metrics_ticket_id_key" ON "ticket_sla_metrics"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_sla_metrics_ticket_id_idx" ON "ticket_sla_metrics"("ticket_id");

-- CreateIndex
CREATE INDEX "ticket_sla_metrics_response_deadline_resolution_deadline_idx" ON "ticket_sla_metrics"("response_deadline", "resolution_deadline");

-- CreateIndex
CREATE INDEX "category_analytics_client_id_created_at_idx" ON "category_analytics"("client_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "category_analytics_event_type_created_at_idx" ON "category_analytics"("event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "category_analytics_category_id_created_at_idx" ON "category_analytics"("category_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_code_key" ON "equipment_types"("code");

-- CreateIndex
CREATE INDEX "equipment_types_is_active_order_idx" ON "equipment_types"("is_active", "order");

-- CreateIndex
CREATE INDEX "equipment_types_family_id_idx" ON "equipment_types"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_qr_code_key" ON "equipment"("qr_code");

-- CreateIndex
CREATE INDEX "equipment_code_idx" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_serial_number_idx" ON "equipment"("serial_number");

-- CreateIndex
CREATE INDEX "equipment_type_id_status_idx" ON "equipment"("type_id", "status");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_rental_provider_idx" ON "equipment"("rental_provider");

-- CreateIndex
CREATE INDEX "equipment_rental_end_date_idx" ON "equipment"("rental_end_date");

-- CreateIndex
CREATE INDEX "equipment_attachments_equipment_id_idx" ON "equipment_attachments"("equipment_id");

-- CreateIndex
CREATE INDEX "equipment_assignments_equipment_id_is_active_idx" ON "equipment_assignments"("equipment_id", "is_active");

-- CreateIndex
CREATE INDEX "equipment_assignments_receiver_id_is_active_idx" ON "equipment_assignments"("receiver_id", "is_active");

-- CreateIndex
CREATE INDEX "equipment_assignments_deliverer_id_idx" ON "equipment_assignments"("deliverer_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acts_folio_key" ON "delivery_acts"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acts_assignment_id_key" ON "delivery_acts"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_acts_acceptance_token_key" ON "delivery_acts"("acceptance_token");

-- CreateIndex
CREATE INDEX "delivery_acts_folio_idx" ON "delivery_acts"("folio");

-- CreateIndex
CREATE INDEX "delivery_acts_status_expiration_date_idx" ON "delivery_acts"("status", "expiration_date");

-- CreateIndex
CREATE INDEX "delivery_acts_acceptance_token_idx" ON "delivery_acts"("acceptance_token");

-- CreateIndex
CREATE UNIQUE INDEX "return_acts_folio_key" ON "return_acts"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "return_acts_assignment_id_key" ON "return_acts"("assignment_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_acts_acceptance_token_key" ON "return_acts"("acceptance_token");

-- CreateIndex
CREATE INDEX "return_acts_folio_idx" ON "return_acts"("folio");

-- CreateIndex
CREATE INDEX "return_acts_status_expiration_date_idx" ON "return_acts"("status", "expiration_date");

-- CreateIndex
CREATE INDEX "return_acts_acceptance_token_idx" ON "return_acts"("acceptance_token");

-- CreateIndex
CREATE INDEX "maintenance_records_equipment_id_date_idx" ON "maintenance_records"("equipment_id", "date");

-- CreateIndex
CREATE INDEX "maintenance_records_technician_id_idx" ON "maintenance_records"("technician_id");

-- CreateIndex
CREATE INDEX "maintenance_records_ticket_id_idx" ON "maintenance_records"("ticket_id");

-- CreateIndex
CREATE INDEX "maintenance_records_status_idx" ON "maintenance_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "license_types_code_key" ON "license_types"("code");

-- CreateIndex
CREATE INDEX "license_types_is_active_order_idx" ON "license_types"("is_active", "order");

-- CreateIndex
CREATE INDEX "license_types_family_id_idx" ON "license_types"("family_id");

-- CreateIndex
CREATE INDEX "software_licenses_type_id_expiration_date_idx" ON "software_licenses"("type_id", "expiration_date");

-- CreateIndex
CREATE INDEX "software_licenses_assigned_to_equipment_idx" ON "software_licenses"("assigned_to_equipment");

-- CreateIndex
CREATE INDEX "software_licenses_assigned_to_user_idx" ON "software_licenses"("assigned_to_user");

-- CreateIndex
CREATE INDEX "software_licenses_assigned_to_department_idx" ON "software_licenses"("assigned_to_department");

-- CreateIndex
CREATE UNIQUE INDEX "consumable_types_code_key" ON "consumable_types"("code");

-- CreateIndex
CREATE INDEX "consumable_types_is_active_order_idx" ON "consumable_types"("is_active", "order");

-- CreateIndex
CREATE INDEX "consumable_types_family_id_idx" ON "consumable_types"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_code_key" ON "units_of_measure"("code");

-- CreateIndex
CREATE INDEX "units_of_measure_is_active_order_idx" ON "units_of_measure"("is_active", "order");

-- CreateIndex
CREATE INDEX "consumables_type_id_current_stock_idx" ON "consumables"("type_id", "current_stock");

-- CreateIndex
CREATE INDEX "consumables_unit_of_measure_id_idx" ON "consumables"("unit_of_measure_id");

-- CreateIndex
CREATE INDEX "consumables_assigned_equipment_id_idx" ON "consumables"("assigned_equipment_id");

-- CreateIndex
CREATE INDEX "stock_movements_consumable_id_created_at_idx" ON "stock_movements"("consumable_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_user_id_idx" ON "stock_movements"("user_id");

-- CreateIndex
CREATE INDEX "stock_movements_assigned_to_user_id_idx" ON "stock_movements"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "stock_movements_assigned_to_equipment_id_idx" ON "stock_movements"("assigned_to_equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_tax_id_key" ON "suppliers"("tax_id");

-- CreateIndex
CREATE INDEX "suppliers_type_is_active_idx" ON "suppliers"("type", "is_active");

-- CreateIndex
CREATE INDEX "suppliers_name_idx" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "decommission_requests_status_created_at_idx" ON "decommission_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "decommission_requests_requested_by_id_idx" ON "decommission_requests"("requested_by_id");

-- CreateIndex
CREATE INDEX "decommission_requests_equipment_id_idx" ON "decommission_requests"("equipment_id");

-- CreateIndex
CREATE INDEX "decommission_requests_license_id_idx" ON "decommission_requests"("license_id");

-- CreateIndex
CREATE INDEX "decommission_attachments_request_id_idx" ON "decommission_attachments"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "decommission_acts_folio_key" ON "decommission_acts"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "decommission_acts_request_id_key" ON "decommission_acts"("request_id");

-- CreateIndex
CREATE INDEX "decommission_acts_folio_idx" ON "decommission_acts"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "folio_counters_year_type_key" ON "folio_counters"("year", "type");

-- CreateIndex
CREATE UNIQUE INDEX "families_code_key" ON "families"("code");

-- CreateIndex
CREATE INDEX "families_is_active_order_idx" ON "families"("is_active", "order");

-- CreateIndex
CREATE INDEX "warehouses_is_active_idx" ON "warehouses"("is_active");

-- CreateIndex
CREATE INDEX "inventory_manager_families_manager_id_idx" ON "inventory_manager_families"("manager_id");

-- CreateIndex
CREATE INDEX "inventory_manager_families_family_id_idx" ON "inventory_manager_families"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_manager_families_manager_id_family_id_key" ON "inventory_manager_families"("manager_id", "family_id");

-- CreateIndex
CREATE INDEX "license_attachments_license_id_idx" ON "license_attachments"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_family_config_family_id_key" ON "inventory_family_config"("family_id");

-- CreateIndex
CREATE INDEX "inventory_family_config_family_id_idx" ON "inventory_family_config"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_family_config_family_id_key" ON "ticket_family_config"("family_id");

-- CreateIndex
CREATE INDEX "ticket_family_config_family_id_idx" ON "ticket_family_config"("family_id");

-- CreateIndex
CREATE INDEX "ticket_family_config_tickets_enabled_idx" ON "ticket_family_config"("tickets_enabled");

-- CreateIndex
CREATE INDEX "technician_family_assignments_technician_id_is_active_idx" ON "technician_family_assignments"("technician_id", "is_active");

-- CreateIndex
CREATE INDEX "technician_family_assignments_family_id_is_active_idx" ON "technician_family_assignments"("family_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "technician_family_assignments_technician_id_family_id_key" ON "technician_family_assignments"("technician_id", "family_id");

-- CreateIndex
CREATE INDEX "ticket_code_counters_family_id_year_idx" ON "ticket_code_counters"("family_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_code_counters_family_id_year_key" ON "ticket_code_counters"("family_id", "year");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_assignments" ADD CONSTRAINT "technician_assignments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_assignments" ADD CONSTRAINT "technician_assignments_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_ratings" ADD CONSTRAINT "ticket_ratings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_ratings" ADD CONSTRAINT "ticket_ratings_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_ratings" ADD CONSTRAINT "ticket_ratings_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_votes" ADD CONSTRAINT "article_votes_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_votes" ADD CONSTRAINT "article_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_plans" ADD CONSTRAINT "resolution_plans_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_plans" ADD CONSTRAINT "resolution_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_tasks" ADD CONSTRAINT "resolution_tasks_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "resolution_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolution_tasks" ADD CONSTRAINT "resolution_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_knowledge_articles" ADD CONSTRAINT "ticket_knowledge_articles_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_knowledge_articles" ADD CONSTRAINT "ticket_knowledge_articles_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_knowledge_articles" ADD CONSTRAINT "ticket_knowledge_articles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_violations" ADD CONSTRAINT "sla_violations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_violations" ADD CONSTRAINT "sla_violations_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_metrics" ADD CONSTRAINT "ticket_sla_metrics_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_metrics" ADD CONSTRAINT "ticket_sla_metrics_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "software_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_attachments" ADD CONSTRAINT "equipment_attachments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_attachments" ADD CONSTRAINT "equipment_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_deliverer_id_fkey" FOREIGN KEY ("deliverer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_acts" ADD CONSTRAINT "delivery_acts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "equipment_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_acts" ADD CONSTRAINT "return_acts_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "equipment_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_types" ADD CONSTRAINT "license_types_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "license_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_assigned_to_equipment_fkey" FOREIGN KEY ("assigned_to_equipment") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_assigned_to_user_fkey" FOREIGN KEY ("assigned_to_user") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_assigned_to_department_fkey" FOREIGN KEY ("assigned_to_department") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_licenses" ADD CONSTRAINT "software_licenses_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumable_types" ADD CONSTRAINT "consumable_types_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "consumable_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_unit_of_measure_id_fkey" FOREIGN KEY ("unit_of_measure_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_assigned_equipment_id_fkey" FOREIGN KEY ("assigned_equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumables" ADD CONSTRAINT "consumables_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_consumable_id_fkey" FOREIGN KEY ("consumable_id") REFERENCES "consumables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_assigned_to_equipment_id_fkey" FOREIGN KEY ("assigned_to_equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_requests" ADD CONSTRAINT "decommission_requests_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_requests" ADD CONSTRAINT "decommission_requests_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "software_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_requests" ADD CONSTRAINT "decommission_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_requests" ADD CONSTRAINT "decommission_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_attachments" ADD CONSTRAINT "decommission_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "decommission_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_attachments" ADD CONSTRAINT "decommission_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_acts" ADD CONSTRAINT "decommission_acts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "decommission_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decommission_acts" ADD CONSTRAINT "decommission_acts_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_manager_families" ADD CONSTRAINT "inventory_manager_families_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_manager_families" ADD CONSTRAINT "inventory_manager_families_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_attachments" ADD CONSTRAINT "license_attachments_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "software_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_attachments" ADD CONSTRAINT "license_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_family_config" ADD CONSTRAINT "inventory_family_config_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_family_config" ADD CONSTRAINT "ticket_family_config_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_family_assignments" ADD CONSTRAINT "technician_family_assignments_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_family_assignments" ADD CONSTRAINT "technician_family_assignments_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_code_counters" ADD CONSTRAINT "ticket_code_counters_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

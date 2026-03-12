-- CreateTable
CREATE TABLE "landing_page_content" (
    "id" TEXT NOT NULL,
    "hero_title" TEXT NOT NULL DEFAULT 'Soporte Técnico Profesional',
    "hero_subtitle" TEXT NOT NULL DEFAULT 'Resolvemos tus problemas técnicos de manera rápida y eficiente',
    "hero_cta_primary" TEXT NOT NULL DEFAULT 'Crear Ticket de Soporte',
    "hero_cta_secondary" TEXT NOT NULL DEFAULT 'Ver Servicios',
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
    "primary_color" TEXT NOT NULL DEFAULT '#2563eb',
    "secondary_color" TEXT NOT NULL DEFAULT '#3b82f6',
    "accent_color" TEXT NOT NULL DEFAULT '#1e40af',
    "primary_color_dark" TEXT NOT NULL DEFAULT '#3b82f6',
    "secondary_color_dark" TEXT NOT NULL DEFAULT '#60a5fa',
    "accent_color_dark" TEXT NOT NULL DEFAULT '#2563eb',
    "support_dark_mode" BOOLEAN NOT NULL DEFAULT true,
    "auto_theme" BOOLEAN NOT NULL DEFAULT true,
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

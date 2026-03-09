/**
 * Tipos TypeScript para el módulo de selección de categorías
 */

/**
 * Categoría del sistema
 */
export interface Category {
  id: string;
  name: string;
  description: string | null;
  level: number; // 1-4
  parentId: string | null;
  departmentId: string | null;
  order: number;
  color: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Relaciones opcionales
  children?: Category[];
  parent?: Category;
}

/**
 * Resultado de búsqueda de categorías
 */
export interface SearchResult {
  category: Category;
  path: Category[]; // Ruta completa desde nivel 1
  matchedFields: string[]; // Campos donde hubo coincidencia
  score: number; // Relevancia (0-1)
}

/**
 * Sugerencia de categoría basada en análisis de texto
 */
export interface Suggestion {
  category: Category;
  path: Category[];
  relevanceScore: number; // 0-1
  matchedKeywords: string[];
  reason: string; // Explicación de por qué se sugiere
}

/**
 * Metadata contextual de una categoría
 */
export interface CategoryMetadata {
  categoryId: string;
  departmentName: string;
  departmentColor: string;
  averageResponseTimeHours: number | null;
  assignedTechniciansCount: number;
  recentTicketsCount: number; // Últimos 30 días
  popularityScore: number; // 0-100
}

/**
 * Índice de búsqueda optimizado (en memoria)
 */
export interface CategorySearchIndex {
  id: string;
  name: string;
  description: string;
  level: number;
  parentId: string | null;
  path: string; // "Nivel1 > Nivel2 > Nivel3"
  pathIds: string[]; // IDs de la ruta completa
  keywords: string[]; // Palabras clave extraídas
  searchableText: string; // Texto normalizado para búsqueda
  color: string;
}

/**
 * Categoría frecuente del usuario
 */
export interface FrequentCategory {
  category: Category;
  path: Category[];
  usageCount: number;
  lastUsed: Date;
}

/**
 * Evento de analytics para el selector de categorías
 */
export interface CategoryAnalyticsEvent {
  eventType: 'search' | 'suggestion_click' | 'manual_select' | 'frequent_select' | 'category_change';
  clientId: string;
  categoryId?: string;
  searchQuery?: string;
  timeToSelect: number; // Milisegundos desde que abrió el selector
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Artículo de la base de conocimientos
 */
export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  summary: string | null;
  categoryId: string;
  tags: string[];
  views: number;
  helpfulVotes: number;
  notHelpfulVotes: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Artículo relacionado con relevancia calculada
 */
export interface RelatedArticle {
  article: KnowledgeArticle;
  relevanceScore: number; // 0-1
  matchReason: string; // Explicación de por qué es relevante
}

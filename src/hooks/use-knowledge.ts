import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface Article {
  id: string
  title: string
  summary: string
  content: string
  categoryId: string
  tags: string[]
  sourceTicketId?: string
  authorId: string
  familyId?: string | null
  views: number
  helpfulVotes: number
  notHelpfulVotes: number
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  category?: {
    id: string
    name: string
    color: string
  }
  author?: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  family?: {
    id: string
    name: string
    code: string
    color?: string | null
  } | null
  sourceTicket?: {
    id: string
    title: string
    status: string
  }
  helpfulPercentage?: number
  userVote?: boolean | null
}

export interface CreateArticleData {
  title: string
  content: string
  summary?: string
  categoryId: string
  tags: string[]
  sourceTicketId?: string
}

export interface UpdateArticleData {
  title?: string
  content?: string
  summary?: string
  categoryId?: string
  tags?: string[]
  isPublished?: boolean
}

export interface SearchFilters {
  search?: string
  categoryId?: string
  tags?: string[]
  authorId?: string
  sortBy?: 'views' | 'helpful' | 'recent'
  page?: number
  limit?: number
}

export interface SimilarQuery {
  title: string
  description?: string
  categoryId?: string
  limit?: number
}

export function useKnowledge() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchArticles = useCallback(async (filters: SearchFilters = {}): Promise<Article[]> => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      
      if (filters.search) params.append('search', filters.search)
      if (filters.categoryId) params.append('categoryId', filters.categoryId)
      if (filters.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','))
      if (filters.authorId) params.append('authorId', filters.authorId)
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.page) params.append('page', filters.page.toString())
      if (filters.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`/api/knowledge?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Error al buscar artículos')
      }

      const result = await response.json()
      return result.data || result.articles || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const getArticle = useCallback(async (id: string): Promise<Article | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/knowledge/${id}`)
      
      if (!response.ok) {
        throw new Error('Error al obtener artículo')
      }

      const article = await response.json()
      return article
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const createArticle = useCallback(async (data: CreateArticleData): Promise<Article | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear artículo')
      }

      const article = await response.json()
      return article
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const updateArticle = useCallback(async (id: string, data: UpdateArticleData): Promise<Article | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al actualizar artículo')
      }

      const article = await response.json()
      return article
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteArticle = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/knowledge/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al eliminar artículo')
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const voteArticle = useCallback(async (id: string, isHelpful: boolean): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/knowledge/${id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isHelpful }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al votar artículo')
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const removeVote = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/knowledge/${id}/vote`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al eliminar voto')
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const getSimilar = useCallback(async (query: SimilarQuery): Promise<Article[]> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/knowledge/similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      })

      if (!response.ok) {
        throw new Error('Error al buscar artículos similares')
      }

      const data = await response.json()
      return data.articles || []
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const createFromTicket = useCallback(async (
    ticketId: string,
    data: Omit<CreateArticleData, 'categoryId' | 'sourceTicketId'>
  ): Promise<Article | null> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tickets/${ticketId}/create-article`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        // Si ya existe un artículo (409), retornar el ID del artículo existente
        if (response.status === 409 && result.articleId) {
          setError('Ya existe un artículo creado desde este ticket')
          return { id: result.articleId } as Article
        }
        
        throw new Error(result.error || 'Error al crear artículo desde ticket')
      }

      return result.article
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const getTicketSuggestions = useCallback(async (ticketId: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/tickets/${ticketId}/create-article`)
      
      if (!response.ok) {
        throw new Error('Error al obtener sugerencias')
      }

      const data = await response.json()
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      setError(message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    searchArticles,
    getArticle,
    createArticle,
    updateArticle,
    deleteArticle,
    voteArticle,
    removeVote,
    getSimilar,
    createFromTicket,
    getTicketSuggestions,
  }
}

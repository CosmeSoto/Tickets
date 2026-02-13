/**
 * Empty States Components Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { 
  EmptyState,
  NoTickets,
  NoSearchResults,
  NoComments,
  NoAttachments,
  NoUsers,
  EmptyCard
} from '@/components/ui/empty-states'

describe('EmptyState', () => {
  it('renders empty state with default content', () => {
    render(<EmptyState />)
    expect(screen.getByText('No hay elementos')).toBeInTheDocument()
    expect(screen.getByText('No se encontraron elementos para mostrar.')).toBeInTheDocument()
  })

  it('renders custom title and description', () => {
    render(
      <EmptyState 
        title="Custom Title" 
        description="Custom description text" 
      />
    )
    expect(screen.getByText('Custom Title')).toBeInTheDocument()
    expect(screen.getByText('Custom description text')).toBeInTheDocument()
  })

  it('renders custom icon', () => {
    const customIcon = <div data-testid="custom-icon">Custom Icon</div>
    render(<EmptyState icon={customIcon} />)
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    const actions = <button>Custom Action</button>
    render(<EmptyState actions={actions} />)
    expect(screen.getByText('Custom Action')).toBeInTheDocument()
  })

  it('applies variant styles correctly', () => {
    const { rerender } = render(<EmptyState variant="default" />)
    let container = screen.getByText('No hay elementos').parentElement?.parentElement
    expect(container).toHaveClass('border-2', 'border-dashed')
    
    rerender(<EmptyState variant="subtle" />)
    container = screen.getByText('No hay elementos').parentElement?.parentElement
    expect(container).not.toHaveClass('border-2', 'border-dashed')
  })
})

describe('NoTickets', () => {
  it('renders no tickets message', () => {
    render(<NoTickets />)
    expect(screen.getByText('No hay tickets')).toBeInTheDocument()
    expect(screen.getByText(/No se han creado tickets aún/)).toBeInTheDocument()
  })

  it('renders create ticket button when canCreate is true and onCreateTicket provided', () => {
    const onCreateTicket = jest.fn()
    render(<NoTickets onCreateTicket={onCreateTicket} canCreate={true} />)
    
    const createButton = screen.getByText('Crear Ticket')
    expect(createButton).toBeInTheDocument()
    
    fireEvent.click(createButton)
    expect(onCreateTicket).toHaveBeenCalledTimes(1)
  })

  it('does not render create button when canCreate is false', () => {
    const onCreateTicket = jest.fn()
    render(<NoTickets onCreateTicket={onCreateTicket} canCreate={false} />)
    expect(screen.queryByText('Crear Ticket')).not.toBeInTheDocument()
  })

  it('does not render create button when onCreateTicket not provided', () => {
    render(<NoTickets canCreate={true} />)
    expect(screen.queryByText('Crear Ticket')).not.toBeInTheDocument()
  })
})

describe('NoSearchResults', () => {
  it('renders no search results message', () => {
    render(<NoSearchResults />)
    expect(screen.getByText('No se encontraron resultados')).toBeInTheDocument()
  })

  it('includes search term in message when provided', () => {
    render(<NoSearchResults searchTerm="test query" />)
    expect(screen.getByText(/No se encontraron resultados para "test query"/)).toBeInTheDocument()
  })

  it('renders clear search button when onClearSearch provided', () => {
    const onClearSearch = jest.fn()
    render(<NoSearchResults onClearSearch={onClearSearch} />)
    
    const clearButton = screen.getByText('Limpiar búsqueda')
    expect(clearButton).toBeInTheDocument()
    
    fireEvent.click(clearButton)
    expect(onClearSearch).toHaveBeenCalledTimes(1)
  })
})

describe('NoComments', () => {
  it('renders no comments message', () => {
    render(<NoComments />)
    expect(screen.getByText('No hay comentarios')).toBeInTheDocument()
    expect(screen.getByText(/Sé el primero en agregar un comentario/)).toBeInTheDocument()
  })

  it('renders add comment button when onAddComment provided', () => {
    const onAddComment = jest.fn()
    render(<NoComments onAddComment={onAddComment} />)
    
    const addButton = screen.getByText('Agregar comentario')
    expect(addButton).toBeInTheDocument()
    
    fireEvent.click(addButton)
    expect(onAddComment).toHaveBeenCalledTimes(1)
  })

  it('uses subtle variant', () => {
    render(<NoComments />)
    const container = screen.getByText('No hay comentarios').parentElement?.parentElement
    expect(container).toHaveClass('p-8', 'text-center')
    expect(container).not.toHaveClass('border-2', 'border-dashed')
  })
})

describe('NoAttachments', () => {
  it('renders no attachments message', () => {
    render(<NoAttachments />)
    expect(screen.getByText('No hay archivos adjuntos')).toBeInTheDocument()
    expect(screen.getByText(/No se han subido archivos/)).toBeInTheDocument()
  })

  it('renders upload button when onAddAttachment provided', () => {
    const onAddAttachment = jest.fn()
    render(<NoAttachments onAddAttachment={onAddAttachment} />)
    
    const uploadButton = screen.getByText('Subir archivo')
    expect(uploadButton).toBeInTheDocument()
    
    fireEvent.click(uploadButton)
    expect(onAddAttachment).toHaveBeenCalledTimes(1)
  })
})

describe('NoUsers', () => {
  it('renders no users message', () => {
    render(<NoUsers />)
    expect(screen.getByText('No hay usuarios')).toBeInTheDocument()
    expect(screen.getByText(/No se han registrado usuarios/)).toBeInTheDocument()
  })

  it('renders invite button when canInvite is true and onInviteUser provided', () => {
    const onInviteUser = jest.fn()
    render(<NoUsers onInviteUser={onInviteUser} canInvite={true} />)
    
    const inviteButton = screen.getByText('Invitar usuario')
    expect(inviteButton).toBeInTheDocument()
    
    fireEvent.click(inviteButton)
    expect(onInviteUser).toHaveBeenCalledTimes(1)
  })

  it('does not render invite button when canInvite is false', () => {
    const onInviteUser = jest.fn()
    render(<NoUsers onInviteUser={onInviteUser} canInvite={false} />)
    expect(screen.queryByText('Invitar usuario')).not.toBeInTheDocument()
  })
})

describe('EmptyCard', () => {
  it('renders empty card with default content', () => {
    render(<EmptyCard />)
    expect(screen.getByText('Sin contenido')).toBeInTheDocument()
    expect(screen.getByText('No hay información para mostrar.')).toBeInTheDocument()
  })

  it('renders custom title and description', () => {
    render(
      <EmptyCard 
        title="Custom Card Title" 
        description="Custom card description" 
      />
    )
    expect(screen.getByText('Custom Card Title')).toBeInTheDocument()
    expect(screen.getByText('Custom card description')).toBeInTheDocument()
  })

  it('renders custom icon', () => {
    const customIcon = <div data-testid="card-icon">Card Icon</div>
    render(<EmptyCard icon={customIcon} />)
    expect(screen.getByTestId('card-icon')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    const actions = <button>Card Action</button>
    render(<EmptyCard actions={actions} />)
    expect(screen.getByText('Card Action')).toBeInTheDocument()
  })

  it('uses card structure', () => {
    render(<EmptyCard />)
    const card = screen.getByText('Sin contenido').closest('[class*="rounded-lg"]')
    expect(card).toBeInTheDocument()
  })
})
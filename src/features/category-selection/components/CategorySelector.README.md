# CategorySelector Component

El componente principal que orquesta toda la experiencia de selección de categorías.

## Descripción

`CategorySelector` es el componente contenedor que integra todos los sub-componentes del módulo de selección de categorías:

- **SearchBar**: Búsqueda inteligente con fuzzy matching
- **SuggestionEngine**: Sugerencias contextuales basadas en el título y descripción del ticket
- **CategoryTree**: Navegación jerárquica completa
- **StepByStepNavigator**: Navegación guiada paso a paso
- **FrequentCategories**: Categorías más usadas por el cliente
- **ConfirmationPanel**: Panel de confirmación con información contextual
- **RelatedArticles**: Artículos de la base de conocimientos relacionados
- **KnowledgeBaseSearch**: Búsqueda directa en la base de conocimientos

## Características Principales

### 1. Múltiples Métodos de Selección

El componente ofrece varios métodos para que el usuario encuentre la categoría correcta:

- **Búsqueda**: Búsqueda fuzzy en tiempo real
- **Sugerencias**: Análisis automático del texto del ticket
- **Navegación Manual**: Vista completa o paso a paso
- **Categorías Frecuentes**: Acceso rápido a categorías usadas anteriormente
- **Artículos**: Selección basada en artículos de conocimiento

### 2. Indicador de Confianza

Calcula y muestra un indicador de confianza basado en la coincidencia entre el texto del ticket y la categoría seleccionada:

- **Alta confianza (≥80%)**: Verde - La categoría parece muy apropiada
- **Confianza media (60-79%)**: Azul - La categoría podría ser apropiada
- **Confianza baja (<60%)**: Ámbar - Sugiere revisar la selección

### 3. Analytics Integrado

Registra automáticamente eventos de interacción para análisis:

- Búsquedas realizadas
- Método de selección usado
- Tiempo de selección
- Cambios de categoría
- Búsquedas sin resultados
- Interacciones con artículos

### 4. Validación y Retroalimentación

- Validación de selección requerida
- Mensajes de error claros
- Información contextual de la categoría
- Estadísticas y metadata

## Props

```typescript
interface CategorySelectorProps {
  value?: string;              // ID de categoría seleccionada
  onChange: (categoryId: string) => void;
  ticketTitle?: string;        // Para sugerencias contextuales
  ticketDescription?: string;  // Para sugerencias contextuales
  clientId: string;            // Para categorías frecuentes
  categories: Category[];      // Lista de categorías activas
  error?: string;              // Mensaje de error
  disabled?: boolean;          // Deshabilitar el selector
  className?: string;          // Clases CSS adicionales
}
```

## Uso Básico

```tsx
import { CategorySelector } from '@/features/category-selection';

function CreateTicketForm() {
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Fetch categories from API
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  return (
    <form>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título del ticket"
      />
      
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción del problema"
      />
      
      <CategorySelector
        value={selectedCategory}
        onChange={setSelectedCategory}
        ticketTitle={title}
        ticketDescription={description}
        clientId={currentUser.id}
        categories={categories || []}
        error={errors.category}
      />
      
      <button type="submit">Crear Ticket</button>
    </form>
  );
}
```

## Uso con React Hook Form

```tsx
import { Controller } from 'react-hook-form';
import { CategorySelector } from '@/features/category-selection';

function CreateTicketForm() {
  const { control, watch } = useForm();
  const title = watch('title');
  const description = watch('description');

  return (
    <form>
      <Controller
        name="categoryId"
        control={control}
        rules={{ required: 'Debes seleccionar una categoría' }}
        render={({ field, fieldState }) => (
          <CategorySelector
            value={field.value}
            onChange={field.onChange}
            ticketTitle={title}
            ticketDescription={description}
            clientId={currentUser.id}
            categories={categories}
            error={fieldState.error?.message}
          />
        )}
      />
    </form>
  );
}
```

## Flujo de Interacción

1. **Inicio**: El usuario ve el campo de búsqueda y las categorías frecuentes (si existen)
2. **Sugerencias**: Si hay título/descripción, se muestran sugerencias automáticas
3. **Selección**: El usuario puede:
   - Buscar y seleccionar de los resultados
   - Hacer clic en una sugerencia
   - Navegar manualmente (vista completa o paso a paso)
   - Seleccionar una categoría frecuente
   - Buscar en la base de conocimientos
4. **Confirmación**: Se muestra el panel de confirmación con:
   - Indicador de confianza
   - Información de la categoría
   - Artículos relacionados
   - Opción para cambiar la selección
5. **Envío**: El formulario puede ser enviado con la categoría confirmada

## Estado Interno

El componente maneja internamente:

- `selectedPath`: Ruta completa de IDs desde nivel 1 hasta la categoría seleccionada
- `mode`: Modo de navegación ('full' o 'stepByStep')
- `searchQuery`: Query de búsqueda actual
- `showConfirmation`: Si se muestra el panel de confirmación
- `selectionStartTime`: Timestamp para calcular tiempo de selección
- `interactionMethod`: Método usado para la selección

## Integración con APIs

El componente hace llamadas a los siguientes endpoints:

- `GET /api/categories/metadata/:categoryId` - Obtener metadata de categoría
- `POST /api/analytics/category-selection` - Registrar eventos de analytics
- `GET /api/categories/frequent` - Obtener categorías frecuentes (via hook)
- `GET /api/knowledge-articles/related` - Obtener artículos relacionados (via sub-componente)

## Accesibilidad

- Navegación completa por teclado
- Etiquetas ARIA apropiadas
- Anuncios para lectores de pantalla
- Indicadores de foco visibles
- Contraste de color WCAG 2.1 AA

## Requisitos Cubiertos

- 11.1: Compatibilidad con estructura de datos existente
- 11.2: Funciona con categorías actuales sin cambios en DB
- 11.6: Mantiene comportamiento de validación existente
- 6.3: Indicador de confianza
- 6.7: Validación de selección requerida
- 6.8: Resaltado visual de errores
- 6.10: Advertencia para confianza baja
- 10.1-10.5: Sistema de analytics completo

## Notas de Implementación

- El componente requiere `QueryClientProvider` de React Query
- Las categorías deben estar pre-cargadas y pasadas como prop
- El `clientId` es requerido para categorías frecuentes y analytics
- Los eventos de analytics se envían de forma asíncrona sin bloquear la UI
- El metadata de categoría se carga bajo demanda al seleccionar

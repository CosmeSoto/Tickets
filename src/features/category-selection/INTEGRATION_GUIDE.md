# Category Selector Integration Guide

## Overview

This guide explains how to integrate the enhanced Category Selector into your ticket creation forms and other components.

## Quick Start

### Basic Integration

The simplest way to integrate the Category Selector is using the `CategorySelectorWrapper` component:

```tsx
import { CategorySelectorWrapper } from '@/features/category-selection';
import { useSession } from 'next-auth/react';

function TicketForm() {
  const { data: session } = useSession();
  const [categoryId, setCategoryId] = useState('');
  const [categoryError, setCategoryError] = useState('');

  return (
    <div>
      <Label>Categoría *</Label>
      <CategorySelectorWrapper
        value={categoryId}
        onChange={setCategoryId}
        ticketTitle={ticketTitle}
        ticketDescription={ticketDescription}
        clientId={session?.user?.id}
        error={categoryError}
        disabled={false}
      />
    </div>
  );
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `string` | No | Currently selected category ID |
| `onChange` | `(categoryId: string) => void` | Yes | Callback when category is selected |
| `ticketTitle` | `string` | No | Ticket title for contextual suggestions |
| `ticketDescription` | `string` | No | Ticket description for contextual suggestions |
| `clientId` | `string` | No | User ID for frequent categories |
| `error` | `string` | No | Error message to display |
| `disabled` | `boolean` | No | Disable the selector |

## Feature Flags

The Category Selector uses feature flags for gradual rollout and A/B testing.

### Available Flags

- `enhanced_category_selector` - Main flag to enable/disable the enhanced selector
- `category_smart_search` - Enable fuzzy search
- `category_suggestions` - Enable contextual suggestions
- `category_frequent` - Show frequently used categories
- `category_step_by_step` - Enable step-by-step navigation mode
- `category_knowledge_base` - Show related knowledge base articles
- `category_visual_enhancements` - Enable icons, colors, breadcrumbs
- `category_analytics` - Track user interactions

### Configuring Flags

Feature flags are automatically initialized when the component mounts. To manually configure:

```typescript
import { initializeCategorySelectorFlags, featureFlagsService } from '@/features/category-selection';

// Initialize default flags
initializeCategorySelectorFlags();

// Customize a specific flag
featureFlagsService.setFlag({
  id: 'enhanced_category_selector',
  name: 'Enhanced Category Selector',
  description: 'Enable the new enhanced category selector',
  enabled: true,
  rolloutPercentage: 50, // Gradual rollout to 50% of users
  conditions: [],
  variants: [],
}, 'admin');
```

### Checking Flags in Components

```typescript
import { useCategorySelectorFeatureFlags } from '@/features/category-selection';

function MyComponent() {
  const flags = useCategorySelectorFeatureFlags();
  
  if (flags.smartSearch) {
    // Smart search is enabled
  }
  
  if (flags.fallbackMode) {
    // Browser doesn't support enhanced features
  }
}
```

## Browser Compatibility

The Category Selector automatically detects browser capabilities and falls back to a simple cascading selector for unsupported browsers.

### Required Capabilities

- ES6 support (Promises, Symbols)
- CSS Flexbox
- IntersectionObserver API

### Fallback Mode

When the browser doesn't support required features, the selector automatically switches to a simple cascading dropdown interface that maintains full functionality.

## Validation

The wrapper component doesn't include validation logic. You should validate the category selection in your form:

```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!categoryId) {
    setCategoryError('Por favor selecciona una categoría para el ticket');
    return;
  }
  
  // Submit form
};
```

## API Compatibility

The Category Selector maintains full compatibility with the existing categories API:

- Uses existing `/api/categories` endpoint
- Works with the current 4-level hierarchy
- No database schema changes required
- Backward compatible with old category IDs

### Expected API Response

```typescript
{
  success: boolean;
  data: {
    categories: Array<{
      id: string;
      name: string;
      description: string | null;
      level: number;
      parentId: string | null;
      color: string;
      isActive: boolean;
      // ... other fields
    }>;
  };
}
```

## Analytics

The Category Selector automatically tracks user interactions when the analytics feature flag is enabled:

- Search queries
- Suggestion clicks
- Manual selections
- Frequent category usage
- Time to select
- Category changes

Analytics events are sent to `/api/analytics/category-selection` endpoint.

## Accessibility

The Category Selector is fully accessible:

- WCAG 2.1 AA compliant
- Full keyboard navigation (Tab, Enter, Escape, Arrow keys)
- Screen reader support with ARIA labels
- Keyboard shortcut: `Ctrl+K` / `Cmd+K` to focus search
- High contrast mode support
- Minimum touch target sizes (44x44px)

## Performance

The selector is optimized for performance:

- Categories cached with React Query
- Debounced search (500ms)
- Virtualized lists for large category sets
- Lazy loading of knowledge base articles
- < 500ms initial load time
- < 200ms search response time

## Troubleshooting

### Categories not loading

Check that:
1. `/api/categories` endpoint is accessible
2. User has proper authentication
3. Categories are marked as `isActive: true`

### Feature flags not working

Ensure:
1. Feature flags are initialized: `initializeCategorySelectorFlags()`
2. Feature flags service is properly imported
3. Check browser console for errors

### Fallback mode always active

This means:
1. Browser doesn't support required features, OR
2. `enhanced_category_selector` flag is disabled

Check browser capabilities:
```typescript
import { detectBrowserCapabilities } from '@/features/category-selection';

const capabilities = detectBrowserCapabilities();
console.log(capabilities);
```

## Migration from Old Selector

If you're migrating from the old category selector:

1. Replace the old selector component with `CategorySelectorWrapper`
2. Change `category` prop to `categoryId` in your form state
3. Update validation to check `categoryId` instead of `category`
4. Remove any custom category loading logic (handled by wrapper)
5. Test with feature flag disabled to ensure fallback works

### Before

```tsx
<Select value={formData.category} onValueChange={(value) => handleChange('category', value)}>
  <SelectTrigger>
    <SelectValue placeholder="Selecciona la categoría" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="technical">Técnico</SelectItem>
    {/* ... */}
  </SelectContent>
</Select>
```

### After

```tsx
<CategorySelectorWrapper
  value={formData.categoryId}
  onChange={handleCategoryChange}
  ticketTitle={formData.title}
  ticketDescription={formData.description}
  clientId={session?.user?.id}
  error={categoryError}
/>
```

## Advanced Usage

### Direct Component Usage

If you need more control, you can use the `CategorySelector` component directly:

```tsx
import { CategorySelector } from '@/features/category-selection';
import { useCategoriesQuery } from '@/features/category-selection/hooks';

function MyForm() {
  const { categories, isLoading } = useCategoriesQuery();
  
  if (isLoading) return <Spinner />;
  
  return (
    <CategorySelector
      value={categoryId}
      onChange={setCategoryId}
      categories={categories}
      ticketTitle={title}
      ticketDescription={description}
      clientId={userId}
    />
  );
}
```

### Custom Feature Flag Context

```typescript
import { getCategorySelectorConfig } from '@/features/category-selection';

const config = getCategorySelectorConfig(userId, userRole);

if (config.useEnhancedSelector) {
  // Use enhanced selector
} else {
  // Use fallback
}
```

## Support

For issues or questions:
1. Check this guide
2. Review component documentation in `CategorySelector.README.md`
3. Check feature flag configuration
4. Review browser console for errors
5. Contact the development team

# Component Library Documentation

This documentation provides a comprehensive guide to all UI components in the system.

## Design System

Our components follow a consistent design system based on:
- **Colors**: Primary, secondary, success, warning, error palettes
- **Typography**: Consistent font sizes, weights, and line heights  
- **Spacing**: Standardized spacing scale
- **Accessibility**: WCAG 2.1 AA compliance

## Component Categories


### Base Components

- [Select](#select)
- [Input](#input)
- [Button](#button)

### Layout Components

- [Card](#card)

### Interactive Components

- [DropdownMenu](#dropdownmenu)
- [Dialog](#dialog)

### Feedback Components

- [Toast](#toast)
- [LoadingStates](#loadingstates)
- [Alert](#alert)

### Specialized Components

- [Textarea](#textarea)
- [Tabs](#tabs)
- [Table](#table)
- [Switch](#switch)
- [StatusBadge](#statusbadge)
- [Separator](#separator)
- [ResponsiveLayout](#responsivelayout)
- [ResponsiveImprovements](#responsiveimprovements)
- [Progress](#progress)
- [PerformanceMonitor](#performancemonitor)
- [OptimizedImage](#optimizedimage)
- [LazyComponent](#lazycomponent)
- [Label](#label)
- [ErrorStates](#errorstates)
- [EmptyStates](#emptystates)
- [Badge](#badge)
- [Avatar](#avatar)
- [AccessibilityComponents](#accessibilitycomponents)
- [TicketTable](#tickettable)
- [TicketForm](#ticketform)
- [FileUpload](#fileupload)
- [AutoAssignment](#autoassignment)
- [SessionProvider](#sessionprovider)
- [HydrationProvider](#hydrationprovider)
- [ReportsChart](#reportschart)
- [Sidebar](#sidebar)
- [Header](#header)
- [DashboardLayout](#dashboardlayout)
- [Breadcrumb](#breadcrumb)
- [Dashboard](#dashboard)

## Components

# Toast

**File**: `src/components/ui/toast.tsx`

## Props

- **id**: `string`
- **title**: `string`
- **description**: `string`
- **variant**: `'default' | 'destructive'`
- **onDismiss**: `(id: string) => void`

## Variants

No variants defined

## Usage

```tsx
import { Toast } from '@/components/ui'

<Toast />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Textarea

**File**: `src/components/ui/textarea.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Textarea } from '@/components/ui'

<Textarea />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Tabs

**File**: `src/components/ui/tabs.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Tabs } from '@/components/ui'

<Tabs />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Table

**File**: `src/components/ui/table.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Table } from '@/components/ui'

<Table />
```

## Accessibility

✅ Supports accessibility props

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Switch

**File**: `src/components/ui/switch.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Switch } from '@/components/ui'

<Switch />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# StatusBadge

**File**: `src/components/ui/status-badge.tsx`

## Props

- **status**: `'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'`
- **size**: `'sm' | 'md' | 'lg'`

## Variants

No variants defined

## Usage

```tsx
import { StatusBadge } from '@/components/ui'

<StatusBadge />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Separator

**File**: `src/components/ui/separator.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Separator } from '@/components/ui'

<Separator />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Select

**File**: `src/components/ui/select.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Select } from '@/components/ui'

<Select />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# ResponsiveLayout

**File**: `src/components/ui/responsive-layout.tsx`

## Props

- **children**: `React.ReactNode`
- **size**: `'sm' | 'md' | 'lg' | 'xl' | 'full'`
- **padding**: `'none' | 'sm' | 'md' | 'lg'`
- **className**: `string`

## Variants

No variants defined

## Usage

```tsx
import { ResponsiveLayout } from '@/components/ui'

<ResponsiveLayout />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# ResponsiveImprovements

**File**: `src/components/ui/responsive-improvements.tsx`

## Props

- **isOpen**: `boolean`
- **onToggle**: `() => void`
- **children**: `React.ReactNode`
- **className**: `string`

## Variants

No variants defined

## Usage

```tsx
import { ResponsiveImprovements } from '@/components/ui'

<ResponsiveImprovements />
```

## Accessibility

✅ Supports accessibility props

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Progress

**File**: `src/components/ui/progress.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Progress } from '@/components/ui'

<Progress />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# PerformanceMonitor

**File**: `src/components/ui/performance-monitor.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { PerformanceMonitor } from '@/components/ui'

<PerformanceMonitor />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# OptimizedImage

**File**: `src/components/ui/optimized-image.tsx`

## Props

- **src**: `string`
- **alt**: `string`
- **width**: `number`
- **height**: `number`
- **className**: `string`
- **priority**: `boolean`
- **placeholder**: `'blur' | 'empty'`
- **blurDataURL**: `string`
- **sizes**: `string`
- **fill**: `boolean`
- **quality**: `number`
- **loading**: `'lazy' | 'eager'`
- **onLoad**: `() => void`
- **onError**: `() => void`

## Variants

No variants defined

## Usage

```tsx
import { OptimizedImage } from '@/components/ui'

<OptimizedImage />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# LoadingStates

**File**: `src/components/ui/loading-states.tsx`

## Props

- **label**: `string`

## Variants



## Usage

```tsx
import { LoadingStates } from '@/components/ui'

<LoadingStates />
```

## Accessibility

✅ Supports accessibility props

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# LazyComponent

**File**: `src/components/ui/lazy-component.tsx`

## Props

- **fallback**: `React.ReactNode`
- **errorFallback**: `React.ComponentType<{ error: Error`

## Variants

No variants defined

## Usage

```tsx
import { LazyComponent } from '@/components/ui'

<LazyComponent />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Label

**File**: `src/components/ui/label.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Label } from '@/components/ui'

<Label />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Input

**File**: `src/components/ui/input.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Input } from '@/components/ui'

<Input />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# ErrorStates

**File**: `src/components/ui/error-states.tsx`

## Props

- **title**: `string`
- **message**: `string`
- **className**: `string`
- **onRetry**: `() => void`
- **onGoHome**: `() => void`
- **onGoBack**: `() => void`

## Variants

No variants defined

## Usage

```tsx
import { ErrorStates } from '@/components/ui'

<ErrorStates />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# EmptyStates

**File**: `src/components/ui/empty-states.tsx`

## Props

- **title**: `string`
- **description**: `string`
- **className**: `string`
- **actions**: `React.ReactNode`

## Variants

No variants defined

## Usage

```tsx
import { EmptyStates } from '@/components/ui'

<EmptyStates />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# DropdownMenu

**File**: `src/components/ui/dropdown-menu.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { DropdownMenu } from '@/components/ui'

<DropdownMenu />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Dialog

**File**: `src/components/ui/dialog.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Dialog } from '@/components/ui'

<Dialog />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Card

**File**: `src/components/ui/card.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Card } from '@/components/ui'

<Card />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Button

**File**: `src/components/ui/button.tsx`

## Props

- **asChild**: `boolean`

## Variants



## Usage

```tsx
import { Button } from '@/components/ui'

<Button />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Badge

**File**: `src/components/ui/badge.tsx`

## Props



## Variants



## Usage

```tsx
import { Badge } from '@/components/ui'

<Badge />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Avatar

**File**: `src/components/ui/avatar.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { Avatar } from '@/components/ui'

<Avatar />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Alert

**File**: `src/components/ui/alert.tsx`

## Props



## Variants



## Usage

```tsx
import { Alert } from '@/components/ui'

<Alert />
```

## Accessibility

✅ Supports accessibility props

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# AccessibilityComponents

**File**: `src/components/ui/accessibility-components.tsx`

## Props

- **children**: `React.ReactNode`
- **as**: `React.ElementType`
- **className**: `string`
- **id**: `string`

## Variants

No variants defined

## Usage

```tsx
import { AccessibilityComponents } from '@/components/ui'

<AccessibilityComponents />
```

## Accessibility

✅ Supports accessibility props

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# TicketTable

**File**: `src/components/tickets/ticket-table.tsx`

## Props

- **title**: `string`
- **description**: `string`
- **showFilters**: `boolean`
- **defaultFilters**: `{`
- **status**: `string`
- **priority**: `string`
- **assigneeId**: `string`

## Variants

No variants defined

## Usage

```tsx
import { TicketTable } from '@/components/ui'

<TicketTable />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# TicketForm

**File**: `src/components/tickets/ticket-form.tsx`

## Props

- **onSubmit**: `(data: any) => void`
- **initialData**: `any`
- **isLoading**: `boolean`

## Variants

No variants defined

## Usage

```tsx
import { TicketForm } from '@/components/ui'

<TicketForm />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# FileUpload

**File**: `src/components/tickets/file-upload.tsx`

## Props

- **ticketId**: `string`
- **onFileUploaded**: `() => void`
- **maxFiles**: `number`
- **disabled**: `boolean`

## Variants

No variants defined

## Usage

```tsx
import { FileUpload } from '@/components/ui'

<FileUpload />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# AutoAssignment

**File**: `src/components/tickets/auto-assignment.tsx`

## Props

- **ticketId**: `string`
- **currentAssignee**: `{`
- **id**: `string`
- **name**: `string`
- **email**: `string`

## Variants

No variants defined

## Usage

```tsx
import { AutoAssignment } from '@/components/ui'

<AutoAssignment />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# SessionProvider

**File**: `src/components/providers/session-provider.tsx`

## Props



## Variants

No variants defined

## Usage

```tsx
import { SessionProvider } from '@/components/ui'

<SessionProvider />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# HydrationProvider

**File**: `src/components/providers/hydration-provider.tsx`

## Props

- **children**: `React.ReactNode`

## Variants

No variants defined

## Usage

```tsx
import { HydrationProvider } from '@/components/ui'

<HydrationProvider />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# ReportsChart

**File**: `src/components/reports/reports-chart.tsx`

## Props

- **data**: `any[]`
- **title**: `string`
- **description**: `string`

## Variants

No variants defined

## Usage

```tsx
import { ReportsChart } from '@/components/ui'

<ReportsChart />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Sidebar

**File**: `src/components/layout/sidebar.tsx`

## Props

- **className**: `string`

## Variants

No variants defined

## Usage

```tsx
import { Sidebar } from '@/components/ui'

<Sidebar />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Header

**File**: `src/components/layout/header.tsx`

## Props

- **title**: `string`
- **subtitle**: `string`
- **actions**: `React.ReactNode`

## Variants

No variants defined

## Usage

```tsx
import { Header } from '@/components/ui'

<Header />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# DashboardLayout

**File**: `src/components/layout/dashboard-layout.tsx`

## Props

- **children**: `React.ReactNode`
- **title**: `string`
- **subtitle**: `string`
- **headerActions**: `React.ReactNode`
- **className**: `string`

## Variants

No variants defined

## Usage

```tsx
import { DashboardLayout } from '@/components/ui'

<DashboardLayout />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Breadcrumb

**File**: `src/components/layout/breadcrumb.tsx`

## Props

- **items**: `BreadcrumbItem[]`
- **className**: `string`

## Variants

No variants defined

## Usage

```tsx
import { Breadcrumb } from '@/components/ui'

<Breadcrumb />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---

# Dashboard

**File**: `src/components/dashboard/dashboard.tsx`

## Props

- **stats**: `{`
- **totalTickets**: `number`
- **openTickets**: `number`
- **closedTickets**: `number`
- **pendingTickets**: `number`

## Variants

No variants defined

## Usage

```tsx
import { Dashboard } from '@/components/ui'

<Dashboard />
```

## Accessibility

❌ Missing accessibility support

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers

---


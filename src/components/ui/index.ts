// UI Components Index

// Base Components
export { Button, buttonVariants } from './button'
export { Input } from './input'
export { Label } from './label'
export { Textarea } from './textarea'
export { Badge, badgeVariants } from './badge'
export { Avatar, AvatarImage, AvatarFallback } from './avatar'
export { Switch } from './switch'
export { Progress } from './progress'
export { Separator } from './separator'

// Layout Components
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card'
export { Alert, AlertDescription } from './alert'
export { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './table'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

// Interactive Components
export { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog'
export { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu'
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
export { Toast } from './toast'

// Specialized Components
export { LazyComponents, withLazyLoading, LazyLoadOnScroll, useLazyLoad, preloadComponent } from './lazy-component'
export { CustomImage } from './image'
export { PerformanceMonitor } from './performance-monitor'

// Status and Feedback Components
export { 
  StatusBadge, 
  PriorityBadge, 
  CategoryBadge, 
  UserBadge 
} from './status-badge'

// Loading States (Consolidated)
export {
  LoadingSpinner,
  LoadingState,
  LoadingButton,
  TableLoadingState,
  ErrorState,
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  InlineLoading,
  NetworkStatus,
  ProgressIndicator,
  // Legacy compatibility
  SkeletonCard,
  SkeletonTable,
  PageLoading,
} from './loading-states'

// Error States
export {
  ErrorDisplay,
  NetworkError,
  ServerError,
  NotFoundError,
  PermissionError,
  TimeoutError,
  InlineError,
  FieldError,
  ErrorBoundary,
  useErrorHandler,
  handleApiError,
} from './error-states'

// Empty States
export {
  EmptyState,
  NoTickets,
  NoSearchResults,
  NoComments,
  NoAttachments,
  NoUsers,
  NoReportData,
  NoFilterResults,
  DatabaseEmpty,
  NoActivity,
  EmptyCard,
} from './empty-states'

// Responsive Layout
export {
  Container,
  Grid,
  Flex,
  Stack,
  Responsive,
  SidebarLayout,
  CardGrid,
  Section,
  useBreakpoint,
  useMediaQuery,
} from './responsive-layout'

// Responsive Improvements
export {
  MobileNavigation,
  ResponsiveGrid,
  TouchButton,
  ResponsiveTable,
  ResponsiveForm,
  ResponsiveImage,
  ResponsiveText,
  ResponsiveCardStack,
  BreakpointAware,
  MobileInput,
} from './responsive-improvements'

// Accessibility Components
export {
  ScreenReaderOnly,
  SkipLink,
  AccessibleButton,
  AccessibleInput,
  AccessibleDialog,
  AccessibleTabs,
  AccessibleAlert,
  AccessibleDropdown,
} from './accessibility-components'
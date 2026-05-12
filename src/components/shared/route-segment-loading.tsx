/**
 * UI mínima para `loading.tsx` de segmentos (App Router).
 * Da feedback inmediato mientras el servidor prepara la página.
 */
export function RouteSegmentLoading() {
  return (
    <div className='flex min-h-[50vh] w-full items-center justify-center p-8'>
      <div className='flex flex-col items-center gap-3'>
        <div
          className='h-9 w-9 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary'
          aria-hidden
        />
        <p className='text-sm text-muted-foreground'>Cargando…</p>
      </div>
    </div>
  )
}

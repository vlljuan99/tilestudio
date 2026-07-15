import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  page: number
  totalPages: number
  /** Params actuales de la URL (sin `pagina`), para conservar filtros al paginar. */
  baseParams: URLSearchParams
}

function pageHref(baseParams: URLSearchParams, page: number) {
  const sp = new URLSearchParams(baseParams.toString())
  if (page > 1) sp.set('pagina', String(page))
  else sp.delete('pagina')
  const qs = sp.toString()
  return qs ? `/catalogo?${qs}` : '/catalogo'
}

/** Ventana de páginas: 1 … (p-1) p (p+1) … N */
function pageWindow(page: number, totalPages: number): (number | '…')[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

export function CatalogPagination({ page, totalPages, baseParams }: Props) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Paginación del catálogo" className="flex items-center justify-center gap-1 pt-4">
      {page > 1 && (
        <Link
          href={pageHref(baseParams, page - 1)}
          aria-label="Página anterior"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      )}
      {pageWindow(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={pageHref(baseParams, p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm',
              p === page
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:bg-muted',
            )}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link
          href={pageHref(baseParams, page + 1)}
          aria-label="Página siguiente"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </nav>
  )
}

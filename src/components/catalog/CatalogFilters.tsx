'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { cn } from '@/lib/utils'

export type FacetOption = {
  slug: string
  name: string
  count: number
  hex?: string | null
}

export type FacetGroup = {
  urlKey: string
  label: string
  swatches?: boolean
  options: FacetOption[]
}

export function readSelected(params: URLSearchParams, urlKey: string): string[] {
  const raw = params.get(urlKey)
  if (!raw) return []
  return raw.split(',').filter(Boolean)
}

export function countActiveFilters(params: URLSearchParams, groups: FacetGroup[]): number {
  return groups.reduce((sum, g) => sum + readSelected(params, g.urlKey).length, 0)
}

export function CatalogFilters({ groups }: { groups: FacetGroup[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function navigate(sp: URLSearchParams) {
    sp.delete('pagina')
    const qs = sp.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function toggle(urlKey: string, slug: string) {
    const sp = new URLSearchParams(params.toString())
    const selected = readSelected(sp, urlKey)
    const next = selected.includes(slug)
      ? selected.filter((s) => s !== slug)
      : [...selected, slug]
    if (next.length) sp.set(urlKey, next.join(','))
    else sp.delete(urlKey)
    navigate(sp)
  }

  function clearAll() {
    const sp = new URLSearchParams(params.toString())
    for (const group of groups) sp.delete(group.urlKey)
    navigate(sp)
  }

  const activeCount = countActiveFilters(params, groups)

  return (
    <div className={cn('space-y-6', pending && 'opacity-60 pointer-events-none')}>
      {groups.map((group) => {
        const selected = readSelected(params, group.urlKey)
        // Opciones sin resultados se ocultan, salvo que estén seleccionadas
        // (para poder des-seleccionarlas).
        const visible = group.options.filter(
          (opt) => opt.count > 0 || selected.includes(opt.slug),
        )
        if (visible.length === 0) return null
        return (
          <fieldset key={group.urlKey}>
            <legend className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              {group.label}
            </legend>
            <div className="flex flex-wrap gap-2">
              {visible.map((opt) => {
                const isSelected = selected.includes(opt.slug)
                return (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => toggle(group.urlKey, opt.slug)}
                    aria-pressed={isSelected}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                      isSelected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background hover:border-foreground/40',
                    )}
                  >
                    {group.swatches && (
                      <span
                        aria-hidden
                        className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: opt.hex || '#e5e5e5' }}
                      />
                    )}
                    <span>{opt.name}</span>
                    <span
                      className={cn(
                        'text-xs',
                        isSelected ? 'text-background/70' : 'text-muted-foreground',
                      )}
                    >
                      {opt.count}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={clearAll}
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          Limpiar filtros ({activeCount})
        </button>
      )}
    </div>
  )
}

'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

export const SORT_OPTIONS = [
  { value: '', label: 'Destacados' },
  { value: 'novedades', label: 'Novedades' },
  { value: 'precio-asc', label: 'Precio: menor a mayor' },
  { value: 'precio-desc', label: 'Precio: mayor a menor' },
] as const

export function CatalogSort() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const current = params.get('orden') || ''

  function onChange(value: string) {
    const sp = new URLSearchParams(params.toString())
    if (value) sp.set('orden', value)
    else sp.delete('orden')
    sp.delete('pagina')
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    })
  }

  return (
    <label className="flex items-center gap-2 text-sm shrink-0">
      <span className="text-muted-foreground hidden sm:inline">Ordenar:</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        aria-label="Ordenar resultados"
        className="h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

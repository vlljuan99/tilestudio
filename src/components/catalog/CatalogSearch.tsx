'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

export function CatalogSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const urlValue = params.get('q') || ''
  const [value, setValue] = useState(urlValue)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Si la URL cambia desde fuera (limpiar filtros, atrás), sincronizamos el input.
  useEffect(() => {
    setValue(urlValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue])

  function commit(next: string) {
    const sp = new URLSearchParams(params.toString())
    if (next.trim()) sp.set('q', next.trim())
    else sp.delete('q')
    sp.delete('pagina')
    startTransition(() => {
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
    })
  }

  function onChange(next: string) {
    setValue(next)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => commit(next), 400)
  }

  return (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (debounce.current) clearTimeout(debounce.current)
            commit(value)
          }
        }}
        placeholder="Buscar por nombre, referencia o descripción…"
        aria-label="Buscar azulejos"
        className="w-full h-10 rounded-md border border-border bg-background pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Borrar búsqueda"
          onClick={() => {
            if (debounce.current) clearTimeout(debounce.current)
            setValue('')
            commit('')
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

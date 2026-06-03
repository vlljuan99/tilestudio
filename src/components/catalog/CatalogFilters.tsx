'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useTransition } from 'react'

type Option = { id: number | string; name: string; slug: string }

type Props = {
  colors: Option[]
  finishes: Option[]
  formats: Option[]
  rooms: Option[]
  usages: Option[]
  collections: Option[]
}

const FILTER_FIELDS: { key: keyof Props; label: string }[] = [
  { key: 'colors', label: 'Color' },
  { key: 'formats', label: 'Formato' },
  { key: 'finishes', label: 'Acabado' },
  { key: 'rooms', label: 'Estancia' },
  { key: 'usages', label: 'Uso' },
  { key: 'collections', label: 'Colección' },
]

const URL_KEY: Record<string, string> = {
  colors: 'color',
  formats: 'formato',
  finishes: 'acabado',
  rooms: 'estancia',
  usages: 'uso',
  collections: 'coleccion',
}

export function CatalogFilters(props: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    })
  }

  function clearAll() {
    startTransition(() => {
      router.replace(pathname, { scroll: false })
    })
  }

  const hasAny = FILTER_FIELDS.some(({ key }) => params.get(URL_KEY[key]))

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {FILTER_FIELDS.map(({ key, label }) => {
        const options = props[key] as Option[]
        const urlKey = URL_KEY[key]
        const current = params.get(urlKey) || ''
        return (
          <label key={key} className="text-sm">
            <span className="block mb-1 text-muted-foreground">{label}</span>
            <select
              value={current}
              onChange={(e) => setParam(urlKey, e.target.value)}
              disabled={pending}
              className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.slug}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
        )
      })}
      {hasAny && (
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="text-sm underline text-muted-foreground hover:text-foreground"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}

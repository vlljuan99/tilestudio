'use client'

/**
 * Formulario de ambiente: foto de la estancia + los azulejos que aparecen
 * (con buscador por nombre) y en qué superficie. Crear y editar.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { apiCreate, apiDelete, apiGet, apiUpdate, slugify } from './api'
import { ImageField, RelationSelect, TextArea, TextField, Toggle } from './fields'
import { useUnsavedWarning } from './useUnsavedWarning'

type MediaRef = { id: number | string; url: string } | null

type TileEntry = {
  tile: number | string
  tileName: string
  tileImageUrl?: string | null
  surface: string
}

export type AmbientFormValues = {
  id?: number | string
  title: string
  description: string
  image: MediaRef
  tilesUsed: TileEntry[]
  roomType: number | string | null
  style: string
  published: boolean
}

export function emptyAmbient(): AmbientFormValues {
  return {
    title: '',
    description: '',
    image: null,
    tilesUsed: [],
    roomType: null,
    style: '',
    published: true,
  }
}

const SURFACES = [
  { value: 'floor', label: 'Suelo' },
  { value: 'wall', label: 'Pared' },
  { value: 'other', label: 'Otro' },
]

export function AmbientForm({ initial }: { initial: AmbientFormValues }) {
  const router = useRouter()
  const [v, setVRaw] = useState<AmbientFormValues>(initial)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = initial.id == null

  useUnsavedWarning(dirty)

  const setV: typeof setVRaw = (updater) => {
    setVRaw(updater)
    setDirty(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!v.image) {
      setError('La foto del ambiente es obligatoria.')
      return
    }
    setBusy(true)
    setError(null)
    const data: Record<string, unknown> = {
      title: v.title,
      description: v.description || null,
      image: v.image.id,
      tilesUsed: v.tilesUsed.map((t) => ({ tile: t.tile, surface: t.surface || undefined })),
      roomType: v.roomType,
      style: v.style || null,
      published: v.published,
    }
    try {
      if (isNew) {
        await apiCreate('ambients', { ...data, slug: slugify(v.title) })
      } else {
        await apiUpdate('ambients', initial.id!, data)
      }
      // Antes de navegar: si no, el aviso de "sin guardar" salta al salir.
      setDirty(false)
      router.push('/ventas/ambientes')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!initial.id) return
    if (!window.confirm(`¿Borrar el ambiente "${initial.title}"?`)) return
    setBusy(true)
    setDirty(false)
    try {
      await apiDelete('ambients', initial.id)
      router.push('/ventas/ambientes')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <nav className="text-xs text-muted-foreground">
        <Link href="/ventas/ambientes" className="hover:underline">
          ← Ambientes
        </Link>
      </nav>
      <h1 className="text-2xl">{isNew ? 'Nuevo ambiente' : v.title || 'Editar ambiente'}</h1>

      <TextField
        label="Título"
        required
        value={v.title}
        onChange={(x) => setV((p) => ({ ...p, title: x }))}
      />

      <ImageField
        label="Foto del ambiente"
        required
        value={v.image}
        onChange={(x) => setV((p) => ({ ...p, image: x }))}
        hint="La foto de la estancia con los azulejos puestos."
      />

      <TilePicker
        entries={v.tilesUsed}
        onChange={(tilesUsed) => setV((p) => ({ ...p, tilesUsed }))}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <RelationSelect
          label="Tipo de estancia"
          collection="rooms"
          value={v.roomType}
          onChange={(x) => setV((p) => ({ ...p, roomType: x }))}
        />
        <TextField
          label="Estilo"
          value={v.style}
          onChange={(x) => setV((p) => ({ ...p, style: x }))}
          placeholder="nórdico, industrial, mediterráneo…"
        />
      </div>

      <TextArea
        label="Descripción"
        value={v.description}
        onChange={(x) => setV((p) => ({ ...p, description: x }))}
      />

      <Toggle
        label="Publicado en la web"
        checked={v.published}
        onChange={(x) => setV((p) => ({ ...p, published: x }))}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Guardando…' : isNew ? 'Crear ambiente' : 'Guardar cambios'}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="px-4 py-2.5 rounded-md border border-destructive/40 text-destructive text-sm hover:bg-destructive/5 disabled:opacity-50"
          >
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}

/** Buscador de azulejos por nombre + lista de los ya enlazados con superficie. */
function TilePicker({
  entries,
  onChange,
}: {
  entries: TileEntry[]
  onChange: (v: TileEntry[]) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: number | string; name: string; url: string | null }>>([])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const q = encodeURIComponent(query.trim())
        const data = await apiGet(`/tiles?where[name][like]=${q}&limit=8&depth=1`)
        setResults(
          (data.docs || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            url: typeof d.mainImage === 'object' ? d.mainImage?.url || null : null,
          })),
        )
      } catch {
        setResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  function add(r: { id: number | string; name: string; url: string | null }) {
    if (entries.some((e) => String(e.tile) === String(r.id))) return
    onChange([...entries, { tile: r.id, tileName: r.name, tileImageUrl: r.url, surface: 'floor' }])
    setQuery('')
    setResults([])
  }

  return (
    <div className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">Azulejos que aparecen</span>

      {entries.length > 0 && (
        <div className="border border-border rounded-lg divide-y divide-border mb-2">
          {entries.map((e, i) => (
            <div key={String(e.tile)} className="flex items-center gap-3 p-2">
              {e.tileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={e.tileImageUrl}
                  alt=""
                  className="w-9 h-9 object-cover rounded border border-border"
                />
              ) : (
                <div className="w-9 h-9 rounded border border-dashed border-border" />
              )}
              <span className="flex-1 truncate">{e.tileName}</span>
              <select
                value={e.surface}
                onChange={(ev) => {
                  const copy = [...entries]
                  copy[i] = { ...e, surface: ev.target.value }
                  onChange(copy)
                }}
                className="h-8 rounded-md border border-border bg-background px-1.5 text-xs"
              >
                {SURFACES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(entries.filter((_, j) => j !== i))}
                className="text-muted-foreground hover:text-destructive px-1"
                aria-label={`Quitar ${e.tileName}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar azulejo por nombre para añadirlo…"
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full border border-border rounded-md bg-background shadow-lg max-h-64 overflow-y-auto">
            {results.map((r) => (
              <button
                key={String(r.id)}
                type="button"
                onClick={() => add(r)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-muted text-sm"
              >
                {r.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.url} alt="" className="w-7 h-7 object-cover rounded" />
                ) : (
                  <span className="w-7 h-7 rounded border border-dashed border-border" />
                )}
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

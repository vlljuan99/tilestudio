'use client'

/**
 * Listado de azulejos para comerciales: tarjetas con foto, búsqueda por
 * nombre/SKU, filtro por marca y por publicado, paginación y acciones en lote
 * (publicar, despublicar, asignar marca, compartir con un cliente, borrar).
 *
 * Con catálogos de cientos de azulejos importados de un PDF, entrar uno a uno
 * para publicarlos no es viable: el lote es la forma normal de trabajar aquí.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

import { apiDelete, apiGet, apiUpdate, loadOptions, type Option } from './api'
import { ShareDialog } from './ShareDialog'

type Tile = {
  id: number | string
  name: string
  sku?: string | null
  published?: boolean
  mainImage?: { url?: string } | null
  brand?: { name?: string } | null
  format?: { name?: string } | null
}

const PAGE_SIZE = 24

export function TilesList() {
  const [tiles, setTiles] = useState<Tile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [brandId, setBrandId] = useState('')
  const [onlyUnpublished, setOnlyUnpublished] = useState(false)
  const [brands, setBrands] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  // Guardamos el azulejo entero, no solo el id: la selección sobrevive al
  // cambio de página y al compartir necesitamos nombre y foto de todos.
  const [selected, setSelected] = useState<Map<string, Tile>>(new Map())
  const [busy, setBusy] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    loadOptions('brands').then(setBrands).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const where: string[] = []
      if (search.trim()) {
        const q = encodeURIComponent(search.trim())
        where.push(`where[or][0][name][like]=${q}`, `where[or][1][sku][like]=${q}`)
      }
      if (brandId) where.push(`where[brand][equals]=${brandId}`)
      if (onlyUnpublished) where.push(`where[published][equals]=false`)
      const qs = [`limit=${PAGE_SIZE}`, `page=${page}`, 'sort=-updatedAt', 'depth=1', ...where].join('&')
      const data = await apiGet(`/tiles?${qs}`)
      setTiles(data.docs || [])
      setTotal(data.totalDocs || 0)
    } catch {
      setTiles([])
    } finally {
      setLoading(false)
    }
  }, [search, brandId, onlyUnpublished, page])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const selectedTiles = [...selected.values()]
  const allVisibleSelected = tiles.length > 0 && tiles.every((t) => selected.has(String(t.id)))

  function toggle(tile: Tile) {
    setSelected((s) => {
      const next = new Map(s)
      const k = String(tile.id)
      if (next.has(k)) next.delete(k)
      else next.set(k, tile)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((s) => {
      const next = new Map(s)
      if (allVisibleSelected) tiles.forEach((t) => next.delete(String(t.id)))
      else tiles.forEach((t) => next.set(String(t.id), t))
      return next
    })
  }

  /** Aplica un cambio a cada seleccionado. En serie: son PATCH baratos y así
   *  un fallo suelto no deja el lote a medias sin saber por dónde iba. */
  async function bulkUpdate(label: string, data: Record<string, unknown>) {
    setBusy(label)
    const ids = [...selected.keys()]
    let failed = 0
    for (const id of ids) {
      try {
        await apiUpdate('tiles', id, data)
      } catch {
        failed++
      }
    }
    setBusy(null)
    setSelected(new Map())
    await load()
    if (failed > 0) alert(`${failed} de ${ids.length} no se pudieron actualizar.`)
  }

  async function bulkDelete() {
    const ids = [...selected.keys()]
    if (
      !window.confirm(
        `¿Borrar ${ids.length} azulejo${ids.length === 1 ? '' : 's'}? Desaparecerán de la web y no se puede deshacer.`,
      )
    ) {
      return
    }
    setBusy('borrar')
    const errors: string[] = []
    for (const id of ids) {
      try {
        await apiDelete('tiles', id)
      } catch (err) {
        errors.push((err as Error).message)
      }
    }
    setBusy(null)
    setSelected(new Map())
    await load()
    if (errors.length > 0) {
      alert(`${errors.length} de ${ids.length} no se pudieron borrar:\n${errors[0]}`)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Buscar por nombre o código…"
          className="h-10 rounded-md border border-border bg-background px-3 text-sm w-64 max-w-full"
        />
        <select
          value={brandId}
          onChange={(e) => {
            setBrandId(e.target.value)
            setPage(1)
          }}
          className="h-10 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Todas las marcas</option>
          {brands.map((b) => (
            <option key={String(b.id)} value={String(b.id)}>
              {b.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={onlyUnpublished}
            onChange={(e) => {
              setOnlyUnpublished(e.target.checked)
              setPage(1)
            }}
          />
          Solo sin publicar
        </label>
        <span className="flex-1" />
        <span className="text-sm text-muted-foreground">{total} azulejos</span>
      </div>

      {/* Barra de acciones en lote: solo aparece cuando hay selección */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 mb-4 p-3 border border-border rounded-md bg-background/95 backdrop-blur shadow-sm">
          <span className="text-sm font-medium">
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => setSelected(new Map())}
            className="text-xs text-muted-foreground hover:underline"
          >
            quitar selección
          </button>
          <span className="flex-1" />
          <button
            onClick={() => setSharing(true)}
            disabled={busy != null}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            Compartir con un cliente
          </button>
          <button
            onClick={() => bulkUpdate('publicar', { published: true })}
            disabled={busy != null}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            {busy === 'publicar' ? 'Publicando…' : 'Publicar'}
          </button>
          <button
            onClick={() => bulkUpdate('despublicar', { published: false })}
            disabled={busy != null}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            {busy === 'despublicar' ? 'Ocultando…' : 'Despublicar'}
          </button>
          <select
            value=""
            disabled={busy != null || brands.length === 0}
            onChange={(e) => {
              if (e.target.value) bulkUpdate('marca', { brand: e.target.value })
            }}
            className="text-sm h-[34px] border border-border rounded-md bg-background px-2 disabled:opacity-50"
          >
            <option value="">{busy === 'marca' ? 'Asignando…' : 'Asignar marca…'}</option>
            {brands.map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={bulkDelete}
            disabled={busy != null}
            className="text-sm px-3 py-1.5 border border-destructive/40 text-destructive rounded-md hover:bg-destructive/5 disabled:opacity-50"
          >
            {busy === 'borrar' ? 'Borrando…' : 'Borrar'}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm py-12 text-center">Cargando…</p>
      ) : tiles.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground text-sm">No hay azulejos con estos filtros.</p>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm mb-2 w-fit cursor-pointer">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
            Seleccionar los {tiles.length} de esta página
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tiles.map((t) => {
              const isSel = selected.has(String(t.id))
              return (
                <div
                  key={String(t.id)}
                  className={`relative border rounded-lg overflow-hidden bg-card transition-shadow ${
                    isSel ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:shadow-md'
                  }`}
                >
                  <label
                    className="absolute top-2 left-2 z-10 w-7 h-7 grid place-items-center rounded-md bg-background/90 border border-border cursor-pointer"
                    title="Seleccionar"
                  >
                    <input type="checkbox" checked={isSel} onChange={() => toggle(t)} />
                  </label>

                  <Link href={`/ventas/azulejos/${t.id}`} className="block">
                    {t.mainImage?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={t.mainImage.url}
                        alt={t.name}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted grid place-items-center text-xs text-muted-foreground">
                        sin foto
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[t.brand?.name, t.format?.name, t.sku].filter(Boolean).join(' · ') || '—'}
                      </p>
                      {t.published === false && (
                        <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700">
                          sin publicar
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 border border-border rounded-md text-sm disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      {sharing && (
        <ShareDialog
          tiles={selectedTiles.map((t) => ({
            id: t.id,
            name: t.name,
            imageUrl: t.mainImage?.url || null,
          }))}
          onClose={() => setSharing(false)}
        />
      )}
    </div>
  )
}

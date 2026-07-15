'use client'

/**
 * Listado de azulejos para comerciales: tarjetas con foto, búsqueda por
 * nombre/SKU, filtro por marca y por publicado, paginación. Todo contra la
 * REST API de Payload con la sesión del navegador.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

import { apiGet, loadOptions, type Option } from './api'

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

      {loading ? (
        <p className="text-muted-foreground text-sm py-12 text-center">Cargando…</p>
      ) : tiles.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground text-sm">No hay azulejos con estos filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <Link
              key={String(t.id)}
              href={`/ventas/azulejos/${t.id}`}
              className="border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-card"
            >
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
          ))}
        </div>
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
    </div>
  )
}

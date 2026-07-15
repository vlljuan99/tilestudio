'use client'

/**
 * Revisión de candidatos extraídos de un catálogo PDF.
 *
 * Pensada para catálogos con cientos de variantes: los candidatos se agrupan
 * por SERIE en secciones plegables, cada fila es compacta (miniatura + nombre
 * + chips) y se expande al hacer clic para editar los datos. Cada serie se
 * puede aceptar o rechazar entera de un clic.
 *
 * Duplicados: si un candidato tiene el mismo nombre que un azulejo ya
 * publicado en el catálogo (prop `duplicates`, calculada en el servidor), la
 * fila lo avisa y pide una decisión explícita: actualizar el existente, crear
 * uno nuevo de todas formas, o descartarlo. "Aceptar serie" no toca los
 * duplicados: siempre son decisión individual.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export type DuplicateInfo = { tileId: number | string; tileName: string }

type Candidate = {
  id: string
  page: number
  pages?: number[]
  brand?: string | null
  collection?: string | null
  seriesName?: string | null
  variantName: string
  sku?: string | null
  colorCode?: string | null
  formats?: string[]
  finishes?: string[]
  specialPieces?: string[]
  dominantColor?: string | null
  description?: string | null
  usage?: string[]
  rooms?: string[]
  pageImageUrl?: string
  textureImageUrl?: string
  ambientImageUrl?: string
  ambientImageUrls?: string[]
  textureSource?: 'embedded' | 'crop'
  reviewStatus: 'pending' | 'accepted' | 'rejected'
  publishedTileId?: number | string | null
  /** Decisión sobre un duplicado detectado: crear otro tile o actualizar el existente. */
  duplicateAction?: 'create' | 'update'
  duplicateTileId?: number | string | null
}

type Props = {
  importId: string
  importDoc: {
    displayName?: string
    status?: string
    brand?: { id: number | string; name: string } | null
    extractedItems?: Candidate[] | null
    candidatesCount?: number
    createdTiles?: any
  }
  duplicates: Record<string, DuplicateInfo>
}

type Filter = 'all' | 'pending' | 'accepted' | 'rejected' | 'duplicates'

export function CandidateReview({ importId, importDoc, duplicates }: Props) {
  const initial: Candidate[] = useMemo(() => importDoc.extractedItems || [], [importDoc])
  const [candidates, setCandidates] = useState<Candidate[]>(initial)
  const [filter, setFilter] = useState<Filter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const pendingCount = candidates.filter((c) => c.reviewStatus === 'pending').length
  const acceptedCount = candidates.filter((c) => c.reviewStatus === 'accepted').length
  const rejectedCount = candidates.filter((c) => c.reviewStatus === 'rejected').length
  const toPublishCount = candidates.filter(
    (c) => c.reviewStatus === 'accepted' && c.publishedTileId == null,
  ).length
  const publishedCount = candidates.filter((c) => c.publishedTileId != null).length
  const duplicateCount = candidates.filter((c) => duplicates[c.id]).length

  // Aviso si se cierra la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function matchesFilter(c: Candidate): boolean {
    if (filter === 'all') return true
    if (filter === 'duplicates') return Boolean(duplicates[c.id])
    return c.reviewStatus === filter
  }

  function updateCandidate(id: string, patch: Partial<Candidate>) {
    setCandidates((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    setDirty(true)
  }

  /** Acepta/rechaza en bloque. Los duplicados sin decidir se quedan como están. */
  function bulkSet(ids: string[], status: 'accepted' | 'rejected') {
    setCandidates((arr) =>
      arr.map((c) => {
        if (!ids.includes(c.id)) return c
        if (status === 'accepted' && duplicates[c.id] && !c.duplicateAction) return c
        return { ...c, reviewStatus: status }
      }),
    )
    setDirty(true)
  }

  async function saveAll(silent = false): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch(`/api/pdf-imports/${importId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ extractedItems: candidates }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'No se pudo guardar.')
      }
      setDirty(false)
      return true
    } catch (err) {
      if (!silent) alert(`Error guardando: ${(err as Error).message}`)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function publishAccepted() {
    const toPublish = candidates.filter(
      (c) => c.reviewStatus === 'accepted' && c.publishedTileId == null,
    ).length
    if (toPublish === 0) {
      setPublishMsg('No hay candidatos aceptados pendientes de publicar.')
      return
    }
    setPublishing(true)
    setPublishMsg(null)
    try {
      const saved = await saveAll()
      if (!saved) throw new Error('No se pudieron guardar los cambios antes de publicar.')
      const res = await fetch(`/api/admin/pdf-imports/${importId}/publish`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo publicar.')
      const parts = [`✅ ${data.createdCount} azulejos publicados`]
      if (data.updatedCount > 0) parts.push(`${data.updatedCount} actualizados`)
      if (data.createdAmbients > 0) parts.push(`${data.createdAmbients} ambientes`)
      setPublishMsg(parts.join(' · '))
      // Reflejar los publishedTileId que asignó el servidor sin recargar.
      const published: Record<string, number | string> = data.publishedByCandidate || {}
      setCandidates((arr) =>
        arr.map((c) => (published[c.id] != null ? { ...c, publishedTileId: published[c.id] } : c)),
      )
    } catch (err) {
      setPublishMsg(`❌ ${(err as Error).message}`)
    } finally {
      setPublishing(false)
    }
  }

  // Agrupar por serie, ordenado por primera página de aparición.
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: Candidate[] }>()
    for (const c of candidates) {
      const name = c.seriesName?.trim() || 'Sin serie'
      const key = name.toLowerCase()
      if (!map.has(key)) map.set(key, { name, items: [] })
      map.get(key)!.items.push(c)
    }
    return Array.from(map.values()).sort(
      (a, b) => Math.min(...a.items.map((c) => c.page)) - Math.min(...b.items.map((c) => c.page)),
    )
  }, [candidates])

  const filterTabs: Array<{ key: Filter; label: string }> = [
    { key: 'all', label: `Todos (${candidates.length})` },
    { key: 'pending', label: `Pendientes (${pendingCount})` },
    { key: 'accepted', label: `Aceptados (${acceptedCount})` },
    { key: 'rejected', label: `Rechazados (${rejectedCount})` },
    ...(duplicateCount > 0
      ? [{ key: 'duplicates' as Filter, label: `Ya existen (${duplicateCount})` }]
      : []),
  ]

  return (
    <div className="container py-6 max-w-5xl">
      <nav className="text-xs text-muted-foreground mb-2 flex gap-3">
        <Link href={`/pdf-imports/${importId}`} className="hover:underline">
          ← Estado de la importación
        </Link>
        <Link href="/pdf-imports" className="hover:underline">
          Mis importaciones
        </Link>
      </nav>
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl">{importDoc.displayName || 'Import PDF'}</h1>
        <p className="text-sm text-muted-foreground">
          Revisa los azulejos encontrados: acepta los que quieras en tu web, corrige lo que haga
          falta y pulsa «Publicar».
          {publishedCount > 0 ? ` ${publishedCount} ya publicados.` : ''}
        </p>
      </header>

      {/* Barra de acciones pegajosa */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 mb-4 p-3 border border-border rounded-md bg-background/95 backdrop-blur">
        <div className="flex flex-wrap gap-1">
          {filterTabs.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-sm px-3 py-1 rounded-md ${
                filter === f.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button
          onClick={() => saveAll()}
          disabled={saving || !dirty}
          className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Guardado ✓'}
        </button>
        <button
          onClick={publishAccepted}
          disabled={publishing || toPublishCount === 0}
          className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {publishing
            ? 'Publicando…'
            : toPublishCount === 0 && acceptedCount > 0
              ? 'Todo publicado ✓'
              : `Publicar ${toPublishCount} aceptados`}
        </button>
      </div>

      {publishMsg && (
        <div className="mb-4 p-3 border border-border rounded-md text-sm">{publishMsg}</div>
      )}

      {candidates.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">
          Aún no hay candidatos. Si la importación sigue en marcha, ve aparecerán aquí — refresca
          en un momento.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const visible = group.items.filter(matchesFilter)
            if (visible.length === 0) return null
            const pages = group.items.flatMap((c) => c.pages || [c.page])
            const groupAccepted = group.items.filter((c) => c.reviewStatus === 'accepted').length
            return (
              <section key={group.name.toLowerCase()}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="font-semibold">{group.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length} variantes · pág. {Math.min(...pages)}–{Math.max(...pages)}
                    {groupAccepted > 0 ? ` · ${groupAccepted} aceptadas` : ''}
                  </span>
                  <span className="flex-1" />
                  <button
                    onClick={() =>
                      bulkSet(
                        group.items.map((c) => c.id),
                        'accepted',
                      )
                    }
                    className="text-xs px-2.5 py-1 border border-border rounded-md hover:bg-muted"
                  >
                    ✓ Aceptar serie
                  </button>
                  <button
                    onClick={() =>
                      bulkSet(
                        group.items.map((c) => c.id),
                        'rejected',
                      )
                    }
                    className="text-xs px-2.5 py-1 border border-border rounded-md hover:bg-muted"
                  >
                    ✕ Rechazar serie
                  </button>
                </div>
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                  {visible.map((c) => (
                    <CandidateRow
                      key={c.id}
                      c={c}
                      duplicate={duplicates[c.id]}
                      expanded={expandedId === c.id}
                      onToggleExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      onChange={(patch) => updateCandidate(c.id, patch)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CandidateRow({
  c,
  duplicate,
  expanded,
  onToggleExpand,
  onChange,
}: {
  c: Candidate
  duplicate?: DuplicateInfo
  expanded: boolean
  onToggleExpand: () => void
  onChange: (patch: Partial<Candidate>) => void
}) {
  const isAccepted = c.reviewStatus === 'accepted'
  const isRejected = c.reviewStatus === 'rejected'
  const isPublished = c.publishedTileId != null
  const thumb = c.textureImageUrl || c.ambientImageUrl || c.pageImageUrl
  const ambients = c.ambientImageUrls?.length
    ? c.ambientImageUrls
    : c.ambientImageUrl
      ? [c.ambientImageUrl]
      : []

  return (
    <div
      className={`${
        isAccepted ? 'bg-green-500/5' : isRejected ? 'bg-destructive/5 opacity-60' : ''
      }`}
    >
      {/* Fila compacta */}
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          title="Ver y editar los datos"
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt={c.variantName}
              className="w-12 h-12 shrink-0 object-cover rounded border border-border"
            />
          ) : (
            <div className="w-12 h-12 shrink-0 rounded border border-border bg-muted grid place-items-center text-[10px] text-muted-foreground">
              sin foto
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {c.variantName}
              {isPublished && (
                <span className="ml-2 text-xs text-green-700 font-normal">● publicado</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              p. {(c.pages || [c.page]).join(', ')}
              {c.formats?.length ? ` · ${c.formats.join(', ')}` : ''}
              {ambients.length ? ` · ${ambients.length} foto${ambients.length > 1 ? 's' : ''} de ambiente` : ''}
              {c.textureSource === 'crop' ? ' · textura recortada' : ''}
            </p>
          </div>
          <span className="ml-auto shrink-0 text-muted-foreground text-xs">
            {expanded ? '▲' : '▼'}
          </span>
        </button>

        {duplicate && !isPublished && (
          <span
            className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-medium"
            title={`Ya existe en tu catálogo: ${duplicate.tileName}`}
          >
            ya existe
          </span>
        )}

        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() =>
              onChange({ reviewStatus: isAccepted ? 'pending' : 'accepted' })
            }
            className={`text-xs px-2.5 py-1.5 rounded-md border ${
              isAccepted ? 'bg-green-600 text-white border-green-600' : 'border-border hover:bg-muted'
            }`}
          >
            ✓
          </button>
          <button
            onClick={() =>
              onChange({ reviewStatus: isRejected ? 'pending' : 'rejected' })
            }
            className={`text-xs px-2.5 py-1.5 rounded-md border ${
              isRejected
                ? 'bg-destructive text-destructive-foreground border-destructive'
                : 'border-border hover:bg-muted'
            }`}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Aviso de duplicado con decisión explícita */}
      {duplicate && !isPublished && (
        <div className="mx-3 mb-2 p-2.5 rounded-md bg-amber-500/10 text-xs flex flex-wrap items-center gap-2">
          <span>
            Ya existe <strong>{duplicate.tileName}</strong> en tu catálogo. Si lo aceptas:
          </span>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name={`dup-${c.id}`}
              checked={c.duplicateAction === 'update'}
              onChange={() =>
                onChange({ duplicateAction: 'update', duplicateTileId: duplicate.tileId })
              }
            />
            actualizar el existente
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="radio"
              name={`dup-${c.id}`}
              checked={c.duplicateAction === 'create'}
              onChange={() => onChange({ duplicateAction: 'create', duplicateTileId: null })}
            />
            crear otro nuevo
          </label>
        </div>
      )}

      {/* Editor expandido */}
      {expanded && (
        <div className="px-3 pb-4 pt-1 grid md:grid-cols-[220px_1fr] gap-4 border-t border-border/60">
          <div className="space-y-2 pt-3">
            {c.textureImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.textureImageUrl}
                alt={`Textura ${c.variantName}`}
                className="w-full aspect-square object-cover rounded border border-border"
              />
            )}
            <div className="flex flex-wrap gap-2">
              {ambients.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Ambiente ${i + 1}`}
                  className="w-[calc(50%-0.25rem)] aspect-[4/3] object-cover rounded border border-border"
                />
              ))}
            </div>
            {c.pageImageUrl && (
              <a
                href={c.pageImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:underline block"
              >
                Ver la página {c.page} del PDF →
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3">
            <Field label="Nombre" value={c.variantName} onChange={(v) => onChange({ variantName: v })} />
            <Field label="Serie" value={c.seriesName || ''} onChange={(v) => onChange({ seriesName: v })} />
            <Field label="SKU / Cód. tarifa" value={c.sku || ''} onChange={(v) => onChange({ sku: v })} />
            <Field
              label="Color dominante"
              value={c.dominantColor || ''}
              onChange={(v) => onChange({ dominantColor: v })}
            />
            <Field
              label="Formatos (coma)"
              value={(c.formats || []).join(', ')}
              onChange={(v) => onChange({ formats: splitList(v) })}
            />
            <Field
              label="Acabados (coma)"
              value={(c.finishes || []).join(', ')}
              onChange={(v) => onChange({ finishes: splitList(v) })}
            />
            <Field
              label="Piezas especiales (coma)"
              value={(c.specialPieces || []).join(', ')}
              onChange={(v) => onChange({ specialPieces: splitList(v) })}
            />
            <Field
              label="Código color (RAL/NCS)"
              value={c.colorCode || ''}
              onChange={(v) => onChange({ colorCode: v })}
            />
            <Field
              label="Usos (coma)"
              value={(c.usage || []).join(', ')}
              onChange={(v) => onChange({ usage: splitList(v) })}
            />
            <Field
              label="Estancias (coma)"
              value={(c.rooms || []).join(', ')}
              onChange={(v) => onChange({ rooms: splitList(v) })}
            />
            <div className="col-span-2">
              <Field
                label="Descripción"
                value={c.description || ''}
                onChange={(v) => onChange({ description: v })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function splitList(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
      />
    </label>
  )
}

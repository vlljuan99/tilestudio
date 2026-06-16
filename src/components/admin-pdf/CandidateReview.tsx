'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

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
}

export function CandidateReview({ importId, importDoc }: Props) {
  const initial: Candidate[] = useMemo(() => importDoc.extractedItems || [], [importDoc])
  const [candidates, setCandidates] = useState<Candidate[]>(initial)
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all')
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = candidates.filter((c) => filter === 'all' || c.reviewStatus === filter)
  const pendingCount = candidates.filter((c) => c.reviewStatus === 'pending').length
  const acceptedCount = candidates.filter((c) => c.reviewStatus === 'accepted').length
  const rejectedCount = candidates.filter((c) => c.reviewStatus === 'rejected').length

  function updateCandidate(id: string, patch: Partial<Candidate>) {
    setCandidates((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function bulkAccept(ids: string[]) {
    setCandidates((arr) =>
      arr.map((c) => (ids.includes(c.id) ? { ...c, reviewStatus: 'accepted' } : c)),
    )
  }

  async function saveAll() {
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
    } catch (err) {
      alert(`Error guardando: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  async function publishAccepted() {
    if (acceptedCount === 0) {
      setPublishMsg('No hay candidatos aceptados.')
      return
    }
    setPublishing(true)
    setPublishMsg(null)
    try {
      // Primero guardamos cambios pendientes
      await saveAll()
      const res = await fetch(`/api/admin/pdf-imports/${importId}/publish`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo publicar.')
      setPublishMsg(`✅ Publicados ${data.createdCount} azulejos.`)
    } catch (err) {
      setPublishMsg(`❌ ${(err as Error).message}`)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="container py-6 max-w-6xl">
      <nav className="text-xs text-muted-foreground mb-2">
        <Link href="/admin/collections/pdf-imports" className="hover:underline">
          ← Volver al admin
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl">{importDoc.displayName || 'Import PDF'}</h1>
        <p className="text-sm text-muted-foreground">
          {candidates.length} candidatos · {pendingCount} pendientes · {acceptedCount} aceptados ·{' '}
          {rejectedCount} rechazados
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 border border-border rounded-md bg-muted/30">
        <div className="flex gap-1">
          {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1 rounded-md ${
                filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {f === 'all'
                ? `Todos (${candidates.length})`
                : f === 'pending'
                  ? `Pendientes (${pendingCount})`
                  : f === 'accepted'
                    ? `Aceptados (${acceptedCount})`
                    : `Rechazados (${rejectedCount})`}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button
          onClick={() => bulkAccept(visible.map((c) => c.id))}
          className="text-sm px-3 py-1 border border-border rounded-md hover:bg-muted"
        >
          Aceptar todos los visibles
        </button>
        <button
          onClick={saveAll}
          disabled={saving}
          className="text-sm px-3 py-1 border border-border rounded-md hover:bg-muted disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          onClick={publishAccepted}
          disabled={publishing || acceptedCount === 0}
          className="text-sm px-3 py-1 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          {publishing ? 'Publicando…' : `Publicar ${acceptedCount} aceptados`}
        </button>
      </div>

      {publishMsg && (
        <div className="mb-4 p-3 border border-border rounded-md text-sm">{publishMsg}</div>
      )}

      <div className="grid gap-4">
        {visible.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">
            No hay candidatos con este filtro.
          </p>
        ) : (
          visible.map((c) => (
            <CandidateRow key={c.id} c={c} onChange={(patch) => updateCandidate(c.id, patch)} />
          ))
        )}
      </div>
    </div>
  )
}

function CandidateRow({
  c,
  onChange,
}: {
  c: Candidate
  onChange: (patch: Partial<Candidate>) => void
}) {
  const isAccepted = c.reviewStatus === 'accepted'
  const isRejected = c.reviewStatus === 'rejected'

  return (
    <article
      className={`border rounded-lg p-4 grid md:grid-cols-[200px_1fr_auto] gap-4 ${
        isAccepted
          ? 'border-green-500/40 bg-green-500/5'
          : isRejected
            ? 'border-destructive/30 bg-destructive/5 opacity-70'
            : 'border-border'
      }`}
    >
      <div className="space-y-2">
        {c.textureImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.textureImageUrl}
            alt={`Textura ${c.variantName}`}
            className="w-full aspect-square object-cover rounded border border-border"
          />
        ) : c.pageImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.pageImageUrl}
            alt={`Página ${c.page}`}
            className="w-full aspect-[4/3] object-cover rounded border border-border"
          />
        ) : (
          <div className="w-full aspect-[4/3] bg-muted rounded grid place-items-center text-xs text-muted-foreground">
            sin preview
          </div>
        )}
        {(() => {
          const ambients = c.ambientImageUrls?.length
            ? c.ambientImageUrls
            : c.ambientImageUrl
              ? [c.ambientImageUrl]
              : []
          return (
            <div className="flex flex-wrap gap-2">
              {ambients.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Entorno ${i + 1}`}
                  title={`Entorno ${i + 1} de ${ambients.length}`}
                  className="w-[calc(50%-0.25rem)] aspect-[4/3] object-cover rounded border border-border"
                />
              ))}
              {c.textureImageUrl && c.pageImageUrl && ambients.length === 0 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.pageImageUrl}
                  alt={`Página ${c.page}`}
                  title="Página completa"
                  className="w-1/2 aspect-[4/3] object-cover rounded border border-border"
                />
              )}
            </div>
          )
        })()}
        <p className="text-xs text-muted-foreground">
          {c.pages && c.pages.length > 1 ? `páginas ${c.pages.join(', ')}` : `página ${c.page}`} del
          PDF
          {c.textureSource === 'embedded' ? ' · textura original' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" value={c.variantName} onChange={(v) => onChange({ variantName: v })} />
        <Field label="Serie" value={c.seriesName || ''} onChange={(v) => onChange({ seriesName: v })} />
        <Field label="SKU / Cód. tarif." value={c.sku || ''} onChange={(v) => onChange({ sku: v })} />
        <Field
          label="Color dominante"
          value={c.dominantColor || ''}
          onChange={(v) => onChange({ dominantColor: v })}
        />
        <Field
          label="Código color (RAL/NCS)"
          value={c.colorCode || ''}
          onChange={(v) => onChange({ colorCode: v })}
        />
        <Field
          label="Formatos (coma)"
          value={(c.formats || []).join(', ')}
          onChange={(v) =>
            onChange({ formats: v.split(',').map((s) => s.trim()).filter(Boolean) })
          }
        />
        <Field
          label="Acabados (coma)"
          value={(c.finishes || []).join(', ')}
          onChange={(v) =>
            onChange({ finishes: v.split(',').map((s) => s.trim()).filter(Boolean) })
          }
        />
        <Field
          label="Usos (coma)"
          value={(c.usage || []).join(', ')}
          onChange={(v) => onChange({ usage: v.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
        <Field
          label="Estancias (coma)"
          value={(c.rooms || []).join(', ')}
          onChange={(v) => onChange({ rooms: v.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
        <div className="col-span-2">
          <Field
            label="Descripción"
            value={c.description || ''}
            onChange={(v) => onChange({ description: v })}
          />
        </div>
      </div>

      <div className="flex md:flex-col gap-2 md:w-32">
        <button
          onClick={() =>
            onChange({ reviewStatus: c.reviewStatus === 'accepted' ? 'pending' : 'accepted' })
          }
          className={`text-sm px-3 py-2 rounded-md border ${
            isAccepted
              ? 'bg-green-600 text-white border-green-600'
              : 'border-border hover:bg-muted'
          }`}
        >
          {isAccepted ? '✓ Aceptado' : 'Aceptar'}
        </button>
        <button
          onClick={() =>
            onChange({ reviewStatus: c.reviewStatus === 'rejected' ? 'pending' : 'rejected' })
          }
          className={`text-sm px-3 py-2 rounded-md border ${
            isRejected
              ? 'bg-destructive text-destructive-foreground border-destructive'
              : 'border-border hover:bg-muted'
          }`}
        >
          {isRejected ? '✕ Rechazado' : 'Rechazar'}
        </button>
      </div>
    </article>
  )
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

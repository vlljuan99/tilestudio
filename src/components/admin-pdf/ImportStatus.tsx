'use client'

/**
 * Vista de estado en vivo de una importación (/pdf-imports/[id]).
 *
 * Pollea el endpoint ligero /progress cada 2s mientras el worker trabaja y
 * muestra: barra de progreso con página actual y ETA, lo que el sistema está
 * haciendo ahora mismo, el coste de IA acumulado y las últimas variantes
 * encontradas con su miniatura. Desde aquí se arranca (si está en cola), se
 * reintenta (si falló) y se salta a la revisión en cualquier momento.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { COST_PER_PAGE_USD, formatCost, formatDuration } from './import-estimates'

type RecentCandidate = {
  id: string
  variantName: string
  seriesName: string | null
  page: number
  textureImageUrl: string | null
  ambientImageUrl: string | null
}

export type Progress = {
  id: number | string
  displayName?: string
  status: string
  progressPercent: number
  processedPages: number
  totalPages: number | null
  pageRangeFrom: number
  pageRangeTo: number | null
  pdfTotalPages?: number | null
  lastProcessedPage?: number | null
  candidatesCount: number
  seriesCount: number
  currentStep: string | null
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  costUsd: number
  recent: RecentCandidate[]
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'Lista para empezar',
  processing: 'Leyendo el catálogo',
  review_ready: 'Lista para revisar',
  importing: 'Añadiendo al catálogo',
  completed: 'Completada',
  failed: 'Algo falló',
}

const STATUS_CLASS: Record<string, string> = {
  queued: 'bg-muted text-foreground',
  processing: 'bg-primary/15 text-primary',
  review_ready: 'bg-green-600/15 text-green-700',
  importing: 'bg-amber-500/15 text-amber-700',
  completed: 'bg-green-600/15 text-green-700',
  failed: 'bg-destructive/15 text-destructive',
}

/** Estados en los que ya no hay nada corriendo que haga falta pollear. */
const IDLE_STATUSES = new Set(['queued', 'review_ready', 'completed', 'failed'])

function computeEta(p: Progress): string | null {
  if (p.status !== 'processing' || !p.startedAt || !p.totalPages || p.processedPages < 2) {
    return null
  }
  const elapsedSec = (Date.now() - new Date(p.startedAt).getTime()) / 1000
  if (elapsedSec <= 0) return null
  const secPerPage = elapsedSec / p.processedPages
  const remaining = Math.max(0, p.totalPages - p.processedPages)
  return formatDuration(remaining * secPerPage)
}

export function ImportStatus({ initial }: { initial: Progress }) {
  const [p, setP] = useState<Progress>(initial)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const statusRef = useRef(p.status)
  statusRef.current = p.status

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/pdf-imports/${initial.id}/progress`, {
        credentials: 'include',
      })
      if (!res.ok) return
      setP(await res.json())
    } catch {}
  }, [initial.id])

  useEffect(() => {
    const t = setInterval(() => {
      if (IDLE_STATUSES.has(statusRef.current)) return
      fetchProgress()
    }, 2000)
    const onFocus = () => fetchProgress()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchProgress])

  async function start() {
    setBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/pdf-imports/${initial.id}/start`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo arrancar.')
      // Optimista: el polling recogerá el estado real enseguida.
      setP((prev) => ({ ...prev, status: 'processing' }))
      setTimeout(fetchProgress, 800)
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  /** Reconfigura el rango para seguir donde se quedó y arranca. */
  async function continueFrom(nextPage: number, endPage: number) {
    setBusy(true)
    setActionError(null)
    try {
      const patch = await fetch(`/api/pdf-imports/${initial.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          pageRangeFrom: nextPage,
          pageRangeTo: endPage,
          maxPages: endPage - nextPage + 1,
          status: 'queued',
        }),
      })
      if (!patch.ok) throw new Error('No se pudo preparar la continuación.')
      await start()
    } catch (err) {
      setActionError((err as Error).message)
      setBusy(false)
    }
  }

  const eta = computeEta(p)
  const isProcessing = p.status === 'processing'
  const canStart = p.status === 'queued' || p.status === 'failed'
  const canReview = p.candidatesCount > 0

  // ¿Quedan páginas del PDF sin procesar? (importación parcial o fallo a medias)
  // Tras un fallo se repite la última página (pudo quedarse a medias); tras un
  // lote completado se sigue en la siguiente.
  const nextPage =
    p.status === 'failed'
      ? p.lastProcessedPage || p.pageRangeFrom
      : p.lastProcessedPage
        ? p.lastProcessedPage + 1
        : null
  const canContinue =
    (p.status === 'review_ready' || p.status === 'completed' || p.status === 'failed') &&
    p.pdfTotalPages != null &&
    nextPage != null &&
    nextPage <= p.pdfTotalPages
  const remainingPages = canContinue ? p.pdfTotalPages! - nextPage! + 1 : 0

  return (
    <div className="container py-6 max-w-4xl">
      <nav className="text-xs text-muted-foreground mb-2">
        <Link href="/ventas/importar" className="hover:underline">
          ← Mis importaciones
        </Link>
      </nav>

      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-3xl flex-1 min-w-[50%]">
          {p.displayName || 'Importación'}
        </h1>
        <span
          className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_CLASS[p.status] || 'bg-muted'}`}
        >
          {STATUS_LABEL[p.status] || p.status}
        </span>
      </header>

      {/* Progreso */}
      <section className="border border-border rounded-lg p-5 mb-6">
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${p.status === 'failed' ? 'bg-destructive' : 'bg-primary'}`}
            style={{ width: `${p.progressPercent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-muted-foreground">
          <span>
            Página <strong className="text-foreground">{p.processedPages}</strong> de{' '}
            {p.totalPages ?? '?'} · {p.progressPercent}%
          </span>
          {eta && <span>quedan ≈ {eta}</span>}
          {p.costUsd > 0 && <span>IA: {formatCost(p.costUsd)}</span>}
        </div>
        {p.currentStep && (
          <p className="text-sm mt-2 font-mono text-muted-foreground">
            {isProcessing ? '⏳ ' : ''}
            {p.currentStep}
          </p>
        )}
        {p.errorMessage && p.status === 'failed' && (
          <p className="text-sm mt-2 text-destructive whitespace-pre-wrap">{p.errorMessage}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {canStart && (
            <button
              onClick={() => {
                // Tras un fallo a media importación, reanudar donde se quedó en
                // vez de volver a pagar por las páginas ya procesadas.
                const end = p.pageRangeTo || p.pdfTotalPages
                if (p.status === 'failed' && nextPage && end && nextPage > p.pageRangeFrom) {
                  continueFrom(nextPage, end)
                } else {
                  start()
                }
              }}
              disabled={busy}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {busy
                ? 'Arrancando…'
                : p.status === 'failed'
                  ? nextPage && nextPage > p.pageRangeFrom
                    ? `Reanudar desde la página ${nextPage}`
                    : 'Volver a intentarlo'
                  : 'Empezar a leer el PDF'}
            </button>
          )}
          {canContinue && p.status !== 'failed' && (
            <button
              onClick={() => continueFrom(nextPage!, p.pdfTotalPages!)}
              disabled={busy}
              className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted disabled:opacity-50"
              title={`Coste de IA estimado: ${formatCost(remainingPages * COST_PER_PAGE_USD)}`}
            >
              {busy
                ? 'Arrancando…'
                : `Continuar: páginas ${nextPage}–${p.pdfTotalPages} (quedan ${remainingPages})`}
            </button>
          )}
          {canReview && (
            <Link
              href={`/ventas/importar/${p.id}/revisar`}
              className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted"
            >
              Revisar {p.candidatesCount} azulejos →
            </Link>
          )}
        </div>
        {actionError && <p className="text-sm text-destructive mt-2">{actionError}</p>}
      </section>

      {/* Resumen de lo encontrado */}
      <section className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <Stat label="Azulejos encontrados" value={p.candidatesCount} />
          <Stat label="Series" value={p.seriesCount} />
          <Stat
            label="Páginas leídas"
            value={p.totalPages ? `${p.processedPages}/${p.totalPages}` : p.processedPages}
          />
        </div>

        {p.recent.length > 0 && (
          <>
            <h2 className="text-sm font-semibold mb-2">
              {isProcessing ? 'Encontrados ahora mismo' : 'Últimos encontrados'}
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {p.recent.map((c) => {
                const img = c.textureImageUrl || c.ambientImageUrl
                return (
                  <figure key={c.id} className="text-xs">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img}
                        alt={c.variantName}
                        className="w-full aspect-square object-cover rounded-md border border-border"
                      />
                    ) : (
                      <div className="w-full aspect-square rounded-md border border-border bg-muted grid place-items-center text-muted-foreground">
                        sin foto
                      </div>
                    )}
                    <figcaption className="mt-1 truncate" title={c.variantName}>
                      {c.variantName}
                    </figcaption>
                    <p className="text-muted-foreground">p. {c.page}</p>
                  </figure>
                )
              })}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-2xl font-semibold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

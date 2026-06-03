'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useCallback, useEffect, useState } from 'react'

type Doc = {
  id: number | string
  status?: string
  progressPercent?: number
  processedPages?: number
  totalPages?: number
  candidatesCount?: number
  currentStep?: string
  errorMessage?: string
}

const STATUS_LABEL: Record<string, string> = {
  queued: 'En cola',
  processing: 'Procesando',
  review_ready: 'Listo para revisar',
  importing: 'Importando',
  completed: 'Completado',
  failed: 'Fallido',
}

const STATUS_COLOR: Record<string, string> = {
  queued: '#888',
  processing: '#1e88e5',
  review_ready: '#43a047',
  importing: '#fb8c00',
  completed: '#2e7d32',
  failed: '#c62828',
}

export default function PdfImportProgress() {
  const { id } = useDocumentInfo()
  const [doc, setDoc] = useState<Doc | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const fetchDoc = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/pdf-imports/${id}?depth=0`, { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setDoc(data)
    } catch {}
  }, [id])

  // Polling cada 2s mientras esté procesando
  useEffect(() => {
    fetchDoc()
    const t = setInterval(() => {
      fetchDoc()
    }, 2000)
    return () => clearInterval(t)
  }, [fetchDoc])

  async function start() {
    if (!id) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/admin/pdf-imports/${id}/start`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) setMsg(data?.error || 'No se pudo iniciar.')
      else setMsg('Extracción iniciada. Verás el progreso aquí abajo.')
      await fetchDoc()
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!doc) {
    return (
      <div style={style.box}>
        <p style={style.title}>Estado del import</p>
        <p style={style.muted}>Guarda el documento primero para empezar.</p>
      </div>
    )
  }

  const status = doc.status || 'queued'
  const color = STATUS_COLOR[status] || '#888'
  const percent = doc.progressPercent ?? 0
  const isProcessing = status === 'processing'
  const canStart = status === 'queued' || status === 'failed'
  const canReview = status === 'review_ready' || (doc.candidatesCount || 0) > 0

  return (
    <div style={style.box}>
      <div style={style.headerRow}>
        <p style={style.title}>Estado del import</p>
        <span style={{ ...style.badge, backgroundColor: color }}>
          {STATUS_LABEL[status] || status}
        </span>
      </div>

      <div style={style.barWrapper}>
        <div style={{ ...style.bar, width: `${percent}%`, backgroundColor: color }} />
      </div>
      <p style={style.muted}>
        {doc.processedPages || 0} / {doc.totalPages || '?'} páginas · {percent}% ·{' '}
        {doc.candidatesCount || 0} candidatos
      </p>

      {doc.currentStep && <p style={style.step}>→ {doc.currentStep}</p>}
      {doc.errorMessage && <p style={style.error}>{doc.errorMessage}</p>}

      <div style={style.actions}>
        {canStart && (
          <button
            onClick={start}
            disabled={busy}
            type="button"
            style={{ ...style.btn, ...style.btnPrimary }}
          >
            {busy
              ? 'Lanzando…'
              : status === 'failed'
                ? 'Reintentar extracción'
                : 'Iniciar extracción'}
          </button>
        )}

        {isProcessing && (
          <button disabled type="button" style={{ ...style.btn, opacity: 0.6 }}>
            Procesando…
          </button>
        )}

        {canReview && (
          <a
            href={`/pdf-imports/${id}/review`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...style.btn, ...style.btnSecondary, textDecoration: 'none' }}
          >
            Revisar {doc.candidatesCount || 0} candidatos →
          </a>
        )}
      </div>

      {msg && <p style={style.muted}>{msg}</p>}
    </div>
  )
}

const style: Record<string, React.CSSProperties> = {
  box: {
    border: '1px solid var(--theme-elevation-150, #e0e0e0)',
    borderRadius: 6,
    padding: 16,
    marginBottom: 16,
    background: 'var(--theme-elevation-50, #fafafa)',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { margin: 0, fontWeight: 600 },
  badge: {
    color: 'white',
    fontSize: 12,
    padding: '2px 8px',
    borderRadius: 999,
  },
  barWrapper: {
    height: 8,
    background: 'var(--theme-elevation-100, #ececec)',
    borderRadius: 999,
    overflow: 'hidden',
    margin: '8px 0',
  },
  bar: {
    height: '100%',
    transition: 'width 0.5s ease',
  },
  muted: { fontSize: 13, color: 'var(--theme-elevation-500, #888)', margin: '4px 0' },
  step: { fontSize: 13, fontFamily: 'monospace', margin: '4px 0' },
  error: { fontSize: 13, color: '#c62828', margin: '4px 0', whiteSpace: 'pre-wrap' },
  actions: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  btn: {
    padding: '6px 14px',
    borderRadius: 4,
    border: '1px solid transparent',
    fontSize: 14,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'var(--theme-success-500, #1e88e5)',
    color: 'white',
  },
  btnSecondary: {
    background: 'transparent',
    color: 'var(--theme-text, #333)',
    borderColor: 'var(--theme-elevation-300, #bbb)',
  },
}

'use client'

/**
 * Asistente de importación de catálogos PDF (paso 1 y 2).
 *
 * Flujo: arrastra el PDF → se sube a Media con barra de progreso → se crea el
 * PdfImport (contando páginas en el servidor) → eliges marca y alcance (todo el
 * catálogo, premarcado, o un rango) con coste estimado → "Empezar" arranca el
 * worker y navega a /pdf-imports/[id], donde se ve el progreso en vivo.
 */
import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { COST_PER_PAGE_USD, SECONDS_PER_PAGE, formatCost, formatDuration } from './import-estimates'

type Brand = { id: number | string; name: string }

type Props = { brands: Brand[] }

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; name: string; percent: number }
  | { phase: 'creating'; name: string }
  | { phase: 'ready'; name: string; importId: number | string; totalPages: number }
  | { phase: 'error'; message: string }

function uploadPdfToMedia(
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ id: number | string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/media')
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && data?.doc?.id != null) {
          resolve(data.doc)
        } else {
          reject(new Error(data?.errors?.[0]?.message || `No se pudo subir el PDF (${xhr.status}).`))
        }
      } catch {
        reject(new Error(`No se pudo subir el PDF (${xhr.status}).`))
      }
    }
    xhr.onerror = () => reject(new Error('Fallo de red subiendo el PDF.'))
    const fd = new FormData()
    fd.append('file', file)
    fd.append('_payload', JSON.stringify({ alt: file.name }))
    xhr.send(fd)
  })
}

export function ImportWizard({ brands }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [upload, setUpload] = useState<UploadState>({ phase: 'idle' })
  const [dragOver, setDragOver] = useState(false)
  const [brandId, setBrandId] = useState<string>('')
  const [scope, setScope] = useState<'all' | 'range'>('all')
  const [fromPage, setFromPage] = useState(1)
  const [toPage, setToPage] = useState(30)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!/\.pdf$/i.test(file.name)) {
      setUpload({ phase: 'error', message: 'El fichero tiene que ser un PDF.' })
      return
    }
    try {
      setUpload({ phase: 'uploading', name: file.name, percent: 0 })
      const media = await uploadPdfToMedia(file, (percent) =>
        setUpload({ phase: 'uploading', name: file.name, percent }),
      )
      setUpload({ phase: 'creating', name: file.name })
      const res = await fetch('/api/admin/pdf-imports/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mediaId: media.id, scope: 'all' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo preparar la importación.')
      setUpload({
        phase: 'ready',
        name: file.name,
        importId: data.id,
        totalPages: data.totalPages,
      })
      setToPage(Math.min(30, data.totalPages))
    } catch (err) {
      setUpload({ phase: 'error', message: (err as Error).message })
    }
  }, [])

  async function start() {
    if (upload.phase !== 'ready') return
    setStarting(true)
    setStartError(null)
    const from = scope === 'range' ? Math.max(1, fromPage) : 1
    const to =
      scope === 'range' ? Math.min(upload.totalPages, Math.max(from, toPage)) : upload.totalPages
    try {
      const patch = await fetch(`/api/pdf-imports/${upload.importId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          brand: brandId ? Number(brandId) || brandId : null,
          pageRangeFrom: from,
          pageRangeTo: to,
          maxPages: to - from + 1,
        }),
      })
      if (!patch.ok) {
        const data = await patch.json().catch(() => null)
        throw new Error(data?.errors?.[0]?.message || 'No se pudo guardar la configuración.')
      }
      const res = await fetch(`/api/admin/pdf-imports/${upload.importId}/start`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo arrancar la importación.')
      router.push(`/pdf-imports/${upload.importId}`)
    } catch (err) {
      setStartError((err as Error).message)
      setStarting(false)
    }
  }

  const ready = upload.phase === 'ready'
  const pagesToProcess = ready
    ? scope === 'all'
      ? upload.totalPages
      : Math.max(0, Math.min(upload.totalPages, toPage) - Math.max(1, fromPage) + 1)
    : 0

  return (
    <div className="container py-6 max-w-3xl">
      <nav className="text-xs text-muted-foreground mb-2">
        <Link href="/pdf-imports" className="hover:underline">
          ← Mis importaciones
        </Link>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl">Importar un catálogo PDF</h1>
        <p className="text-sm text-muted-foreground">
          Sube el catálogo de tu proveedor y el sistema irá encontrando los azulejos con sus fotos
          y datos. Después podrás revisarlos antes de publicarlos.
        </p>
      </header>

      {/* Paso 1: PDF */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-2">1 · El catálogo</h2>
        {upload.phase === 'idle' || upload.phase === 'error' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) handleFile(file)
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
            }`}
          >
            <p className="font-medium">Arrastra aquí el PDF del catálogo</p>
            <p className="text-sm text-muted-foreground mt-1">o haz clic para elegirlo</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            {upload.phase === 'error' && (
              <p className="text-sm text-destructive mt-3">{upload.message}</p>
            )}
          </div>
        ) : (
          <div className="border border-border rounded-lg p-4">
            <p className="font-medium text-sm">{upload.name}</p>
            {upload.phase === 'uploading' && (
              <>
                <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${upload.percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Subiendo… {upload.percent}%
                </p>
              </>
            )}
            {upload.phase === 'creating' && (
              <p className="text-xs text-muted-foreground mt-1">
                Contando las páginas del catálogo…
              </p>
            )}
            {upload.phase === 'ready' && (
              <p className="text-xs text-muted-foreground mt-1">
                ✓ Subido · {upload.totalPages} páginas
              </p>
            )}
          </div>
        )}
      </section>

      {/* Paso 2: configuración */}
      <section className={`mb-6 ${ready ? '' : 'opacity-40 pointer-events-none'}`}>
        <h2 className="text-sm font-semibold mb-2">2 · Marca y alcance</h2>
        <div className="border border-border rounded-lg p-4 space-y-4">
          <label className="block text-sm max-w-xs">
            <span className="block text-xs text-muted-foreground mb-1">Marca del catálogo</span>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="">Detectar automáticamente</option>
              {brands.map((b) => (
                <option key={String(b.id)} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground mb-1">Páginas a procesar</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
              />
              Todo el catálogo{ready ? ` (${upload.totalPages} páginas)` : ''}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                checked={scope === 'range'}
                onChange={() => setScope('range')}
              />
              Solo un rango
              {scope === 'range' && (
                <span className="inline-flex items-center gap-1 ml-2">
                  de
                  <input
                    type="number"
                    min={1}
                    max={ready ? upload.totalPages : undefined}
                    value={fromPage}
                    onChange={(e) => setFromPage(Number(e.target.value) || 1)}
                    className="w-16 h-8 rounded-md border border-border bg-background px-2 text-sm"
                  />
                  a
                  <input
                    type="number"
                    min={fromPage}
                    max={ready ? upload.totalPages : undefined}
                    value={toPage}
                    onChange={(e) => setToPage(Number(e.target.value) || fromPage)}
                    className="w-16 h-8 rounded-md border border-border bg-background px-2 text-sm"
                  />
                </span>
              )}
            </label>
          </fieldset>

          {ready && pagesToProcess > 0 && (
            <p className="text-sm text-muted-foreground border-t border-border pt-3">
              {pagesToProcess} páginas · coste de IA estimado{' '}
              <strong>{formatCost(pagesToProcess * COST_PER_PAGE_USD)}</strong> · tardará{' '}
              <strong>{formatDuration(pagesToProcess * SECONDS_PER_PAGE)}</strong> aprox. Podrás ir
              revisando los azulejos mientras se procesa.
            </p>
          )}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          onClick={start}
          disabled={!ready || starting || pagesToProcess === 0}
          className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {starting ? 'Arrancando…' : 'Empezar la importación'}
        </button>
        {startError && <p className="text-sm text-destructive">{startError}</p>}
      </div>
    </div>
  )
}

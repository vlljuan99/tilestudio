'use client'

/**
 * Genera un enlace con los azulejos seleccionados para mandárselo a un cliente.
 *
 * Es el gesto más "de ventas" de todo el panel: el comercial marca cuatro
 * azulejos en el showroom y le manda al cliente un enlace por WhatsApp, sin
 * que el cliente tenga que instalar ni registrarse en nada.
 */
import { useState } from 'react'

import { TextArea, TextField } from './fields'

type ShareTile = { id: number | string; name: string; imageUrl: string | null }

export function ShareDialog({ tiles, onClose }: { tiles: ShareTile[]; onClose: () => void }) {
  const [title, setTitle] = useState('Selección de azulejos')
  const [clientName, setClientName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/selections', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          clientName,
          note,
          tiles: tiles.map((t) => t.id),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo crear el enlace.')
      setUrl(`${window.location.origin}/seleccion/${data.token}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar. Selecciona el enlace y cópialo a mano.')
    }
  }

  const whatsappText = url
    ? encodeURIComponent(
        `${clientName ? `Hola ${clientName}, ` : ''}te paso la selección de azulejos: ${url}`,
      )
    : ''

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-lg p-5 w-full max-w-md space-y-4 my-8">
        {!url ? (
          <form onSubmit={create} className="space-y-4">
            <div>
              <p className="font-semibold">Compartir con un cliente</p>
              <p className="text-xs text-muted-foreground">
                {tiles.length} azulejo{tiles.length === 1 ? '' : 's'} seleccionado
                {tiles.length === 1 ? '' : 's'}. Se genera un enlace que puede abrir sin registrarse.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {tiles.slice(0, 8).map((t) =>
                t.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={String(t.id)}
                    src={t.imageUrl}
                    alt={t.name}
                    title={t.name}
                    className="w-10 h-10 object-cover rounded border border-border"
                  />
                ) : (
                  <span
                    key={String(t.id)}
                    className="w-10 h-10 rounded border border-dashed border-border"
                  />
                ),
              )}
              {tiles.length > 8 && (
                <span className="w-10 h-10 rounded border border-border grid place-items-center text-xs text-muted-foreground">
                  +{tiles.length - 8}
                </span>
              )}
            </div>

            <TextField label="Título" required value={title} onChange={setTitle} />
            <TextField
              label="Nombre del cliente (opcional)"
              value={clientName}
              onChange={setClientName}
            />
            <TextArea label="Nota para el cliente (opcional)" value={note} onChange={setNote} />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !title.trim()}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {busy ? 'Creando…' : 'Crear enlace'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="font-semibold">Enlace listo</p>
              <p className="text-xs text-muted-foreground">
                Cualquiera con este enlace puede ver la selección.
              </p>
            </div>

            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-10 rounded-md border border-border bg-muted/40 px-3 text-sm"
            />

            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/?text=${whatsappText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
              >
                Enviar por WhatsApp
              </a>
              <button
                onClick={copy}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
              >
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
              >
                Verlo
              </a>
              <span className="flex-1" />
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
              >
                Cerrar
              </button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

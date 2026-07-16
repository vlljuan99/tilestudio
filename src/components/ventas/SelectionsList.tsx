'use client'

/**
 * Selecciones ya enviadas: reenviar el enlace, ver si el cliente lo ha abierto
 * y borrarlas cuando dejan de valer.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { apiDelete } from './api'

type Selection = {
  id: number | string
  title: string
  token: string
  clientName: string | null
  viewCount: number
  tileCount: number
  createdAt: string
  createdBy: string | null
}

export function SelectionsList({ selections }: { selections: Selection[] }) {
  const router = useRouter()
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(token: string) {
    const url = `${window.location.origin}/seleccion/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(token)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      window.prompt('Copia el enlace:', url)
    }
  }

  async function remove(s: Selection) {
    if (!window.confirm(`¿Borrar "${s.title}"? El enlace dejará de funcionar para el cliente.`)) {
      return
    }
    try {
      await apiDelete('selections', s.id)
      router.refresh()
    } catch (err) {
      alert(`No se pudo borrar: ${(err as Error).message}`)
    }
  }

  if (selections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-lg">
        Todavía no has enviado ninguna selección.
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      {selections.map((s) => (
        <article key={String(s.id)} className="border border-border rounded-lg p-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-[55%]">
              <p className="font-medium">{s.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[
                  s.clientName && `Para ${s.clientName}`,
                  `${s.tileCount} azulejo${s.tileCount === 1 ? '' : 's'}`,
                  s.viewCount > 0 ? `vista ${s.viewCount} ${s.viewCount === 1 ? 'vez' : 'veces'}` : 'sin abrir todavía',
                  new Date(s.createdAt).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  }),
                  s.createdBy,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${s.clientName ? `Hola ${s.clientName}, ` : ''}te paso la selección de azulejos: ${typeof window !== 'undefined' ? window.location.origin : ''}/seleccion/${s.token}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground"
            >
              Reenviar por WhatsApp
            </a>
            <button
              onClick={() => copy(s.token)}
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              {copied === s.token ? '¡Copiado!' : 'Copiar enlace'}
            </button>
            <a
              href={`/seleccion/${s.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              Verla
            </a>
            <span className="flex-1" />
            <button
              onClick={() => remove(s)}
              className="text-xs px-2.5 py-1.5 rounded-md border border-border text-destructive hover:bg-destructive/5"
            >
              Borrar
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

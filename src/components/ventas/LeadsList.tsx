'use client'

/**
 * Clientes interesados: lista con filtro por estado, cambio de estado en
 * línea y accesos directos de contacto (WhatsApp / email / teléfono).
 */
import { useCallback, useEffect, useState } from 'react'

import { apiGet, apiUpdate } from './api'

type Lead = {
  id: number | string
  displayName?: string
  name?: string
  phone?: string
  email?: string
  comment?: string
  preferredChannel?: string
  source?: string
  status?: string
  sqMeters?: number | null
  createdAt: string
  tileOfInterest?: { id: number | string; name: string; slug?: string } | null
  generationImageUrl?: string | null
}

const STATUS = [
  { value: 'new', label: 'Nuevo' },
  { value: 'contacting', label: 'En contacto' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
  { value: 'discarded', label: 'Descartado' },
]

const SOURCE: Record<string, string> = {
  simulator: 'Simulador IA',
  product_page: 'Ficha de producto',
  footer: 'Contacto general',
  contact_page: 'Página de contacto',
}

const CHANNEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  phone: 'Teléfono',
}

export function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const where = filter ? `&where[status][equals]=${filter}` : ''
      const data = await apiGet(`/leads?limit=200&sort=-createdAt&depth=1${where}`)
      setLeads(data.docs || [])
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(lead: Lead, status: string) {
    setLeads((arr) => arr.map((l) => (l.id === lead.id ? { ...l, status } : l)))
    try {
      await apiUpdate('leads', lead.id, { status })
    } catch {
      load()
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap gap-1 mb-4">
        <button
          onClick={() => setFilter('')}
          className={`text-sm px-3 py-1.5 rounded-md ${filter === '' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
        >
          Todos
        </button>
        {STATUS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`text-sm px-3 py-1.5 rounded-md ${filter === s.value ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
          No hay clientes con este filtro.
        </p>
      ) : (
        <div className="grid gap-3">
          {leads.map((l) => (
            <article key={String(l.id)} className="border border-border rounded-lg p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex-1 min-w-[55%]">
                  <p className="font-medium">
                    {l.displayName || l.name || 'Sin nombre'}
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      {new Date(l.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {SOURCE[l.source || ''] || l.source || '—'}
                    </span>
                  </p>
                  {l.comment && <p className="text-sm mt-1 whitespace-pre-wrap">{l.comment}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {[
                      l.tileOfInterest?.name && `Interesado en: ${l.tileOfInterest.name}`,
                      l.sqMeters && `${l.sqMeters} m² aprox.`,
                      l.preferredChannel && `Prefiere ${CHANNEL[l.preferredChannel] || l.preferredChannel}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <select
                  value={l.status || 'new'}
                  onChange={(e) => setStatus(l, e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                >
                  {STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {l.phone && (
                  <a
                    href={`https://wa.me/${l.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
                  >
                    WhatsApp: {l.phone}
                  </a>
                )}
                {l.phone && (
                  <a
                    href={`tel:${l.phone}`}
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
                  >
                    Llamar
                  </a>
                )}
                {l.email && (
                  <a
                    href={`mailto:${l.email}`}
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
                  >
                    {l.email}
                  </a>
                )}
                {l.generationImageUrl && (
                  <a
                    href={l.generationImageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
                  >
                    Ver su simulación →
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

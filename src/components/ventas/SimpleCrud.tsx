'use client'

/**
 * CRUD genérico para colecciones sencillas (marcas, colecciones, etiquetas):
 * lista con edición en línea, alta con el mismo formulario y borrado con
 * confirmación. Los campos se configuran por props; el slug se calcula solo.
 */
import { useCallback, useEffect, useState } from 'react'

import { apiCreate, apiDelete, apiGet, apiUpdate, slugify } from './api'
import { ImageField, RelationSelect, TextArea, TextField } from './fields'

export type CrudField =
  | { name: string; label: string; type: 'text'; placeholder?: string }
  | { name: string; label: string; type: 'textarea' }
  | { name: string; label: string; type: 'image'; hint?: string }
  | { name: string; label: string; type: 'relation'; collection: string }

type Doc = Record<string, any> & { id: number | string }

type Props = {
  collection: string
  /** Singular con artículo: "la marca", "el color"… para mensajes. */
  itemLabel: string
  fields: CrudField[]
  /** Campo extra a mostrar en la lista junto al nombre (p.ej. marca de la colección). */
  subtitleField?: string
}

function emptyValues(fields: CrudField[]): Record<string, any> {
  const v: Record<string, any> = { name: '' }
  for (const f of fields) v[f.name] = f.type === 'image' ? null : f.type === 'relation' ? null : ''
  return v
}

function toFormValues(doc: Doc, fields: CrudField[]): Record<string, any> {
  const v: Record<string, any> = { name: doc.name || '' }
  for (const f of fields) {
    const raw = doc[f.name]
    if (f.type === 'image') {
      v[f.name] =
        raw && typeof raw === 'object' && raw.id != null ? { id: raw.id, url: raw.url || '' } : null
    } else if (f.type === 'relation') {
      v[f.name] = raw == null ? null : typeof raw === 'object' ? raw.id : raw
    } else {
      v[f.name] = raw || ''
    }
  }
  return v
}

export function SimpleCrud({ collection, itemLabel, fields, subtitleField }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  /** null = cerrado, 'new' = alta, id = edición. */
  const [editing, setEditing] = useState<'new' | number | string | null>(null)
  const [values, setValues] = useState<Record<string, any>>(emptyValues(fields))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet(`/${collection}?limit=500&sort=name&depth=1`)
      setDocs(data.docs || [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [collection])

  useEffect(() => {
    load()
  }, [load])

  function openNew() {
    setValues(emptyValues(fields))
    setError(null)
    setEditing('new')
  }

  function openEdit(doc: Doc) {
    setValues(toFormValues(doc, fields))
    setError(null)
    setEditing(doc.id)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const data: Record<string, unknown> = { name: values.name }
    for (const f of fields) {
      const v = values[f.name]
      if (f.type === 'image') data[f.name] = v?.id ?? null
      else if (f.type === 'relation') data[f.name] = v
      else data[f.name] = v || null
    }
    try {
      if (editing === 'new') {
        await apiCreate(collection, { ...data, slug: slugify(values.name) })
      } else if (editing != null) {
        await apiUpdate(collection, editing, data)
      }
      setEditing(null)
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(doc: Doc) {
    if (!window.confirm(`¿Borrar ${itemLabel} "${doc.name}"?`)) return
    try {
      await apiDelete(collection, doc.id)
      await load()
    } catch (err) {
      alert(
        `No se pudo borrar: ${(err as Error).message}\n\nSuele pasar cuando hay azulejos que lo usan — cámbialos primero.`,
      )
    }
  }

  const imageField = fields.find((f) => f.type === 'image')

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <button
          onClick={openNew}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          + Añadir
        </button>
      </div>

      {editing != null && (
        <form onSubmit={save} className="border border-border rounded-lg p-4 mb-4 space-y-4 bg-muted/20">
          <p className="text-sm font-semibold">
            {editing === 'new' ? `Añadir ${itemLabel}` : `Editar ${itemLabel}`}
          </p>
          <TextField
            label="Nombre"
            required
            value={values.name}
            onChange={(x) => setValues((v) => ({ ...v, name: x }))}
          />
          {fields.map((f) => {
            if (f.type === 'text')
              return (
                <TextField
                  key={f.name}
                  label={f.label}
                  placeholder={f.placeholder}
                  value={values[f.name]}
                  onChange={(x) => setValues((v) => ({ ...v, [f.name]: x }))}
                />
              )
            if (f.type === 'textarea')
              return (
                <TextArea
                  key={f.name}
                  label={f.label}
                  value={values[f.name]}
                  onChange={(x) => setValues((v) => ({ ...v, [f.name]: x }))}
                />
              )
            if (f.type === 'image')
              return (
                <ImageField
                  key={f.name}
                  label={f.label}
                  hint={f.hint}
                  value={values[f.name]}
                  onChange={(x) => setValues((v) => ({ ...v, [f.name]: x }))}
                />
              )
            return (
              <RelationSelect
                key={f.name}
                label={f.label}
                collection={f.collection}
                value={values[f.name]}
                onChange={(x) => setValues((v) => ({ ...v, [f.name]: x }))}
              />
            )
          })}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed border-border rounded-lg">
          Todavía no hay ninguno.
        </p>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {docs.map((doc) => {
            const img = imageField ? doc[imageField.name] : null
            const subtitleRaw = subtitleField ? doc[subtitleField] : null
            const subtitle =
              subtitleRaw && typeof subtitleRaw === 'object' ? subtitleRaw.name : subtitleRaw
            return (
              <div key={String(doc.id)} className="flex items-center gap-3 p-3">
                {imageField &&
                  (img && typeof img === 'object' && img.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.url}
                      alt=""
                      className="w-10 h-10 object-contain rounded border border-border bg-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded border border-dashed border-border" />
                  ))}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
                </div>
                <button
                  onClick={() => openEdit(doc)}
                  className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted"
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(doc)}
                  className="text-sm px-2.5 py-1.5 border border-border rounded-md hover:bg-destructive/10 text-destructive"
                  aria-label={`Borrar ${doc.name}`}
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

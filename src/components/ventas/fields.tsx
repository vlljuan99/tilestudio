'use client'

/**
 * Campos reutilizables de los formularios de la zona de ventas: inputs con
 * etiqueta, select de relación con creación al vuelo, selección múltiple con
 * chips y subida de imagen con vista previa y progreso.
 */
import { useEffect, useRef, useState } from 'react'

import { createOption, findSimilarOption, loadOptions, uploadMedia, type Option } from './api'

export function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
      />
    </label>
  )
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <label className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
}) {
  return (
    <label className="flex items-start gap-2 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4"
      />
      <span>
        {label}
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

/**
 * Diálogo de alta rápida de un valor de taxonomía sin salir del formulario.
 *
 * Avisa si ya existe uno equivalente escrito de otra forma ("PAMESA cerámica"
 * cuando ya hay "Pamesa") — así el catálogo no se llena de marcas repetidas.
 * Para marcas permite además subir el logo en el momento.
 */
function CreateOptionDialog({
  label,
  collection,
  options,
  onCancel,
  onCreated,
  onPickExisting,
}: {
  label: string
  collection: string
  options: Option[]
  onCancel: () => void
  onCreated: (opt: Option) => void
  onPickExisting: (opt: Option) => void
}) {
  const [name, setName] = useState('')
  const [logo, setLogo] = useState<{ id: number | string; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const similar = name.trim() ? findSimilarOption(options, name, collection) : undefined
  const isBrand = collection === 'brands'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      const extra = isBrand && logo ? { logo: logo.id } : {}
      onCreated(await createOption(collection, name.trim(), extra))
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
      <div className="bg-background border border-border rounded-lg p-5 w-full max-w-sm space-y-4">
        <p className="font-semibold">Añadir {label.toLowerCase()}</p>

        <TextField label="Nombre" required value={name} onChange={setName} />

        {similar && (
          <div className="p-3 rounded-md bg-amber-500/10 text-xs space-y-2">
            <p>
              Ya existe <strong>{similar.name}</strong>, que parece la misma. Si creas otra, el
              catálogo quedará dividido entre las dos.
            </p>
            <button
              type="button"
              onClick={() => onPickExisting(similar)}
              className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground"
            >
              Usar {similar.name}
            </button>
          </div>
        )}

        {isBrand && <ImageField label="Logo (opcional)" value={logo} onChange={setLogo} />}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Creando…' : 'Crear'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Select de relación (marca, formato, acabado…) que permite crear el valor al
 * vuelo: la opción "＋ Crear…" abre el diálogo de alta sin salir del formulario.
 */
export function RelationSelect({
  label,
  collection,
  value,
  onChange,
  allowEmpty = true,
}: {
  label: string
  collection: string
  value: number | string | null
  onChange: (v: number | string | null) => void
  allowEmpty?: boolean
}) {
  const [options, setOptions] = useState<Option[]>([])
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadOptions(collection)
      .then(setOptions)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [collection])

  function handleChange(v: string) {
    if (v === '__create__') {
      setCreating(true)
      return
    }
    onChange(v === '' ? null : options.find((o) => String(o.id) === v)?.id ?? null)
  }

  return (
    <label className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      <select
        value={value == null ? '' : String(value)}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        {allowEmpty && <option value="">{loaded ? '—' : 'Cargando…'}</option>}
        {options.map((o) => (
          <option key={String(o.id)} value={String(o.id)}>
            {o.name}
          </option>
        ))}
        <option value="__create__">＋ Crear…</option>
      </select>

      {creating && (
        <CreateOptionDialog
          label={label}
          collection={collection}
          options={options}
          onCancel={() => setCreating(false)}
          onPickExisting={(opt) => {
            onChange(opt.id)
            setCreating(false)
          }}
          onCreated={(opt) => {
            setOptions((arr) => [...arr, opt].sort((a, b) => a.name.localeCompare(b.name)))
            onChange(opt.id)
            setCreating(false)
          }}
        />
      )}
    </label>
  )
}

/** Selección múltiple con chips (colores, usos, estancias). */
export function RelationMultiSelect({
  label,
  collection,
  values,
  onChange,
}: {
  label: string
  collection: string
  values: (number | string)[]
  onChange: (v: (number | string)[]) => void
}) {
  const [options, setOptions] = useState<Option[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadOptions(collection)
      .then(setOptions)
      .catch(() => {})
  }, [collection])

  const selected = options.filter((o) => values.some((v) => String(v) === String(o.id)))

  function addId(id: number | string) {
    if (!values.some((x) => String(x) === String(id))) onChange([...values, id])
  }

  function add(v: string) {
    if (v === '') return
    if (v === '__create__') {
      setCreating(true)
      return
    }
    const opt = options.find((o) => String(o.id) === v)
    if (opt) addId(opt.id)
  }

  return (
    <div className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {selected.map((o) => (
          <span
            key={String(o.id)}
            className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full"
          >
            {o.name}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => String(v) !== String(o.id)))}
              className="opacity-60 hover:opacity-100"
              aria-label={`Quitar ${o.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <select
        value=""
        onChange={(e) => add(e.target.value)}
        className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Añadir…</option>
        {options
          .filter((o) => !values.some((v) => String(v) === String(o.id)))
          .map((o) => (
            <option key={String(o.id)} value={String(o.id)}>
              {o.name}
            </option>
          ))}
        <option value="__create__">＋ Crear…</option>
      </select>

      {creating && (
        <CreateOptionDialog
          label={label}
          collection={collection}
          options={options}
          onCancel={() => setCreating(false)}
          onPickExisting={(opt) => {
            addId(opt.id)
            setCreating(false)
          }}
          onCreated={(opt) => {
            setOptions((arr) => [...arr, opt].sort((a, b) => a.name.localeCompare(b.name)))
            addId(opt.id)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

/** Subida de imagen con vista previa, progreso y reemplazo. */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  required,
}: {
  label: string
  /** {id, url} de Media, o null. */
  value: { id: number | string; url: string } | null
  onChange: (v: { id: number | string; url: string } | null) => void
  hint?: string
  required?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    setProgress(0)
    try {
      const media = await uploadMedia(file, setProgress)
      onChange({ id: media.id, url: media.url })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="block text-sm">
      <span className="block text-xs text-muted-foreground mb-1">
        {label}
        {required ? ' *' : ''}
      </span>
      <div className="flex items-center gap-3">
        {value?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.url}
            alt=""
            className="w-20 h-20 object-cover rounded-md border border-border"
          />
        ) : (
          <div className="w-20 h-20 rounded-md border border-dashed border-border grid place-items-center text-xs text-muted-foreground">
            sin foto
          </div>
        )}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={progress != null}
            className="text-sm px-3 py-1.5 border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            {progress != null
              ? `Subiendo… ${progress}%`
              : value
                ? 'Cambiar foto'
                : 'Subir foto'}
          </button>
          {value && progress == null && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="block text-xs text-muted-foreground hover:underline"
            >
              Quitar
            </button>
          )}
          {hint && <p className="text-xs text-muted-foreground max-w-[280px]">{hint}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

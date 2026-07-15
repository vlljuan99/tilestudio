'use client'

/**
 * Campos reutilizables de los formularios de la zona de ventas: inputs con
 * etiqueta, select de relación con creación al vuelo, selección múltiple con
 * chips y subida de imagen con vista previa y progreso.
 */
import { useEffect, useRef, useState } from 'react'

import { createOption, loadOptions, uploadMedia, type Option } from './api'

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
 * Select de relación (marca, formato, acabado…) que permite crear el valor al
 * vuelo: la opción "＋ Crear…" pide el nombre y lo da de alta sin salir del
 * formulario.
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

  useEffect(() => {
    loadOptions(collection)
      .then(setOptions)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [collection])

  async function handleChange(v: string) {
    if (v === '__create__') {
      const name = window.prompt(`Nombre de ${label.toLowerCase()} nuevo:`)
      if (!name?.trim()) return
      try {
        const opt = await createOption(collection, name.trim())
        setOptions((arr) => [...arr, opt].sort((a, b) => a.name.localeCompare(b.name)))
        onChange(opt.id)
      } catch (err) {
        alert((err as Error).message)
      }
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

  useEffect(() => {
    loadOptions(collection)
      .then(setOptions)
      .catch(() => {})
  }, [collection])

  const selected = options.filter((o) => values.some((v) => String(v) === String(o.id)))

  async function add(v: string) {
    if (v === '') return
    if (v === '__create__') {
      const name = window.prompt(`Nombre de ${label.toLowerCase()} nuevo:`)
      if (!name?.trim()) return
      try {
        const opt = await createOption(collection, name.trim())
        setOptions((arr) => [...arr, opt].sort((a, b) => a.name.localeCompare(b.name)))
        onChange([...values, opt.id])
      } catch (err) {
        alert((err as Error).message)
      }
      return
    }
    const opt = options.find((o) => String(o.id) === v)
    if (opt && !values.some((x) => String(x) === String(opt.id))) onChange([...values, opt.id])
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

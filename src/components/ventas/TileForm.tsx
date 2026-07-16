'use client'

/**
 * Formulario de azulejo para comerciales: lo esencial visible (nombre, código,
 * marca, colección, fotos, formato, precio, publicado) y el resto plegado en
 * "Más opciones". Sirve para crear y editar; el slug se calcula solo.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { apiCreate, apiDelete, apiUpdate, slugify } from './api'
import {
  ImageField,
  RelationMultiSelect,
  RelationSelect,
  TextArea,
  TextField,
  Toggle,
} from './fields'
import { useUnsavedWarning } from './useUnsavedWarning'

type MediaRef = { id: number | string; url: string } | null

export type TileFormValues = {
  id?: number | string
  name: string
  sku: string
  description: string
  mainImage: MediaRef
  textureImage: MediaRef
  brand: number | string | null
  collection: number | string | null
  format: number | string | null
  finish: number | string | null
  colors: (number | string)[]
  usages: (number | string)[]
  rooms: (number | string)[]
  orientativePrice: string
  priceUnit: string
  published: boolean
  featured: boolean
  aiReady: boolean
}

export function emptyTile(): TileFormValues {
  return {
    name: '',
    sku: '',
    description: '',
    mainImage: null,
    textureImage: null,
    brand: null,
    collection: null,
    format: null,
    finish: null,
    colors: [],
    usages: [],
    rooms: [],
    orientativePrice: '',
    priceUnit: 'm2',
    published: true,
    featured: false,
    aiReady: false,
  }
}

export function TileForm({ initial }: { initial: TileFormValues }) {
  const router = useRouter()
  const [v, setV] = useState<TileFormValues>(initial)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = initial.id == null

  useUnsavedWarning(dirty)

  function set<K extends keyof TileFormValues>(key: K, value: TileFormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!v.mainImage) {
      setError('La foto principal es obligatoria.')
      return
    }
    setBusy(true)
    setError(null)
    const data: Record<string, unknown> = {
      name: v.name,
      sku: v.sku || null,
      description: v.description || null,
      mainImage: v.mainImage.id,
      textureImage: v.textureImage?.id ?? null,
      brand: v.brand,
      collection: v.collection,
      format: v.format,
      finish: v.finish,
      colors: v.colors,
      usages: v.usages,
      rooms: v.rooms,
      orientativePrice: v.orientativePrice === '' ? null : Number(v.orientativePrice),
      priceUnit: v.priceUnit,
      published: v.published,
      featured: v.featured,
      aiReady: v.aiReady,
    }
    try {
      if (isNew) {
        await apiCreate('tiles', { ...data, slug: slugify(v.name) })
      } else {
        await apiUpdate('tiles', initial.id!, data)
      }
      // Antes de navegar: si no, el aviso de "sin guardar" salta al salir.
      setDirty(false)
      router.push('/ventas/azulejos')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!initial.id) return
    if (!window.confirm(`¿Borrar "${initial.name}"? Desaparecerá de la web.`)) return
    setBusy(true)
    setDirty(false)
    try {
      await apiDelete('tiles', initial.id)
      router.push('/ventas/azulejos')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-5">
      <nav className="text-xs text-muted-foreground">
        <Link href="/ventas/azulejos" className="hover:underline">
          ← Azulejos
        </Link>
      </nav>
      <h1 className="text-2xl">{isNew ? 'Nuevo azulejo' : v.name || 'Editar azulejo'}</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        <TextField label="Nombre" required value={v.name} onChange={(x) => set('name', x)} />
        <TextField
          label="Código de referencia (SKU)"
          value={v.sku}
          onChange={(x) => set('sku', x)}
          placeholder="Ej. SOL23"
        />
        <RelationSelect
          label="Marca"
          collection="brands"
          value={v.brand}
          onChange={(x) => set('brand', x)}
        />
        <RelationSelect
          label="Colección / serie"
          collection="collections"
          value={v.collection}
          onChange={(x) => set('collection', x)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <ImageField
          label="Foto principal"
          required
          value={v.mainImage}
          onChange={(x) => set('mainImage', x)}
        />
        <ImageField
          label="Textura (para el simulador IA)"
          value={v.textureImage}
          onChange={(x) => set('textureImage', x)}
          hint="Imagen plana del azulejo, sin perspectiva. Si falta, el simulador usa la foto principal."
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <RelationSelect
          label="Formato"
          collection="formats"
          value={v.format}
          onChange={(x) => set('format', x)}
        />
        <TextField
          label="Precio orientativo (€)"
          type="number"
          value={v.orientativePrice}
          onChange={(x) => set('orientativePrice', x)}
          placeholder="Vacío = consultar"
        />
        <label className="block text-sm">
          <span className="block text-xs text-muted-foreground mb-1">Unidad</span>
          <select
            value={v.priceUnit}
            onChange={(e) => set('priceUnit', e.target.value)}
            className="w-full h-10 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="m2">€ / m²</option>
            <option value="unit">€ / unidad</option>
            <option value="box">€ / caja</option>
          </select>
        </label>
      </div>

      <Toggle
        label="Publicado en la web"
        checked={v.published}
        onChange={(x) => set('published', x)}
      />

      <details className="border border-border rounded-lg">
        <summary className="px-4 py-3 text-sm font-medium cursor-pointer select-none">
          Más opciones
        </summary>
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <TextArea
            label="Descripción"
            value={v.description}
            onChange={(x) => set('description', x)}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <RelationSelect
              label="Acabado"
              collection="finishes"
              value={v.finish}
              onChange={(x) => set('finish', x)}
            />
            <RelationMultiSelect
              label="Colores"
              collection="colors"
              values={v.colors}
              onChange={(x) => set('colors', x)}
            />
            <RelationMultiSelect
              label="Usos"
              collection="usages"
              values={v.usages}
              onChange={(x) => set('usages', x)}
            />
            <RelationMultiSelect
              label="Estancias"
              collection="rooms"
              values={v.rooms}
              onChange={(x) => set('rooms', x)}
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <Toggle
              label="Destacado en la portada"
              checked={v.featured}
              onChange={(x) => set('featured', x)}
            />
            <Toggle
              label="Apto para el simulador IA"
              checked={v.aiReady}
              onChange={(x) => set('aiReady', x)}
              hint="Marcar solo con textura validada."
            />
          </div>
        </div>
      </details>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="px-5 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Guardando…' : isNew ? 'Crear azulejo' : 'Guardar cambios'}
        </button>
        {!isNew && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="px-4 py-2.5 rounded-md border border-destructive/40 text-destructive text-sm hover:bg-destructive/5 disabled:opacity-50"
          >
            Borrar
          </button>
        )}
      </div>
    </form>
  )
}

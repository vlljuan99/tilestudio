'use client'

import { useState } from 'react'

import { SimpleCrud, type CrudField } from '@/components/ventas/SimpleCrud'

const TABS: Array<{ key: string; label: string; itemLabel: string; fields: CrudField[] }> = [
  {
    key: 'colors',
    label: 'Colores',
    itemLabel: 'el color',
    fields: [{ name: 'hex', label: 'Color hex (#RRGGBB)', type: 'text', placeholder: '#d8c7a5' }],
  },
  { key: 'finishes', label: 'Acabados', itemLabel: 'el acabado', fields: [] },
  { key: 'formats', label: 'Formatos', itemLabel: 'el formato', fields: [] },
  { key: 'usages', label: 'Usos', itemLabel: 'el uso', fields: [] },
  { key: 'rooms', label: 'Estancias', itemLabel: 'la estancia', fields: [] },
]

export default function EtiquetasPage() {
  const [tab, setTab] = useState('colors')
  const active = TABS.find((t) => t.key === tab)!

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl">Etiquetas</h1>
        <p className="text-sm text-muted-foreground">
          Los valores por los que tus clientes filtran el catálogo.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-sm px-3 py-1.5 rounded-md ${
              tab === t.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <SimpleCrud
        key={active.key}
        collection={active.key}
        itemLabel={active.itemLabel}
        fields={active.fields}
      />
    </div>
  )
}

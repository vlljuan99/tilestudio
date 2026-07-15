'use client'

import { useState } from 'react'
import { Calculator } from 'lucide-react'

// Estimación orientativa: m² introducidos + margen de recorte sobre el
// precio €/m². Solo se muestra para azulejos con precio por m².
const WASTE_FACTOR = 1.1

export function TileCalculator({ pricePerM2 }: { pricePerM2: number }) {
  const [input, setInput] = useState('')
  const [withWaste, setWithWaste] = useState(true)

  const m2 = parseFloat(input.replace(',', '.'))
  const valid = !isNaN(m2) && m2 > 0
  const effectiveM2 = valid ? m2 * (withWaste ? WASTE_FACTOR : 1) : 0
  const total = effectiveM2 * pricePerM2

  const fmt = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="border-t border-border pt-6 space-y-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        <Calculator className="h-3.5 w-3.5" /> Calcula tu presupuesto orientativo
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0"
            aria-label="Metros cuadrados a cubrir"
            className="w-24 h-10 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          m² a cubrir
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={withWaste}
            onChange={(e) => setWithWaste(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          +10% para recortes
        </label>
      </div>
      {valid && (
        <p className="text-sm">
          Aproximadamente <span className="font-medium text-lg">{fmt.format(total)} €</span>{' '}
          <span className="text-muted-foreground">
            ({fmt.format(effectiveM2)} m² × {fmt.format(pricePerM2)} €/m²)
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Estimación orientativa, sin material de colocación. Te confirmamos el precio final al
        contactar.
      </p>
    </div>
  )
}

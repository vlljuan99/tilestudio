'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, Camera, Upload, Check, Loader2, ArrowLeft, MessageCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Tile = {
  id: number | string
  name: string
  slug: string
  sku?: string | null
  mainImage?: { url?: string | null; alt?: string | null } | null
  format?: { name?: string | null } | null
  finish?: { name?: string | null } | null
}

type Props = {
  initialTile: Tile | null
  catalog: Tile[]
}

const SESSION_STORAGE_KEY = 'tilestudio.simulatorSessionToken'

const WALL_COLOR_PALETTE: { hex: string; name: string }[] = [
  { hex: '#F5F1EA', name: 'Blanco roto' },
  { hex: '#EEE6D8', name: 'Hueso' },
  { hex: '#D9C9A8', name: 'Beige' },
  { hex: '#C9C5BF', name: 'Gris claro' },
  { hex: '#9A9690', name: 'Gris medio' },
  { hex: '#B5C0AC', name: 'Salvia' },
  { hex: '#A7B5C2', name: 'Azul niebla' },
  { hex: '#E6CCC0', name: 'Rosa palo' },
  { hex: '#B36242', name: 'Terracota' },
  { hex: '#1F1B17', name: 'Carbón' },
]

type Step = 1 | 2 | 3 | 4

export function SimulatorWizard({ initialTile, catalog }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(initialTile ? 2 : 1)
  const [selectedTile, setSelectedTile] = useState<Tile | null>(initialTile)
  const [userImage, setUserImage] = useState<File | null>(null)
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null)
  const [surfaces, setSurfaces] = useState<Array<'floor' | 'wall'>>(['floor'])
  const [wallColor, setWallColor] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!userImage) {
      setUserImagePreview(null)
      return
    }
    const url = URL.createObjectURL(userImage)
    setUserImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [userImage])

  const canGoToStep3 = !!(selectedTile && userImage)
  const canGenerate = canGoToStep3 && surfaces.length > 0

  function toggleSurface(s: 'floor' | 'wall') {
    setSurfaces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen.')
      return
    }
    if (f.size > 12 * 1024 * 1024) {
      setError('La imagen pesa más de 12 MB. Elige otra.')
      return
    }
    setError(null)
    setUserImage(f)
  }

  async function generate() {
    if (!selectedTile || !userImage) return
    setSubmitting(true)
    setError(null)
    setStep(4)

    const form = new FormData()
    form.append('userImage', userImage)
    form.append('tileId', String(selectedTile.id))
    form.append('surfaces', surfaces.join(','))
    if (wallColor) form.append('wallColor', wallColor)

    const existingToken = typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_STORAGE_KEY) : null
    if (existingToken) form.append('sessionToken', existingToken)

    try {
      const res = await fetch('/api/simulator/generate', {
        method: 'POST',
        body: form,
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'No se pudo generar la simulación.')
      }

      if (data.sessionToken) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, data.sessionToken)
      }
      router.push(data.shareUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido.')
      setStep(3)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container py-8 md:py-12 max-w-4xl">
      <StepHeader step={step} />

      {step === 1 && (
        <TilePicker
          catalog={catalog}
          onSelect={(t) => {
            setSelectedTile(t)
            setStep(2)
          }}
        />
      )}

      {step === 2 && selectedTile && (
        <PhotoStep
          tile={selectedTile}
          preview={userImagePreview}
          onPickAnotherTile={() => setStep(1)}
          onSelectFile={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
          onFileChange={onFileChange}
          onNext={() => setStep(3)}
          canContinue={canGoToStep3}
          error={error}
        />
      )}

      {step === 3 && selectedTile && (
        <ConfigStep
          tile={selectedTile}
          surfaces={surfaces}
          toggleSurface={toggleSurface}
          wallColor={wallColor}
          setWallColor={setWallColor}
          onBack={() => setStep(2)}
          onGenerate={generate}
          canGenerate={canGenerate}
          error={error}
        />
      )}

      {step === 4 && <GeneratingStep error={error} onRetry={() => setStep(3)} />}
    </div>
  )
}

function StepHeader({ step }: { step: Step }) {
  const labels: Record<Step, string> = {
    1: 'Elige un azulejo',
    2: 'Sube una foto de tu estancia',
    3: 'Configura la simulación',
    4: 'Generando...',
  }
  return (
    <header className="mb-8">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Paso {step} de 4
      </p>
      <h1 className="text-3xl md:text-4xl mt-1">{labels[step]}</h1>
    </header>
  )
}

function TilePicker({
  catalog,
  onSelect,
}: {
  catalog: Tile[]
  onSelect: (t: Tile) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {catalog.map((tile) => (
        <button
          key={tile.id}
          type="button"
          onClick={() => onSelect(tile)}
          className="group text-left focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
        >
          <div className="aspect-square relative overflow-hidden rounded-lg bg-muted">
            {tile.mainImage?.url && (
              <Image
                src={tile.mainImage.url}
                alt={tile.mainImage.alt || tile.name}
                fill
                loading="eager"
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-tight">{tile.name}</p>
          <p className="text-xs text-muted-foreground">{tile.format?.name}</p>
        </button>
      ))}
    </div>
  )
}

function PhotoStep({
  tile,
  preview,
  onPickAnotherTile,
  onSelectFile,
  fileInputRef,
  onFileChange,
  onNext,
  canContinue,
  error,
}: {
  tile: Tile
  preview: string | null
  onPickAnotherTile: () => void
  onSelectFile: () => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onNext: () => void
  canContinue: boolean
  error: string | null
}) {
  return (
    <div className="space-y-6">
      <SelectedTileBar tile={tile} onChange={onPickAnotherTile} />

      <div
        onClick={onSelectFile}
        className={cn(
          'border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:bg-muted/40 transition-colors',
          preview && 'p-0 border-0',
        )}
      >
        {preview ? (
          <div className="aspect-[4/3] relative rounded-lg overflow-hidden">
            <img src={preview} alt="Tu foto" className="absolute inset-0 w-full h-full object-cover" />
            <button
              type="button"
              className="absolute top-3 right-3 bg-background/90 rounded-full px-3 py-1 text-xs hover:bg-background"
              onClick={(e) => {
                e.stopPropagation()
                onSelectFile()
              }}
            >
              Cambiar foto
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center">
              <Camera className="h-7 w-7" />
            </div>
            <p className="font-medium">Toca para hacer una foto o subir una</p>
            <p className="text-sm text-muted-foreground">
              Mejor con buena luz, encuadre amplio y sin reflejos.
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/catalogo">
            <ArrowLeft className="h-4 w-4" /> Volver al catálogo
          </Link>
        </Button>
        <Button onClick={onNext} disabled={!canContinue}>
          Continuar
        </Button>
      </div>
    </div>
  )
}

function ConfigStep({
  tile,
  surfaces,
  toggleSurface,
  wallColor,
  setWallColor,
  onBack,
  onGenerate,
  canGenerate,
  error,
}: {
  tile: Tile
  surfaces: Array<'floor' | 'wall'>
  toggleSurface: (s: 'floor' | 'wall') => void
  wallColor: string | null
  setWallColor: (c: string | null) => void
  onBack: () => void
  onGenerate: () => void
  canGenerate: boolean
  error: string | null
}) {
  return (
    <div className="space-y-8">
      <SelectedTileBar tile={tile} onChange={onBack} changeLabel="Cambiar foto/azulejo" />

      <section className="space-y-3">
        <h2 className="text-xl">¿Dónde quieres aplicar el azulejo?</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['floor', 'wall'] as const).map((s) => {
            const active = surfaces.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSurface(s)}
                className={cn(
                  'border rounded-lg p-4 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-foreground/40',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{s === 'floor' ? 'Suelo' : 'Pared'}</span>
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {s === 'floor' ? 'Aplica al suelo de la estancia.' : 'Aplica a las paredes visibles.'}
                </p>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Puedes seleccionar las dos si tiene sentido en tu espacio.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl">¿Quieres cambiar el color de la pared?</h2>
        <p className="text-xs text-muted-foreground">
          Opcional. Solo afecta a las paredes que no estén cubiertas por azulejos.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setWallColor(null)}
            className={cn(
              'h-10 px-3 rounded-md border text-sm',
              wallColor === null ? 'border-primary bg-primary/5' : 'border-border',
            )}
          >
            Mantener
          </button>
          {WALL_COLOR_PALETTE.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => setWallColor(c.hex)}
              className={cn(
                'h-10 w-10 rounded-md border-2 transition-transform',
                wallColor === c.hex ? 'border-foreground scale-110' : 'border-border',
              )}
              style={{ backgroundColor: c.hex }}
              title={c.name}
              aria-label={c.name}
            />
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-between items-center pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Atrás
        </Button>
        <Button size="lg" onClick={onGenerate} disabled={!canGenerate}>
          <Sparkles className="h-5 w-5" /> Generar simulación
        </Button>
      </div>
    </div>
  )
}

function GeneratingStep({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const stages = useMemo(
    () => [
      'Analizando tu foto…',
      'Identificando superficies…',
      'Aplicando textura del azulejo…',
      'Ajustando perspectiva, luz y sombras…',
      'Finalizando resultado…',
    ],
    [],
  )
  const [stageIdx, setStageIdx] = useState(0)

  useEffect(() => {
    if (error) return
    const i = setInterval(() => setStageIdx((v) => Math.min(v + 1, stages.length - 1)), 4000)
    return () => clearInterval(i)
  }, [error, stages.length])

  if (error) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-lg">La generación no salió bien.</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={onRetry} variant="outline">
          Probar de nuevo
        </Button>
      </div>
    )
  }

  return (
    <div className="py-20 text-center space-y-6">
      <Loader2 className="h-10 w-10 mx-auto animate-spin text-accent" />
      <div className="space-y-1">
        <p className="text-lg font-medium">{stages[stageIdx]}</p>
        <p className="text-sm text-muted-foreground">
          Esto suele tardar entre 30 y 60 segundos. No cierres la ventana.
        </p>
      </div>
    </div>
  )
}

function SelectedTileBar({
  tile,
  onChange,
  changeLabel,
}: {
  tile: Tile
  onChange: () => void
  changeLabel?: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
      <div className="h-14 w-14 rounded relative overflow-hidden bg-muted shrink-0">
        {tile.mainImage?.url && (
          <Image
            src={tile.mainImage.url}
            alt={tile.mainImage.alt || tile.name}
            fill
            loading="eager"
            sizes="56px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">Azulejo seleccionado</p>
        <p className="font-medium truncate">{tile.name}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={onChange}>
        {changeLabel || 'Cambiar'}
      </Button>
    </div>
  )
}

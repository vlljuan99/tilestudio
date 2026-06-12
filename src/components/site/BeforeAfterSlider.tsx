'use client'

import { useEffect, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

interface BeforeAfterSliderProps {
  beforeSrc?: string
  afterSrc?: string
  beforeAlt?: string
  afterAlt?: string
  className?: string
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeAlt = 'Antes',
  afterAlt = 'Con IA',
  className = '',
}: BeforeAfterSliderProps) {
  const [pos, setPos] = useState(50) // 0-100 %
  const [isDragging, setIsDragging] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intro sweep animation
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => setPos(25), 600))
    timers.push(setTimeout(() => setPos(75), 1600))
    timers.push(setTimeout(() => setPos(50), 2600))
    return () => timers.forEach(clearTimeout)
  }, [])

  const calcPos = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 50
    return Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100))
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      setPos(calcPos(e.clientX))
    }
    const onTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return
      e.preventDefault()
      setPos(calcPos(e.touches[0].clientX))
    }
    const onEnd = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      setIsDragging(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [])

  const startDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    draggingRef.current = true
    setIsDragging(true)
    setHasInteracted(true)
  }

  const transition = isDragging ? 'none' : 'clip-path 0.85s cubic-bezier(0.4,0,0.2,1)'
  const handleTransition = isDragging ? 'none' : 'left 0.85s cubic-bezier(0.4,0,0.2,1)'

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl select-none touch-none shadow-2xl ${className}`}
      style={{ cursor: isDragging ? 'col-resize' : 'default' }}
    >
      {/* AFTER layer – full width */}
      <div className="absolute inset-0">
        {afterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={afterSrc} alt={afterAlt} className="w-full h-full object-cover" />
        ) : (
          <AfterPlaceholder />
        )}
      </div>

      {/* BEFORE layer – clipped to left side */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)`, transition }}
      >
        {beforeSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beforeSrc} alt={beforeAlt} className="w-full h-full object-cover" />
        ) : (
          <BeforePlaceholder />
        )}
      </div>

      {/* Labels */}
      <div
        className="absolute bottom-4 left-4 z-10 pointer-events-none"
        style={{ opacity: pos > 8 ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        <span className="text-xs uppercase tracking-widest font-semibold text-stone-600 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
          Antes
        </span>
      </div>
      <div
        className="absolute bottom-4 right-4 z-10 pointer-events-none"
        style={{ opacity: pos < 92 ? 1 : 0, transition: 'opacity 0.3s' }}
      >
        <span className="text-xs uppercase tracking-widest font-semibold text-primary bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
          ✦ Con IA
        </span>
      </div>

      {/* Divider line + handle */}
      <div
        className="absolute top-0 bottom-0 z-20"
        style={{
          left: `${pos}%`,
          transform: 'translateX(-50%)',
          transition: handleTransition,
          width: 2,
          background: 'white',
          boxShadow: '0 0 12px rgba(0,0,0,0.35)',
        }}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        {/* Handle button */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Ping ring – only during intro */}
          {!hasInteracted && (
            <div className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
          )}
          <div
            className="relative w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-primary/20 cursor-col-resize transition-transform duration-150"
            style={{ transform: isDragging ? 'scale(1.15)' : 'scale(1)' }}
          >
            <MoveHorizontal className="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      {/* Hint label – fades after interaction */}
      {!hasInteracted && (
        <div className="absolute inset-x-0 top-4 flex justify-center z-10 pointer-events-none animate-bounce">
          <span className="text-[11px] font-medium text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full tracking-wide">
            ← Desliza →
          </span>
        </div>
      )}
    </div>
  )
}

function BeforePlaceholder() {
  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: '#e8e4dc',
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
      }}
    >
      {/* Simulated bare wall / floor */}
      <div className="absolute inset-0 flex flex-col justify-end">
        <div className="h-2/5 bg-stone-200/60" />
      </div>
    </div>
  )
}

function AfterPlaceholder() {
  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: '#dbeafe',
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 47px, rgba(99,102,241,0.18) 47px, rgba(99,102,241,0.18) 49px),
          repeating-linear-gradient(90deg, transparent, transparent 47px, rgba(99,102,241,0.18) 47px, rgba(99,102,241,0.18) 49px)
        `,
        backgroundSize: '49px 49px',
      }}
    >
      {/* Simulated tiled floor */}
      <div className="absolute inset-0 flex flex-col justify-end">
        <div
          className="h-2/5"
          style={{
            backgroundColor: 'rgba(99,102,241,0.12)',
            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(99,102,241,0.2) 23px, rgba(99,102,241,0.2) 25px),
              repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(99,102,241,0.2) 23px, rgba(99,102,241,0.2) 25px)
            `,
            backgroundSize: '25px 25px',
          }}
        />
      </div>
    </div>
  )
}

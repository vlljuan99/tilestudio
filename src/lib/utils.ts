import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(value: number | null | undefined, unit?: string | null) {
  if (value == null) return 'Consultar precio'
  const unitLabel = unit === 'm2' ? '€/m²' : unit === 'box' ? '€/caja' : '€/ud'
  return `${new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${unitLabel}`
}

export function buildWhatsAppLink({
  number,
  message,
}: {
  number?: string | null
  message: string
}): string | null {
  if (!number) return null
  const sanitized = number.replace(/[^\d]/g, '')
  if (!sanitized) return null
  return `https://wa.me/${sanitized}?text=${encodeURIComponent(message)}`
}

import { MessageCircle } from 'lucide-react'
import { buildWhatsAppLink } from '@/lib/utils'

type Props = {
  settings: { whatsappNumber?: string | null; siteName?: string | null } | null
}

export function WhatsAppFab({ settings }: Props) {
  const link = buildWhatsAppLink({
    number: settings?.whatsappNumber,
    message: `Hola, vengo de la web de ${settings?.siteName || 'Tilestudio'} y me gustaría más información.`,
  })

  if (!link) return null

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#1ebd5b] transition-colors"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  )
}

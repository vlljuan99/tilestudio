import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Configuración del sitio',
  admin: {
    group: 'Configuración',
    description:
      'Datos de marca, contacto y contenidos editables. Todo es configurable sin tocar código.',
  },
  access: {
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Marca',
          fields: [
            { name: 'siteName', label: 'Nombre del sitio', type: 'text', defaultValue: 'Tilestudio' },
            {
              name: 'tagline',
              label: 'Frase de marca',
              type: 'text',
              defaultValue: 'Showroom de azulejos con simulación visual por IA',
            },
            { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'media' },
            {
              name: 'favicon',
              label: 'Favicon (icono de pestaña)',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description:
                  'Icono pequeño que aparece en la pestaña del navegador. Recomendado: PNG cuadrado de 32×32 o 64×64 px.',
              },
            },
          ],
        },
        {
          label: 'Contacto',
          fields: [
            {
              name: 'whatsappNumber',
              label: 'Número de WhatsApp',
              type: 'text',
              admin: {
                description:
                  'Formato internacional sin signos: ej. 34600000000. Usado para wa.me/<numero>.',
              },
            },
            { name: 'phone', label: 'Teléfono', type: 'text' },
            { name: 'email', label: 'Email comercial', type: 'email' },
            { name: 'address', label: 'Dirección del showroom', type: 'textarea' },
            { name: 'openingHours', label: 'Horario', type: 'textarea' },
          ],
        },
        {
          label: 'Home',
          fields: [
            { name: 'heroTitle', label: 'Título hero', type: 'text' },
            { name: 'heroSubtitle', label: 'Subtítulo hero', type: 'textarea' },
            {
              name: 'heroImage',
              label: 'Imagen hero',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'aboutShort',
              label: 'Sobre nosotros (resumen)',
              type: 'textarea',
            },
          ],
        },
        {
          label: 'Apariencia',
          description:
            'Personaliza cómo se ve tu web pública: colores de marca, tipografía y forma. Pulsa "Sugerir paleta desde el logo" para que el sistema saque los colores principales de tu logotipo automáticamente.',
          fields: [
            {
              name: 'paletteAssistant',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/payload/PaletteAssistant',
                },
              },
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'colorPrimary',
                  label: 'Color principal',
                  type: 'text',
                  admin: {
                    description: 'Botones, enlaces, acentos importantes.',
                    components: { Field: '/components/payload/ColorField' },
                  },
                },
                {
                  name: 'colorAccent',
                  label: 'Color de acento',
                  type: 'text',
                  admin: {
                    description: 'Para etiquetas, badges, detalles.',
                    components: { Field: '/components/payload/ColorField' },
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'colorBackground',
                  label: 'Color de fondo',
                  type: 'text',
                  admin: {
                    description: 'Color base de la web (claro).',
                    components: { Field: '/components/payload/ColorField' },
                  },
                },
                {
                  name: 'colorSurface',
                  label: 'Color de superficie',
                  type: 'text',
                  admin: {
                    description: 'Tarjetas y bloques (un pelín distinto del fondo).',
                    components: { Field: '/components/payload/ColorField' },
                  },
                },
                {
                  name: 'colorText',
                  label: 'Color de texto',
                  type: 'text',
                  admin: {
                    description: 'Texto principal (oscuro).',
                    components: { Field: '/components/payload/ColorField' },
                  },
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'fontSerif',
                  label: 'Tipografía para títulos',
                  type: 'select',
                  defaultValue: 'Fraunces',
                  options: [
                    { label: 'Fraunces (clásica con carácter)', value: 'Fraunces' },
                    { label: 'Cormorant (elegante editorial)', value: 'Cormorant Garamond' },
                    { label: 'Playfair Display (lujo moderno)', value: 'Playfair Display' },
                    { label: 'EB Garamond (sobria)', value: 'EB Garamond' },
                    { label: 'Lora (cálida amigable)', value: 'Lora' },
                    { label: 'DM Serif Display (impacto)', value: 'DM Serif Display' },
                  ],
                },
                {
                  name: 'fontSans',
                  label: 'Tipografía para texto',
                  type: 'select',
                  defaultValue: 'Inter',
                  options: [
                    { label: 'Inter (la más legible)', value: 'Inter' },
                    { label: 'Manrope (geométrica suave)', value: 'Manrope' },
                    { label: 'DM Sans (técnica y limpia)', value: 'DM Sans' },
                    { label: 'Plus Jakarta Sans (amigable)', value: 'Plus Jakarta Sans' },
                    { label: 'Outfit (moderna redondeada)', value: 'Outfit' },
                    { label: 'Work Sans (corporativa)', value: 'Work Sans' },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'cornerRadius',
                  label: 'Esquinas redondeadas',
                  type: 'select',
                  defaultValue: 'medium',
                  admin: {
                    description: 'Cuánto se redondean botones y tarjetas.',
                  },
                  options: [
                    { label: 'Cuadradas (cero)', value: 'none' },
                    { label: 'Suaves (recomendado)', value: 'medium' },
                    { label: 'Muy redondeadas', value: 'large' },
                    { label: 'Píldora (extremas)', value: 'pill' },
                  ],
                },
                {
                  name: 'fontSize',
                  label: 'Tamaño del texto',
                  type: 'select',
                  defaultValue: 'medium',
                  admin: {
                    description: 'Tamaño base. Afecta a todo el texto de la web.',
                  },
                  options: [
                    { label: 'Pequeño (compacto)', value: 'small' },
                    { label: 'Normal (recomendado)', value: 'medium' },
                    { label: 'Grande (cómodo para leer)', value: 'large' },
                  ],
                },
              ],
            },
            {
              type: 'row',
              fields: [
                {
                  name: 'density',
                  label: 'Densidad de espacios',
                  type: 'select',
                  defaultValue: 'normal',
                  admin: {
                    description:
                      '¿Cuánto aire entre los elementos? Más aire = sensación más premium.',
                  },
                  options: [
                    { label: 'Compacta (más por pantalla)', value: 'compact' },
                    { label: 'Normal', value: 'normal' },
                    { label: 'Aireada (premium)', value: 'airy' },
                  ],
                },
                {
                  name: 'buttonStyle',
                  label: 'Estilo de los botones',
                  type: 'select',
                  defaultValue: 'solid',
                  admin: {
                    description: 'Cómo se ven los botones principales.',
                  },
                  options: [
                    { label: 'Sólidos (recomendado)', value: 'solid' },
                    { label: 'Con borde (sutiles)', value: 'outline' },
                    { label: 'Minimalistas (sin fondo)', value: 'minimal' },
                  ],
                },
              ],
            },
            {
              name: 'brandPreview',
              type: 'ui',
              admin: {
                components: {
                  Field: '/components/payload/BrandPreview',
                },
              },
            },
          ],
        },
        {
          label: 'Legal',
          fields: [
            {
              name: 'companyLegalName',
              label: 'Razón social',
              type: 'text',
            },
            {
              name: 'companyCif',
              label: 'CIF / NIF',
              type: 'text',
            },
            {
              name: 'privacyPolicyUrl',
              label: 'URL Política de privacidad',
              type: 'text',
            },
            {
              name: 'cookiesPolicyUrl',
              label: 'URL Política de cookies',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
}

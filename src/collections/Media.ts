import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Archivo',
    plural: 'Archivos',
  },
  admin: {
    group: 'Configuración',
    description:
      'Todas las imágenes y PDFs que se han subido a la web (fotos de azulejos, ambientes, logos, catálogos en PDF). Normalmente no necesitas tocarlo desde aquí — las imágenes se suben al añadir un azulejo o un ambiente.',
  },
  access: {
    read: () => true,
  },
  upload: {
    staticDir: 'media',
    mimeTypes: ['image/*', 'application/pdf'],
    imageSizes: [
      { name: 'thumb', width: 400, height: 400, position: 'centre' },
      { name: 'card', width: 800, height: 800, position: 'centre' },
      { name: 'hero', width: 1600, height: 900, position: 'centre' },
    ],
  },
  fields: [
    {
      name: 'alt',
      label: 'Texto alternativo',
      type: 'text',
      required: true,
    },
    {
      name: 'caption',
      label: 'Pie de imagen',
      type: 'text',
    },
  ],
}

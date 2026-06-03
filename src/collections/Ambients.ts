import type { CollectionConfig } from 'payload'

export const Ambients: CollectionConfig = {
  slug: 'ambients',
  labels: { singular: 'Ambiente', plural: 'Ambientes' },
  admin: {
    useAsTitle: 'title',
    group: 'Catálogo',
    defaultColumns: ['title', 'roomType', 'style', 'published'],
    description: 'Fotos inspiracionales de estancias con azulejos aplicados.',
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return { published: { equals: true } }
    },
  },
  fields: [
    { name: 'title', label: 'Título', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    { name: 'description', label: 'Descripción', type: 'textarea' },
    {
      name: 'image',
      label: 'Imagen principal',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'tilesUsed',
      label: 'Azulejos utilizados',
      type: 'array',
      fields: [
        {
          name: 'tile',
          label: 'Azulejo',
          type: 'relationship',
          relationTo: 'tiles',
          required: true,
        },
        {
          name: 'surface',
          label: 'Superficie',
          type: 'select',
          options: [
            { label: 'Suelo', value: 'floor' },
            { label: 'Pared', value: 'wall' },
            { label: 'Otro', value: 'other' },
          ],
        },
      ],
    },
    {
      name: 'roomType',
      label: 'Tipo de estancia',
      type: 'relationship',
      relationTo: 'rooms',
    },
    {
      name: 'style',
      label: 'Estilo',
      type: 'text',
      admin: { description: 'Ej: nórdico, industrial, mediterráneo...' },
    },
    {
      name: 'published',
      label: 'Publicado',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}

import type { CollectionConfig } from 'payload'

export const TileCollections: CollectionConfig = {
  slug: 'collections',
  labels: { singular: 'Colección', plural: 'Colecciones' },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
    defaultColumns: ['name', 'brand', 'featured', 'slug'],
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
    {
      name: 'brand',
      label: 'Marca',
      type: 'relationship',
      relationTo: 'brands',
    },
    {
      name: 'description',
      label: 'Descripción',
      type: 'textarea',
    },
    {
      name: 'coverImage',
      label: 'Imagen de portada',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'featured',
      label: 'Destacada en home',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}

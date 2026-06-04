import type { CollectionConfig } from 'payload'
import { autoSlugFrom } from '../lib/slug'

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
    { name: 'slug', label: 'Dirección web', type: 'text', required: true, unique: true, ...autoSlugFrom('name') },
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

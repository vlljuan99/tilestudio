import type { CollectionConfig } from 'payload'

export const Usages: CollectionConfig = {
  slug: 'usages',
  labels: { singular: 'Tipo de uso', plural: 'Tipos de uso' },
  admin: {
    useAsTitle: 'name',
    group: 'Etiquetas',
    description:
      'Dónde puede colocarse cada azulejo: suelo interior, pared de baño, exterior… Sirve para que los clientes filtren el catálogo.',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
  ],
}

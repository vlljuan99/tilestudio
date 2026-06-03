import type { CollectionConfig } from 'payload'

/**
 * Importación de un catálogo PDF de un proveedor.
 * Flujo:
 *   1. Admin crea un PdfImport subiendo el PDF + indicando marca (opcional) + rango de páginas.
 *   2. Endpoint /api/admin/pdf-imports/:id/start dispara la extracción en background.
 *   3. Worker actualiza progressPercent / processedPages / extractedItems en tiempo real.
 *   4. Admin revisa candidatos y los acepta.
 *   5. Endpoint /api/admin/pdf-imports/:id/publish convierte aceptados en Tiles.
 */
export const PdfImports: CollectionConfig = {
  slug: 'pdf-imports',
  labels: { singular: 'Import PDF', plural: 'Imports PDF' },
  admin: {
    useAsTitle: 'displayName',
    group: 'Importación',
    defaultColumns: [
      'displayName',
      'status',
      'progressPercent',
      'candidatesCount',
      'createdAt',
    ],
    description:
      'Sube un catálogo en PDF de un proveedor y conviértelo automáticamente en azulejos de tu catálogo.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: () => true, // El worker actualiza sin sesión; sigue protegido por que está detrás de la red local
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'progressUi',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/payload/PdfImportProgress',
        },
      },
    },
    {
      name: 'displayName',
      label: 'Nombre',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Se calcula automáticamente con el nombre del fichero y la marca.',
      },
      hooks: {
        beforeChange: [
          async ({ data, req }) => {
            if (!data) return undefined
            if (data.displayName) return data.displayName
            const fileId = data.originalFile
            let fileName = 'PDF'
            if (fileId) {
              try {
                const media = await req.payload.findByID({
                  collection: 'media',
                  id: typeof fileId === 'object' ? fileId.id : fileId,
                })
                fileName = (media as any).filename || fileName
              } catch {}
            }
            return fileName.replace(/\.pdf$/i, '')
          },
        ],
      },
    },
    {
      name: 'originalFile',
      label: 'Fichero PDF',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Sube el catálogo en PDF del proveedor.',
      },
    },
    {
      name: 'brand',
      label: 'Marca',
      type: 'relationship',
      relationTo: 'brands',
      admin: {
        description:
          'Opcional. Si no se indica, intentaremos detectarla automáticamente del propio PDF.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'pageRangeFrom',
          label: 'Desde página',
          type: 'number',
          defaultValue: 1,
          admin: {
            description: 'Rango de páginas a procesar.',
          },
        },
        {
          name: 'pageRangeTo',
          label: 'Hasta página',
          type: 'number',
          admin: {
            description: 'Dejar vacío para procesar hasta el final.',
          },
        },
        {
          name: 'maxPages',
          label: 'Tope de seguridad',
          type: 'number',
          defaultValue: 30,
          admin: {
            description:
              'Hard cap de páginas a procesar en esta ejecución (control de coste). Sube cuando confirmes calidad.',
          },
        },
      ],
    },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      defaultValue: 'queued',
      options: [
        { label: 'En cola', value: 'queued' },
        { label: 'Procesando', value: 'processing' },
        { label: 'Listo para revisar', value: 'review_ready' },
        { label: 'Importando a catálogo', value: 'importing' },
        { label: 'Completado', value: 'completed' },
        { label: 'Fallido', value: 'failed' },
      ],
      admin: {
        readOnly: true,
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalPages',
          label: 'Total páginas',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'processedPages',
          label: 'Procesadas',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'progressPercent',
          label: 'Progreso (%)',
          type: 'number',
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'currentStep',
      label: 'Paso actual',
      type: 'text',
      admin: { readOnly: true, description: 'Lo que el worker está haciendo ahora mismo.' },
    },
    {
      name: 'candidatesCount',
      label: 'Candidatos encontrados',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'extractedItems',
      label: 'Candidatos extraídos',
      type: 'json',
      admin: {
        readOnly: true,
        description:
          'Array de candidatos JSON: cada elemento es un azulejo identificado con su info y estado de revisión (pending/accepted/rejected). Editable desde la vista de revisión.',
      },
    },
    {
      name: 'errorMessage',
      label: 'Error',
      type: 'textarea',
      admin: { readOnly: true, condition: (data) => data?.status === 'failed' },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'startedAt',
          label: 'Inicio',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'completedAt',
          label: 'Fin',
          type: 'date',
          admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
        },
      ],
    },
    {
      name: 'createdTiles',
      label: 'Azulejos creados',
      type: 'relationship',
      relationTo: 'tiles',
      hasMany: true,
      admin: { readOnly: true, description: 'Azulejos generados al publicar los aceptados.' },
    },
  ],
  timestamps: true,
}

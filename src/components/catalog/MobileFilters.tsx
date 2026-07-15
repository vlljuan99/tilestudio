'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useSearchParams } from 'next/navigation'
import { SlidersHorizontal, X } from 'lucide-react'

import { CatalogFilters, countActiveFilters, type FacetGroup } from './CatalogFilters'

export function MobileFilters({ groups }: { groups: FacetGroup[] }) {
  const params = useSearchParams()
  const activeCount = countActiveFilters(new URLSearchParams(params.toString()), groups)

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="lg:hidden inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm shrink-0"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtrar
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-xs text-background">
              {activeCount}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-background p-6 shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-medium">Filtrar azulejos</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar filtros"
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>
          <CatalogFilters groups={groups} />
          <Dialog.Close asChild>
            <button
              type="button"
              className="mt-8 w-full h-11 rounded-md bg-foreground text-background text-sm font-medium"
            >
              Ver resultados
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

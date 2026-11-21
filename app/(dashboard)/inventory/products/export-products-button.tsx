'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export type ExportableProduct = {
  name: string
  categories?: { name?: string | null } | null
  weight?: string | null
  sku?: string | null
  selling_price: number | string
  cost_price?: number | string | null
  is_active: boolean
}

/**
 * Downloads the product list shown on this page as a genuine .xlsx
 * workbook (SheetJS), with the same columns as the table. Cost is
 * included only for roles that can see it on the page.
 */
export function ExportProductsButton({ products, canViewCost }: { products: ExportableProduct[], canViewCost: boolean }) {
  const [pending, setPending] = useState(false)

  function handleExport() {
    setPending(true)
    try {
      const rows = products.map((prod) => {
        const row: Record<string, string | number> = {
          Name: prod.name,
          Category: prod.categories?.name || '-',
          'Weight / Size': prod.weight || '-',
          SKU: prod.sku || '-',
          'Selling Price (Rs)': Number(prod.selling_price) || 0,
        }
        if (canViewCost) {
          row['Cost Price (Rs)'] = Number(prod.cost_price) || 0
        }
        row.Status = prod.is_active ? 'Active' : 'Inactive'
        return row
      })

      const worksheet = XLSX.utils.json_to_sheet(rows)
      worksheet['!cols'] = [
        { wch: 32 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
        ...(canViewCost ? [{ wch: 16 }] : []),
        { wch: 10 },
      ]

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `products-${date}.xlsx`)
    } finally {
      setPending(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={pending || products.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      {pending ? 'Exporting...' : 'Export Excel'}
    </Button>
  )
}

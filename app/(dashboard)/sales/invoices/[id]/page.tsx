import { notFound } from 'next/navigation'
import { getInvoiceByNumber } from '@/app/actions/sales'
import { INVOICE_SCHEMA_MISSING } from '@/lib/invoice-schema'
import { getOrganization } from '@/app/actions/organization'
import { FbrInvoiceClient } from './fbr-invoice-client'

export default async function FbrInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoiceNumber = decodeURIComponent(id)

  const [sale, orgRes] = await Promise.all([
    getInvoiceByNumber(invoiceNumber),
    getOrganization(),
  ])

  // The v2 FBR columns do not exist in the database yet (the delta SQL
  // has not been run). Say so plainly instead of 404ing — the invoice
  // itself may exist, it is the schema that is behind.
  if (sale === INVOICE_SCHEMA_MISSING) {
    return (
      <div className="space-y-4">
        <div className="print:hidden">
          <h1 className="text-2xl font-semibold tracking-normal">FBR Invoice</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Invoice {invoiceNumber} — print it or copy it for the FBR portal.
          </p>
        </div>

        <div className="rounded-md border p-4 space-y-1">
          <p className="font-medium">Database schema update needed</p>
          <p className="text-sm text-muted-foreground">
            This invoice can&apos;t be shown yet because the database is missing the FBR
            invoice columns. Run the database setup SQL (fbr-invoice-v2-delta.sql, or the
            full pos-full-setup.sql) on the Supabase project, then reload this page.
          </p>
        </div>
      </div>
    )
  }

  // Old-format numbers (INV-xxxxxx) resolve through the same lookup — nothing
  // about the new sequential scheme breaks existing invoices.
  if (!sale) notFound()

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <h1 className="text-2xl font-semibold tracking-normal">FBR Invoice</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Invoice {invoiceNumber} — print it or copy it for the FBR portal.
        </p>
      </div>

      <FbrInvoiceClient sale={sale} organization={orgRes.organization} />
    </div>
  )
}

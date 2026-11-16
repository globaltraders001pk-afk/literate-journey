import { notFound } from 'next/navigation'
import { getInvoiceByNumber } from '@/app/actions/sales'
import { getOrganization } from '@/app/actions/organization'
import { FbrInvoiceClient } from './fbr-invoice-client'

export default async function FbrInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoiceNumber = decodeURIComponent(id)

  const [sale, orgRes] = await Promise.all([
    getInvoiceByNumber(invoiceNumber),
    getOrganization(),
  ])

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

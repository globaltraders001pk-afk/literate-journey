'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import JsBarcode from 'jsbarcode'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Printer, Copy, Check, ArrowLeft, FileText } from 'lucide-react'

/**
 * FBR invoice view (client).
 *
 * LAYOUT NOTE — re-skin point: the whole invoice is the #fbr-invoice-print
 * block below, split into clearly marked sections (seller block, FBR block,
 * meta, items, totals, footer). When the client's exact mockup arrives,
 * re-style/re-order those sections in this one file; the data props stay the same.
 * Print-friendly by design: black on white, no gradients, no colour fills.
 */

type InvoiceItem = {
  quantity: number
  unit_price: number
  subtotal: number
  // Supabase may type a joined row as an object or a one-element array.
  product?: { name?: string; sku?: string | null } | { name?: string; sku?: string | null }[] | null
}

type FbrSale = {
  invoice_number: string
  created_at?: string | null
  payment_method?: string | null
  subtotal?: number | null
  total_amount?: number | null
  customer?:
    | { name?: string | null; phone?: string | null; email?: string | null }
    | { name?: string | null; phone?: string | null; email?: string | null }[]
    | null
  items?: InvoiceItem[]
}

type FbrOrganization = {
  name?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  logo_url?: string | null
  ntn?: string | null
  fbr_token?: string | null
  barcode_value?: string | null
}

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

export function FbrInvoiceClient({ sale, organization }: { sale: FbrSale; organization: FbrOrganization | null }) {
  const barcodeWrapRef = React.useRef<HTMLDivElement | null>(null)
  const barcodeRef = React.useRef<SVGSVGElement | null>(null)
  const [copied, setCopied] = React.useState<string | null>(null)

  const invoiceNumber: string = sale?.invoice_number || ''
  const items: InvoiceItem[] = sale?.items || []
  const customer = Array.isArray(sale?.customer) ? sale.customer[0] : sale?.customer
  const customerName: string = customer?.name || 'Walk-in Customer'
  const customerPhone: string | null = customer?.phone || null
  const total = Number(sale?.total_amount ?? sale?.subtotal ?? 0)
  const subtotal = Number(sale?.subtotal ?? total)

  // Barcode value: fixed value from FBR settings if set, otherwise this invoice's serial.
  const barcodeValue: string = (organization?.barcode_value || '').trim() || invoiceNumber

  React.useEffect(() => {
    const svg = barcodeRef.current
    const wrap = barcodeWrapRef.current
    if (!svg || !barcodeValue) return
    // Clear any earlier plain-DOM error note (no React state here on purpose,
    // to avoid setState-in-effect); the <svg> itself is always React-owned.
    wrap?.querySelector('[data-barcode-error]')?.remove()
    try {
      JsBarcode(svg, barcodeValue, {
        format: 'CODE128',
        width: 2,
        height: 56,
        displayValue: true,
        fontSize: 13,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      if (wrap && !wrap.querySelector('[data-barcode-error]')) {
        const p = document.createElement('p')
        p.setAttribute('data-barcode-error', '')
        p.className = 'text-xs text-red-600'
        p.textContent = `Barcode could not be generated for "${barcodeValue}".`
        wrap.appendChild(p)
      }
    }
  }, [barcodeValue])

  // Plain-text version of the invoice, formatted to paste into the FBR portal.
  function buildFbrText() {
    const lines: string[] = []
    lines.push(organization?.name || 'Qurbat ERP')
    if (organization?.address) lines.push(organization.address)
    if (organization?.phone) lines.push(`Tel: ${organization.phone}`)
    if (organization?.ntn) lines.push(`NTN: ${organization.ntn}`)
    if (organization?.fbr_token) lines.push(`FBR Token: ${organization.fbr_token}`)
    lines.push('')
    lines.push('TAX INVOICE')
    lines.push(`Invoice No: ${invoiceNumber}`)
    lines.push(`Date: ${formatDate(sale?.created_at)}`)
    lines.push(`Customer: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}`)
    lines.push(`Payment: ${(sale?.payment_method || 'CASH').replace('_', ' ')}`)
    lines.push('')
    lines.push('Item | Qty | Rate | Amount')
    for (const item of items) {
      const prod = Array.isArray(item.product) ? item.product[0] : item.product
      lines.push(
        `${prod?.name || 'Product'} | ${item.quantity} | ${money(Number(item.unit_price))} | ${money(Number(item.subtotal))}`
      )
    }
    lines.push('')
    lines.push(`Subtotal: ${money(subtotal)}`)
    lines.push(`Total: ${money(total)}`)
    lines.push('')
    lines.push('This is a computer-generated invoice.')
    return lines.join('\n')
  }

  // HTML version of the same text (for pasting into rich-text fields).
  function buildFbrHtml() {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<div>${esc(buildFbrText()).split('\n').join('<br>')}</div>`
  }

  async function copyText() {
    const text = buildFbrText()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Clipboard API unavailable (non-secure context) — textarea fallback.
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied('text')
    setTimeout(() => setCopied(null), 2000)
  }

  async function copyHtml() {
    const text = buildFbrText()
    const html = buildFbrHtml()
    try {
      const item = new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })
      await navigator.clipboard.write([item])
    } catch {
      // ClipboardItem unsupported — fall back to plain text.
      await copyText()
      return
    }
    setCopied('html')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Print CSS: only the invoice prints, everything else is hidden. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #fbr-invoice-print, #fbr-invoice-print * { visibility: visible !important; }
          #fbr-invoice-print {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>

      {/* Action bar — never printed */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/sales/pos" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to POS
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyText}>
            {copied === 'text' ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
            {copied === 'text' ? 'Copied' : 'Copy for FBR'}
          </Button>
          <Button variant="outline" size="sm" onClick={copyHtml}>
            {copied === 'html' ? <Check className="h-4 w-4 mr-1.5" /> : <FileText className="h-4 w-4 mr-1.5" />}
            {copied === 'html' ? 'Copied' : 'Copy as formatted'}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" />
            Print Invoice
          </Button>
        </div>
      </div>

      {/* ======================= INVOICE (prints) ======================= */}
      <Card id="fbr-invoice-print" className="mx-auto max-w-3xl bg-white text-black shadow-none">
        <CardContent className="p-6 sm:p-8 space-y-5 text-sm">
          {/* --- Seller block --- */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {organization?.logo_url ? (
                  <Image src={organization.logo_url} alt="Logo" width={40} height={40} unoptimized className="h-10 w-10 object-contain" />
                ) : null}
                <h1 className="text-xl font-bold tracking-normal">{organization?.name || 'Qurbat ERP'}</h1>
              </div>
              {organization?.address && <p className="text-xs">{organization.address}</p>}
              {organization?.phone && <p className="text-xs">Tel: {organization.phone}</p>}
              {organization?.email && <p className="text-xs">Email: {organization.email}</p>}
              {organization?.ntn ? (
                <p className="text-xs font-semibold">NTN: {organization.ntn}</p>
              ) : (
                <p className="text-xs text-neutral-500">NTN: not set — add it in Settings → FBR / Invoice</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-bold uppercase tracking-wide">Tax Invoice</p>
              <Badge variant="outline" className="mt-1 font-mono text-xs border-black text-black">
                {invoiceNumber}
              </Badge>
            </div>
          </div>

          {/* --- FBR block: token + barcode --- */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-300 pb-4">
            <div className="space-y-1 text-xs">
              <p className="font-semibold uppercase tracking-wide">FBR Details</p>
              {organization?.fbr_token ? (
                <p>
                  FBR Token: <span className="font-mono break-all">{organization.fbr_token}</span>
                </p>
              ) : (
                <p className="text-neutral-500">FBR Token: not set — add it in Settings → FBR / Invoice</p>
              )}
              <p className="text-neutral-500">Invoice serial: <span className="font-mono text-black">{invoiceNumber}</span></p>
            </div>
            <div ref={barcodeWrapRef} className="text-center">
              <svg ref={barcodeRef} role="img" aria-label={`Barcode for ${barcodeValue}`} />
            </div>
          </div>

          {/* --- Meta: invoice + buyer --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <p className="font-semibold uppercase tracking-wide">Invoice</p>
              <p>Invoice No: <span className="font-mono font-medium">{invoiceNumber}</span></p>
              <p>Date: {formatDate(sale?.created_at)}</p>
              <p>Payment: {(sale?.payment_method || 'CASH').replace('_', ' ')}</p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold uppercase tracking-wide">Billed To</p>
              <p className="font-medium">{customerName}</p>
              {customerPhone && <p>Phone: {customerPhone}</p>}
              {customer?.email && <p>Email: {customer.email}</p>}
            </div>
          </div>

          {/* --- Line items --- */}
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-y-2 border-black">
                <th className="py-2 pr-2 font-semibold uppercase">#</th>
                <th className="py-2 pr-2 font-semibold uppercase">Item</th>
                <th className="py-2 pr-2 text-center font-semibold uppercase">Qty</th>
                <th className="py-2 pr-2 text-right font-semibold uppercase">Rate</th>
                <th className="py-2 text-right font-semibold uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const prod = Array.isArray(item.product) ? item.product[0] : item.product
                return (
                <tr key={idx} className="border-b border-neutral-200">
                  <td className="py-2 pr-2">{idx + 1}</td>
                  <td className="py-2 pr-2 font-medium">
                    {prod?.name || 'Product'}
                    {prod?.sku ? (
                      <span className="block text-[11px] font-normal text-neutral-500">SKU: {prod.sku}</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-2 text-center">{item.quantity}</td>
                  <td className="py-2 pr-2 text-right">{money(Number(item.unit_price))}</td>
                  <td className="py-2 text-right font-medium">{money(Number(item.subtotal))}</td>
                </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-neutral-500">No line items on this invoice.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* --- Totals --- */}
          <div className="flex justify-end">
            <div className="w-full sm:w-64 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{money(subtotal)}</span>
              </div>
              <div className="flex justify-between border-t-2 border-black pt-1.5 text-sm font-bold">
                <span>Total</span>
                <span>{money(total)}</span>
              </div>
            </div>
          </div>

          {/* --- Footer note --- */}
          <div className="border-t border-neutral-300 pt-3 text-center text-[11px] text-neutral-600">
            <p>This is a computer-generated invoice. Please retain it for your records.</p>
            <p>FBR Token and barcode above are for submission to the FBR portal.</p>
          </div>
        </CardContent>
      </Card>
      {/* ===================== /INVOICE ===================== */}
    </div>
  )
}

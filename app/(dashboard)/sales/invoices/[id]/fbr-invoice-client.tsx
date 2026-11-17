'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import QRCode from 'qrcode'
import { updateProcurementRef } from '@/app/actions/sales'
import { Button, buttonVariants } from '@/components/ui/button'
import { Printer, Copy, Check, ArrowLeft, FileText, Save } from 'lucide-react'
import { amountInWords } from '@/lib/amount-in-words'

/**
 * FBR invoice view (client) — rebuilt to match the client's sample invoice
 * ("GLOBAL TRADERS — SALES TAX INVOICE") exactly.
 *
 * Sample palette: navy #1F3864, light blue #D9E2F3, thin borders #B4C6E7.
 * A4 portrait, white, centred, max-width ~800px, system sans.
 * No logo. The FBR token is NEVER printed on the invoice.
 * The FBR QR code is shown only when FBR has returned a reference number.
 */

const NAVY = '#1F3864'
const LIGHT_BLUE = '#D9E2F3'
const BORDER = '#B4C6E7'

type InvoiceItem = {
  quantity: number
  unit_price: number
  subtotal: number
  // Supabase may type a joined row as an object or a one-element array.
  product?:
    | { name?: string; sku?: string | null; weight?: string | null }
    | { name?: string; sku?: string | null; weight?: string | null }[]
    | null
}

type FbrCustomer = {
  name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  ntn?: string | null
  buyer_type?: string | null
}

type FbrSale = {
  invoice_number: string
  created_at?: string | null
  payment_method?: string | null
  subtotal?: number | null
  total_amount?: number | null
  procurement_ref?: string | null
  fbr_status?: string | null
  fbr_reference_no?: string | null
  fbr_response_code?: string | null
  fbr_response_message?: string | null
  fbr_submitted_at?: string | null
  customer?: FbrCustomer | FbrCustomer[] | null
  items?: InvoiceItem[]
}

type FbrOrganization = {
  name?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  ntn?: string | null
  invoice_prefix?: string | null
  bank_name?: string | null
  bank_iban?: string | null
  dispatch_text?: string | null
  payment_terms_days?: number | null
  gst_rate?: number | null
}

/** PKR: thousands commas, 2 decimals only when fractional (138980 -> "138,980"). */
function pkr(n: number) {
  const v = Number(n) || 0
  const rounded = Math.round(v * 100) / 100
  return rounded.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "DD Month YYYY" with a zero-padded day, e.g. "29 September 2026". UTC-based
 * so server and client render the same string (no hydration mismatch). */
function formatDayMonthYear(value: string | Date | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return '[System timestamp]'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '[System timestamp]'
  return `${formatDayMonthYear(d)}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

function addDays(value: string | Date | null | undefined, days: number) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}

function paymentTermsLabel(method: string | null | undefined) {
  switch ((method || 'CASH').toUpperCase()) {
    case 'ONLINE':
      return 'Online / Direct Bank Transfer'
    case 'CASH':
      return 'Cash'
    case 'CARD':
      return 'Card'
    case 'BANK_TRANSFER':
      return 'Bank Transfer'
    case 'CREDIT':
      return 'Credit'
    default:
      return (method || 'Cash').replace(/_/g, ' ')
  }
}

const IMPORTANT_NOTE =
  'Important: This is an illustrative client-discussion template, not an FBR-approved invoice or proof of submission. ' +
  'The ERP should send invoice data through the applicable authorized integration route, save the actual FBR response, ' +
  'and print the FBR reference/QR only when returned successfully. Never print or expose the API token on the invoice. ' +
  "Confirm the client's taxpayer category, required fields, tax treatment, and current FBR/PRAL integration process before going live."

export function FbrInvoiceClient({ sale, organization }: { sale: FbrSale; organization: FbrOrganization | null }) {
  const [copied, setCopied] = React.useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null)
  const [qrFailed, setQrFailed] = React.useState(false)
  const [procRef, setProcRef] = React.useState<string>(sale?.procurement_ref || '')
  const [procSaving, setProcSaving] = React.useState(false)
  const [procMsg, setProcMsg] = React.useState<string | null>(null)

  const invoiceNumber: string = sale?.invoice_number || ''
  const items: InvoiceItem[] = sale?.items || []
  const customer: FbrCustomer | undefined = Array.isArray(sale?.customer) ? sale.customer[0] : sale?.customer || undefined
  const customerName: string = customer?.name || 'Walk-in Customer'

  const orgName: string = organization?.name || 'Global Traders'
  const gstRate = Number(organization?.gst_rate ?? 18) / 100
  const paymentTermsDays = Number(organization?.payment_terms_days ?? 10)
  const dueDate = addDays(sale?.created_at, paymentTermsDays)

  // Totals are computed from the real lines: per-line GST = gst_rate x line amount.
  const subtotal = round2(items.reduce((sum, it) => sum + Number(it.subtotal || 0), 0))
  const lineGst = (it: InvoiceItem) => round2(Number(it.subtotal || 0) * gstRate)
  const gstTotal = round2(items.reduce((sum, it) => sum + lineGst(it), 0))
  const grandTotal = round2(subtotal + gstTotal)

  const fbrReferenceNo: string = (sale?.fbr_reference_no || '').trim()
  const fbrStatus: string = (sale?.fbr_status || '').trim() || 'Pending'
  const fbrResponse: string =
    sale?.fbr_response_code || sale?.fbr_response_message
      ? `${sale?.fbr_response_code || ''}${sale?.fbr_response_code && sale?.fbr_response_message ? ': ' : ''}${sale?.fbr_response_message || ''}`
      : '[Store response code and message]'

  const sellerContact = [organization?.phone, organization?.email].filter(Boolean).join(' / ')

  // FBR QR code: only when FBR has returned a reference number.
  // (qrDataUrl/qrFailed start empty, so there is nothing to reset when
  // there is no reference — the placeholder text renders instead.)
  React.useEffect(() => {
    if (!fbrReferenceNo) return
    let alive = true
    QRCode.toDataURL(fbrReferenceNo, { width: 128, margin: 1 })
      .then((url) => {
        if (alive) {
          setQrDataUrl(url)
          setQrFailed(false)
        }
      })
      .catch(() => {
        if (alive) setQrFailed(true)
      })
    return () => {
      alive = false
    }
  }, [fbrReferenceNo])

  // Procurement Ref. is edited inline and saved via the
  // updateProcurementRef server action (app/actions/sales.ts).
  async function saveProcRef() {
    setProcSaving(true)
    setProcMsg(null)
    try {
      const res = await updateProcurementRef(invoiceNumber, procRef.trim())
      if (res?.error) setProcMsg(res.error)
      else setProcMsg('Saved.')
    } catch (err) {
      setProcMsg(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setProcSaving(false)
    }
  }

  // Plain-text version of the invoice, formatted to paste into the FBR portal.
  function buildFbrText() {
    const lines: string[] = []
    lines.push(orgName.toUpperCase())
    lines.push('SALES TAX INVOICE')
    lines.push('')
    lines.push(`Invoice No: ${invoiceNumber}`)
    lines.push(`Invoice Date: ${formatDayMonthYear(sale?.created_at)}`)
    lines.push(`Due Date: ${dueDate ? formatDayMonthYear(dueDate) : '—'}`)
    lines.push(`Procurement Ref: ${procRef.trim() || '—'}`)
    lines.push('')
    lines.push('SELLER / BUYER DETAILS')
    lines.push(`Seller: ${orgName}`)
    lines.push(`NTN / STRN: ${organization?.ntn || '[Enter registered number]'}`)
    lines.push(`Address: ${organization?.address || '[Seller business address]'}`)
    lines.push(`Contact: ${sellerContact || '[Phone / Email]'}`)
    lines.push(`Buyer: ${customerName}`)
    lines.push(`NTN / STRN: ${customer?.ntn || '[Enter buyer number, if applicable]'}`)
    lines.push(`Address: ${customer?.address || '[Buyer address]'}`)
    lines.push(`Buyer Type: ${customer?.buyer_type || '[Confirm applicable FBR category]'}`)
    lines.push('')
    lines.push('ORDER, DELIVERY & PAYMENT')
    lines.push(`Payment Terms: ${paymentTermsLabel(sale?.payment_method)}`)
    lines.push(`Dispatch: ${organization?.dispatch_text || 'Local Courier / Hand Delivery'}`)
    lines.push(`Bank: ${organization?.bank_name || '[Bank name]'}`)
    lines.push(`Account Title: ${orgName}`)
    lines.push(`Account / IBAN: ${organization?.bank_iban || '[Masked account / IBAN details]'}`)
    lines.push('Currency: PKR')
    lines.push('')
    lines.push('ITEM DETAILS')
    lines.push('# | Item Description | Specifications | Qty | Unit Price (PKR) | GST | Line Total (PKR)')
    items.forEach((item, idx) => {
      const prod = Array.isArray(item.product) ? item.product[0] : item.product
      lines.push(
        `${idx + 1} | ${prod?.name || 'Product'} | ${prod?.weight || '—'} | ${item.quantity} | ${pkr(Number(item.unit_price))} | ${pkr(lineGst(item))} | ${pkr(Number(item.subtotal))}`
      )
    })
    if (items.length === 0) lines.push('No line items on this invoice.')
    lines.push('')
    lines.push(`Subtotal: ${pkr(subtotal)}`)
    lines.push(`GST Total: ${pkr(gstTotal)}`)
    lines.push(`Grand Total: ${pkr(grandTotal)}`)
    lines.push(`Amount in Words: ${amountInWords(grandTotal)}`)
    lines.push('')
    lines.push('FBR DIGITAL INVOICING DETAILS | TO BE POPULATED BY THE ERP AFTER A SUCCESSFUL FBR RESPONSE')
    lines.push('Environment: Production (Live) — after approval/testing')
    lines.push(`FBR Invoice Reference No.: ${fbrReferenceNo || '[Returned by FBR API — do not invent]'}`)
    lines.push(`Submission Status: ${fbrStatus}`)
    lines.push(`FBR Response / Validation: ${fbrResponse}`)
    lines.push(`FBR QR Code: ${fbrReferenceNo ? fbrReferenceNo : '[Generate/display only as per official FBR specification]'}`)
    lines.push(`Submission Date & Time: ${formatDateTime(sale?.fbr_submitted_at)}`)
    lines.push('')
    lines.push(IMPORTANT_NOTE)
    lines.push('')
    lines.push('Authorized Signature: ____________________________  Customer Acknowledgment: ____________________________')
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
        /* The app theme forces a pale gradient on every thead th
           (globals.css :root thead th, !important). This scoped rule
           wins it back for the invoice header, which must be navy. */
        #fbr-invoice-print thead th { background: ${NAVY} !important; border-color: ${BORDER} !important; }
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
        {/* Procurement Ref. editor — kept in the action bar (never printed)
            so the invoice meta bar matches the sample's four uniform cells. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor="proc-ref-input" className="text-xs font-medium text-muted-foreground">
            Procurement Ref.
          </label>
          <input
            id="proc-ref-input"
            value={procRef}
            onChange={(e) => setProcRef(e.target.value)}
            placeholder="PT…"
            aria-label="Procurement Ref."
            className="h-8 w-32 rounded border border-neutral-300 bg-white px-2 text-xs text-black"
          />
          <Button size="sm" className="h-8 px-2 text-xs" onClick={saveProcRef} disabled={procSaving}>
            <Save className="h-3.5 w-3.5" />
            {procSaving ? 'Saving…' : 'Save'}
          </Button>
          {procMsg && <span className="text-[11px] text-neutral-600">{procMsg}</span>}
        </div>
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
      <div
        id="fbr-invoice-print"
        className="mx-auto w-full max-w-[800px] bg-white px-2 py-6 text-[13px] leading-tight text-black sm:px-6"
        style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* --- Header --- */}
        <h1 className="text-center text-[32px] font-bold leading-tight" style={{ color: NAVY }}>
          {orgName.toUpperCase()}
        </h1>
        <p className="mt-1 text-center text-[14px] tracking-wide text-neutral-500">SALES TAX INVOICE</p>

        {/* --- Meta bar --- */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4">
          <div className="border p-2.5" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="text-[13px] font-bold">Invoice No.</p>
            <p className="mt-0.5 text-[13px]">{invoiceNumber}</p>
          </div>
          <div className="border p-2.5" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="text-[13px] font-bold">Invoice Date</p>
            <p className="mt-0.5 text-[13px]">{formatDayMonthYear(sale?.created_at)}</p>
          </div>
          <div className="border p-2.5" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="text-[13px] font-bold">Due Date</p>
            <p className="mt-0.5 text-[13px]">{dueDate ? formatDayMonthYear(dueDate) : '—'}</p>
          </div>
          <div className="border p-2.5" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="text-[13px] font-bold">Procurement Ref.</p>
            <p className="mt-0.5 text-[13px]">{procRef.trim() || '—'}</p>
          </div>
        </div>

        {/* --- Seller / Buyer details --- */}
        <h2 className="mt-5 text-[15px] font-bold italic" style={{ color: NAVY }}>
          SELLER / BUYER DETAILS
        </h2>
        <div className="mt-1 grid grid-cols-1 border sm:grid-cols-2" style={{ borderColor: BORDER }}>
          <div className="border-b p-3 text-[13px] sm:border-b-0 sm:border-r" style={{ borderColor: BORDER }}>
            <p className="font-bold">Seller</p>
            <p>{orgName}</p>
            <p>NTN / STRN: {organization?.ntn || '[Enter registered number]'}</p>
            <p>Address: {organization?.address || '[Seller business address]'}</p>
            <p>Contact: {sellerContact || '[Phone / Email]'}</p>
          </div>
          <div className="p-3 text-[13px]">
            <p className="font-bold">Buyer</p>
            <p>{customerName}</p>
            <p>NTN / STRN: {customer?.ntn || '[Enter buyer number, if applicable]'}</p>
            <p>Address: {customer?.address || '[Buyer address]'}</p>
            <p>Buyer Type: {customer?.buyer_type || '[Confirm applicable FBR category]'}</p>
          </div>
        </div>

        {/* --- Order, delivery & payment --- */}
        <h2 className="mt-6 text-[15px] font-bold italic" style={{ color: NAVY }}>
          ORDER, DELIVERY &amp; PAYMENT
        </h2>
        <table className="mt-1 w-full border-collapse text-[13px]" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td className="w-[18%] border p-2" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>Payment Terms</td>
              <td className="w-[32%] border p-2" style={{ borderColor: BORDER }}>{paymentTermsLabel(sale?.payment_method)}</td>
              <td className="w-[18%] border p-2" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>Dispatch</td>
              <td className="w-[32%] border p-2" style={{ borderColor: BORDER }}>{organization?.dispatch_text || 'Local Courier / Hand Delivery'}</td>
            </tr>
            <tr>
              <td className="border p-2" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>Bank</td>
              <td className="border p-2" style={{ borderColor: BORDER }}>{organization?.bank_name || '[Bank name]'}</td>
              <td className="border p-2" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>Account Title</td>
              <td className="border p-2" style={{ borderColor: BORDER }}>{orgName}</td>
            </tr>
            <tr>
              <td className="border p-2" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>Account / IBAN</td>
              <td className="border p-2" style={{ borderColor: BORDER }}>{organization?.bank_iban || '[Masked account / IBAN details]'}</td>
              <td className="border p-2" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>Currency</td>
              <td className="border p-2" style={{ borderColor: BORDER }}>PKR</td>
            </tr>
          </tbody>
        </table>

        {/* --- Item details --- */}
        <h2 className="mt-4 text-[15px] font-bold italic" style={{ color: NAVY }}>
          ITEM DETAILS
        </h2>
        <table className="mt-1 w-full table-fixed border-collapse text-[13px]" style={{ borderCollapse: 'collapse' }}>
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr style={{ color: '#ffffff' }}>
              <th className="whitespace-nowrap border p-2 text-left text-[12px] font-semibold" style={{ backgroundColor: NAVY, borderColor: BORDER }}>#</th>
              <th className="whitespace-nowrap border p-2 text-left text-[12px] font-semibold" style={{ backgroundColor: NAVY, borderColor: BORDER }}>Item Description</th>
              <th className="whitespace-nowrap border p-2 text-left text-[12px] font-semibold" style={{ backgroundColor: NAVY, borderColor: BORDER }}>Specifications</th>
              <th className="whitespace-nowrap border p-2 text-center text-[12px] font-semibold" style={{ backgroundColor: NAVY, borderColor: BORDER }}>Qty</th>
              <th className="whitespace-nowrap border p-2 text-center text-[12px] font-semibold" style={{ backgroundColor: NAVY, borderColor: BORDER }}>Unit Price (PKR)</th>
              <th className="whitespace-nowrap border p-2 text-center text-[12px] font-semibold" style={{ backgroundColor: NAVY, borderColor: BORDER }}>GST</th>
              <th className="whitespace-nowrap border p-2 text-center text-[12px] font-semibold" style={{ backgroundColor: NAVY, borderColor: BORDER }}>Line Total (PKR)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const prod = Array.isArray(item.product) ? item.product[0] : item.product
              return (
                <tr key={idx}>
                  <td className="border p-2" style={{ borderColor: BORDER }}>{idx + 1}</td>
                  <td className="border p-2" style={{ borderColor: BORDER }}>{prod?.name || 'Product'}</td>
                  <td className="border p-2" style={{ borderColor: BORDER }}>{prod?.weight || '—'}</td>
                  <td className="border p-2 text-center" style={{ borderColor: BORDER }}>{item.quantity}</td>
                  <td className="border p-2 text-right" style={{ borderColor: BORDER }}>{pkr(Number(item.unit_price))}</td>
                  <td className="border p-2 text-right" style={{ borderColor: BORDER }}>{pkr(lineGst(item))}</td>
                  <td className="border p-2 text-right" style={{ borderColor: BORDER }}>{pkr(Number(item.subtotal))}</td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="border p-4 text-center text-neutral-500" style={{ borderColor: BORDER }}>
                  No line items on this invoice.
                </td>
              </tr>
            )}
            <tr>
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="whitespace-nowrap border p-2 text-right" style={{ borderColor: BORDER }}>Subtotal</td>
              <td className="whitespace-nowrap border p-2 text-right" style={{ borderColor: BORDER }}>{pkr(subtotal)}</td>
            </tr>
            <tr>
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="whitespace-nowrap border p-2 text-right" style={{ borderColor: BORDER }}>GST Total</td>
              <td className="whitespace-nowrap border p-2 text-right" style={{ borderColor: BORDER }}>{pkr(gstTotal)}</td>
            </tr>
            <tr>
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="border p-2" style={{ borderColor: BORDER }} />
              <td className="whitespace-nowrap border p-2 text-right font-bold" style={{ borderColor: BORDER }}>Grand Total</td>
              <td className="whitespace-nowrap border p-2 text-right font-bold" style={{ borderColor: BORDER }}>{pkr(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-3 text-[13px]">
          <span className="font-bold">Amount in Words:</span> {amountInWords(grandTotal)}
        </p>

        {/* --- FBR digital invoicing details --- */}
        <h2 className="mt-3 text-[13px] font-bold italic" style={{ color: NAVY }}>
          FBR DIGITAL INVOICING DETAILS | TO BE POPULATED BY THE ERP AFTER A SUCCESSFUL FBR RESPONSE
        </h2>
        <div className="mt-1 grid grid-cols-1 border sm:grid-cols-3" style={{ borderColor: BORDER }}>
          <div className="border p-3 text-[13px]" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="font-bold">Environment</p>
            <p className="mt-0.5">Production (Live) — after approval/testing</p>
          </div>
          <div className="border p-3 text-[13px]" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="font-bold">FBR Invoice Reference No.</p>
            <p className="mt-0.5 break-words">{fbrReferenceNo || '[Returned by FBR API — do not invent]'}</p>
          </div>
          <div className="border p-3 text-[13px]" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="font-bold">Submission Status</p>
            <p className="mt-0.5">{fbrStatus}</p>
          </div>
          <div className="border p-3 text-[13px]" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="font-bold">FBR Response / Validation</p>
            <p className="mt-0.5 break-words">{fbrResponse}</p>
          </div>
          <div className="border p-3 text-[13px]" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="font-bold">FBR QR Code</p>
            {fbrReferenceNo && qrDataUrl && !qrFailed ? (
              <Image src={qrDataUrl} alt={`FBR QR code for ${fbrReferenceNo}`} width={96} height={96} unoptimized className="mt-1 h-24 w-24" />
            ) : (
              <p className="mt-0.5">[Generate/display only as per official FBR specification]</p>
            )}
          </div>
          <div className="border p-3 text-[13px]" style={{ backgroundColor: LIGHT_BLUE, borderColor: BORDER }}>
            <p className="font-bold">Submission Date &amp; Time</p>
            <p className="mt-0.5">{formatDateTime(sale?.fbr_submitted_at)}</p>
          </div>
        </div>

        {/* --- Important note --- */}
        <p className="mt-4 text-[11px] leading-snug text-neutral-600">
          <span className="font-bold">Important:</span>{' '}
          {IMPORTANT_NOTE.replace(/^Important:\s*/, '')}
        </p>

        {/* --- Signatures --- */}
        <p className="mt-4 text-[13px]">
          Authorized Signature: ____________________________&nbsp;&nbsp;&nbsp;Customer Acknowledgment: ____________________________
        </p>
      </div>
      {/* ===================== /INVOICE ===================== */}
    </div>
  )
}

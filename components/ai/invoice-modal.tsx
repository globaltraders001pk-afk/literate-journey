'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Printer, 
  Store, 
  Check, 
  Copy, 
  Loader2,
  CheckCircle2
} from 'lucide-react'
import { getInvoiceByNumber } from '@/app/actions/sales'
import { useOrganization } from '@/components/providers/organization-provider'

export interface InvoiceModalData {
  invoice_number: string
  total_amount?: number
  payment_method?: string
  date?: string | Date
  customer?: string
  items?: Array<{
    product_name?: string
    name?: string
    quantity: number
    unit_price: number
    subtotal: number
  }>
}

interface InvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceNumber?: string | null
  initialData?: InvoiceModalData | null
}

export function InvoiceModal({
  open,
  onOpenChange,
  invoiceNumber,
  initialData
}: InvoiceModalProps) {
  const { organization } = useOrganization()
  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<InvoiceModalData | null>(initialData || null)
  const [copied, setCopied] = React.useState(false)

  const invNum = invoiceNumber || initialData?.invoice_number || data?.invoice_number

  React.useEffect(() => {
    if (!open) return

    if (initialData && initialData.items && initialData.items.length > 0) {
      setData(initialData)
      return
    }

    if (invNum) {
      setLoading(true)
      getInvoiceByNumber(invNum)
        .then(res => {
          // A string result means the FBR v2 columns are missing from the
          // DB (see INVOICE_SCHEMA_MISSING) — not a sale, so ignore it
          // here the same as "not found".
          if (res && typeof res === 'object') {
            setData({
              invoice_number: res.invoice_number,
              total_amount: Number(res.total_amount || 0),
              payment_method: res.payment_method || 'CASH',
              date: res.created_at,
              customer: (Array.isArray(res.customer) ? res.customer[0]?.name : (res.customer as { name?: string | null } | null)?.name) || 'Walk-in (Guest)',
              // The many-to-one product embed arrives as a single
              // object at runtime; supabase-js types it as an array,
              // hence the cast (compile-time only).
              items: ((res.items || []) as unknown as Array<{
                product?: { name?: string | null } | null
                quantity?: number | null
                unit_price?: number | string | null
                subtotal?: number | string | null
              }>).map((it) => ({
                product_name: it.product?.name || 'Product',
                quantity: it.quantity ?? 0,
                unit_price: Number(it.unit_price || 0),
                subtotal: Number(it.subtotal || 0)
              }))
            })
          } else if (initialData) {
            setData(initialData)
          }
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [open, invNum, initialData])

  const handleCopy = () => {
    if (!invNum) return
    navigator.clipboard.writeText(invNum)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    const printContent = document.getElementById('printable-ai-receipt')
    if (!printContent) {
      window.print()
      return
    }

    const printWindow = window.open('', '_blank', 'width=480,height=650')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Invoice - ${invNum || 'Receipt'}</title>
            <style>
              @page {
                size: 80mm auto;
                margin: 4mm;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: #000;
                background: #fff;
                margin: 0;
                padding: 12px;
                font-size: 12px;
                line-height: 1.4;
              }
              .receipt-header {
                text-align: center;
                margin-bottom: 12px;
              }
              .receipt-title {
                font-size: 16px;
                font-weight: 700;
                letter-spacing: 0.5px;
                margin: 0;
                text-transform: uppercase;
              }
              .receipt-subtitle {
                font-size: 10px;
                color: #555;
                margin-top: 2px;
              }
              .divider {
                border-top: 1px dashed #888;
                margin: 8px 0;
              }
              .meta-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                margin-bottom: 3px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 8px 0;
                font-size: 11px;
              }
              th {
                text-align: left;
                padding: 4px 0;
                border-bottom: 1px solid #000;
                font-weight: 600;
                font-size: 10px;
                text-transform: uppercase;
              }
              td {
                padding: 4px 0;
                border-bottom: 1px solid #eee;
              }
              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .total-section {
                margin-top: 8px;
                display: flex;
                justify-content: space-between;
                font-size: 14px;
                font-weight: 700;
              }
              .footer {
                text-align: center;
                margin-top: 16px;
                font-size: 10px;
                color: #666;
              }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const items = data?.items || []
  const totalAmount = data?.total_amount || items.reduce((acc, it) => acc + (it.subtotal || 0), 0)
  const displayDate = data?.date ? new Date(data.date) : new Date()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-card text-card-foreground">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <DialogTitle className="text-lg font-semibold">Sales Invoice</DialogTitle>
            </div>
            {invNum && (
              <Badge variant="outline" className="font-mono text-xs font-semibold px-2 py-0.5">
                {invNum}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Official sales receipt and tax invoice. Stock has been deducted.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs">Loading invoice records...</p>
          </div>
        ) : (
          <div className="mt-2">
            {/* Printable Receipt Card */}
            <div
              id="printable-ai-receipt"
              className="bg-background text-foreground p-5 rounded-xl border border-dashed border-border text-xs space-y-3 font-sans shadow-2xs"
            >
              {/* Header Branding */}
              <div className="receipt-header text-center space-y-1.5">
                <div className="flex items-center justify-center gap-2 font-bold text-base text-primary">
                  {organization?.logo_url ? (
                    <div className="h-7 w-7 rounded overflow-hidden flex items-center justify-center shrink-0">
                      <Image
                        src={organization.logo_url}
                        alt="Logo"
                        width={28}
                        height={28}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <Store className="h-4 w-4" />
                  )}
                  <span className="receipt-title tracking-tight uppercase">
                    {organization?.name || 'GLOBAL TRADERS'}
                  </span>
                </div>
                <p className="receipt-subtitle text-[11px] text-muted-foreground">
                  Sales Receipt & Tax Invoice
                </p>
                {organization?.address && (
                  <p className="text-[10px] text-muted-foreground/80">{organization.address}</p>
                )}
                {organization?.phone && (
                  <p className="text-[10px] text-muted-foreground/80">Tel: {organization.phone}</p>
                )}
              </div>

              <div className="divider border-t border-dashed border-border" />

              {/* Metadata */}
              <div className="space-y-1 text-[11px]">
                <div className="meta-row flex justify-between">
                  <span className="text-muted-foreground">Invoice No:</span>
                  <span className="font-mono font-medium">{invNum || 'N/A'}</span>
                </div>
                <div className="meta-row flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>
                    {displayDate.toLocaleDateString()} {displayDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="meta-row flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium">{data?.customer || 'Walk-in (Guest)'}</span>
                </div>
                <div className="meta-row flex justify-between">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                    {data?.payment_method || 'CASH'}
                  </span>
                </div>
              </div>

              <div className="divider border-t border-dashed border-border" />

              {/* Items List */}
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-[10px] uppercase text-muted-foreground">
                    <th className="py-1 font-semibold">Item</th>
                    <th className="py-1 text-center font-semibold">Qty</th>
                    <th className="py-1 text-right font-semibold">Price</th>
                    <th className="py-1 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {items.length > 0 ? (
                    items.map((item, idx) => (
                      <tr key={idx} className="py-1.5">
                        <td className="py-1 font-medium text-foreground">
                          {item.product_name || item.name || 'Product'}
                        </td>
                        <td className="py-1 text-center text-muted-foreground">{item.quantity}</td>
                        <td className="py-1 text-right text-muted-foreground">
                          ${Number(item.unit_price || 0).toFixed(2)}
                        </td>
                        <td className="py-1 text-right font-semibold text-foreground">
                          ${Number(item.subtotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-2 text-center text-muted-foreground">
                        No line items recorded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="divider border-t border-dashed border-border" />

              {/* Grand Total */}
              <div className="total-section flex items-center justify-between text-base font-bold pt-1">
                <span>Grand Total</span>
                <span className="text-primary font-mono text-lg">
                  ${Number(totalAmount).toFixed(2)}
                </span>
              </div>

              {/* Footer Note */}
              <div className="footer text-center pt-2 text-[10px] text-muted-foreground">
                <p>Thank you for your business!</p>
                <p>Retain this receipt for tax and warranty records.</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 flex flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy No'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Print Invoice
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

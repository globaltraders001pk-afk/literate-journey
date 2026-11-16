'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { processCheckout } from '@/app/actions/sales'
import { useOrganization } from '@/components/providers/organization-provider'
import Link from 'next/link'
import { Minus, Plus, ShoppingCart, Trash2, Printer, CheckCircle2, Store, Loader2, FileText } from 'lucide-react'

type CartItem = {
  product_id: string
  name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface CompletedSale {
  invoiceNumber: string
  date: Date
  customerName: string
  paymentMethod: string
  items: CartItem[]
  total: number
}

export function POSClient({ products, customers }: { products: any[], customers: any[] }) {
  const { organization } = useOrganization()
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerId, setCustomerId] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH')
  const [pending, setPending] = useState(false)
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  
  // Filter active products only
  const activeProducts = products.filter(p => p.is_active)

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id)
      if (existing) {
        return prev.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unit_price }
            : item
        )
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.selling_price,
        subtotal: product.selling_price
      }]
    })
  }

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const newQuantity = Math.max(1, item.quantity + delta)
        return { ...item, quantity: newQuantity, subtotal: newQuantity * item.unit_price }
      }
      return item
    }))
  }

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId))
  }

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0)

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setPending(true)
    
    const customerObj = customers.find(c => c.id === customerId)
    const customerName = customerObj ? customerObj.name : 'Walk-in Customer'
    const cartSnapshot = [...cart]
    const totalSnapshot = total
    const paymentSnapshot = paymentMethod

    const result = await processCheckout(
      cart.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, subtotal: i.subtotal })),
      customerId || null,
      paymentMethod,
      total
    )
    
    if (result?.success) {
      setCompletedSale({
        invoiceNumber: result.invoice_number,
        date: new Date(),
        customerName,
        paymentMethod: paymentSnapshot,
        items: cartSnapshot,
        total: totalSnapshot,
      })
      setCart([])
      setCustomerId('')
      setInvoiceOpen(true)
    } else {
      alert(`Checkout Error: ${result?.error || 'Failed to complete order'}`)
    }
    
    setPending(false)
  }

  const handlePrint = () => {
    const printContent = document.getElementById('printable-receipt')
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
            <title>Invoice - ${completedSale?.invoiceNumber || 'Receipt'}</title>
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
              .text-right {
                text-align: right;
              }
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
    } else {
      window.print()
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-4 h-full flex flex-col">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-auto pb-4">
            {activeProducts.map(product => (
              <Card key={product.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => addToCart(product)}>
                <CardContent className="p-4 flex flex-col items-center text-center justify-center h-32">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-muted-foreground">${product.selling_price}</p>
                </CardContent>
              </Card>
            ))}
            {activeProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No active products available.
              </div>
            )}
          </div>
        </div>

        {/* Cart / Checkout Sidebar */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Current Sale
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-auto space-y-4 min-h-[250px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-8">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-50" />
                <p>Cart is empty</p>
                <p className="text-xs">Click products on the left to add items.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map(item => (
                  <div key={item.product_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">${item.unit_price} each</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => updateQuantity(item.product_id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-xs">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none" onClick={() => updateQuantity(item.product_id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="font-medium w-16 text-right">${item.subtotal.toFixed(2)}</div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeFromCart(item.product_id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>

          <div className="p-4 border-t bg-muted/10 space-y-4">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Customer (Optional)</Label>
                <Select value={customerId} onValueChange={(val) => setCustomerId(val || '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Walk-in Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Walk-in Customer</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val || 'CASH')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card / Credit</SelectItem>
                    <SelectItem value="ONLINE">Online / UPI</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="CREDIT">Store Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2 border-t text-xl">
              <span className="font-medium">Total</span>
              <span className="font-semibold text-primary">${total.toFixed(2)}</span>
            </div>
            
            <Button 
              className="w-full h-12 text-lg cursor-pointer transition-all duration-200" 
              size="lg" 
              onClick={handleCheckout}
              disabled={cart.length === 0 || pending}
            >
              {pending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Processing Checkout...</span>
                </div>
              ) : (
                'Complete Checkout'
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Printable Invoice / Receipt Dialog */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-md p-6">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <DialogTitle className="text-lg font-semibold">Checkout Successful</DialogTitle>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {completedSale?.invoiceNumber}
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Sale completed and stock deducted successfully.
            </DialogDescription>
          </DialogHeader>

          {completedSale && (
            <div className="mt-2">
              {/* Receipt Body */}
              <div
                id="printable-receipt"
                className="bg-card text-card-foreground p-5 rounded-lg border border-dashed border-border/80 text-xs space-y-3 font-sans shadow-xs"
              >
                {/* Store Branding */}
                <div className="receipt-header text-center space-y-1.5">
                  <div className="flex items-center justify-center gap-2 font-bold text-base text-primary">
                    {organization?.logo_url ? (
                      <div className="h-7 w-7 rounded overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={organization.logo_url}
                          alt="Logo"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <Store className="h-4 w-4" />
                    )}
                    <span>{organization?.name || 'Qurbat ERP'}</span>
                  </div>
                  <p className="receipt-subtitle text-[11px] text-muted-foreground">Sales Receipt / Tax Invoice</p>
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
                    <span className="font-mono font-medium">{completedSale.invoiceNumber}</span>
                  </div>
                  <div className="meta-row flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{completedSale.date.toLocaleDateString()} {completedSale.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="meta-row flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{completedSale.customerName}</span>
                  </div>
                  <div className="meta-row flex justify-between">
                    <span className="text-muted-foreground">Payment:</span>
                    <span className="font-medium">{completedSale.paymentMethod.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="divider border-t border-dashed border-border" />

                {/* Items List */}
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b text-[10px] uppercase text-muted-foreground">
                      <th className="py-1 font-medium">Item</th>
                      <th className="py-1 text-center font-medium">Qty</th>
                      <th className="py-1 text-right font-medium">Price</th>
                      <th className="py-1 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {completedSale.items.map((item, idx) => (
                      <tr key={idx} className="py-1.5">
                        <td className="py-1 font-medium text-foreground">{item.name}</td>
                        <td className="py-1 text-center text-muted-foreground">{item.quantity}</td>
                        <td className="py-1 text-right text-muted-foreground">${item.unit_price.toFixed(2)}</td>
                        <td className="py-1 text-right font-medium text-foreground">${item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="divider border-t border-dashed border-border" />

                {/* Total */}
                <div className="total-section flex items-center justify-between text-base font-semibold pt-1">
                  <span>Grand Total</span>
                  <span className="text-primary font-mono">${completedSale.total.toFixed(2)}</span>
                </div>

                {/* Footer Note */}
                <div className="footer text-center pt-2 text-[10px] text-muted-foreground">
                  <p>Thank you for your visit!</p>
                  <p>Please retain this receipt for your records.</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setInvoiceOpen(false)}
              className="cursor-pointer"
            >
              Close / New Sale
            </Button>
            <div className="flex gap-2">
              <Link
                href={`/sales/invoices/${encodeURIComponent(completedSale?.invoiceNumber || '')}`}
                className={buttonVariants({ variant: 'outline' })}
              >
                <FileText className="h-4 w-4" />
                FBR Invoice
              </Link>
              <Button
                onClick={handlePrint}
                className="gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Printer className="h-4 w-4" />
                Print Invoice
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

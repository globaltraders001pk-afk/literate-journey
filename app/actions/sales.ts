'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCustomers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createCustomer(formData: FormData) {
  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const address = formData.get('address') as string
  const ntn = (formData.get('ntn') as string)?.trim()
  const buyer_type = (formData.get('buyer_type') as string)?.trim()

  if (!name) return { error: 'Name is required' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }

  const { error } = await supabase
    .from('customers')
    .insert({
      organization_id: profile.organization_id,
      name,
      phone,
      email,
      address,
      ntn: ntn || null,
      buyer_type: buyer_type || null
    })

  if (error) return { error: error.message }
  
  revalidatePath('/sales/customers')
  return { success: true }
}

/**
 * Next sequential invoice number for this org: <PREFIX>/<NNNN>.
 * The prefix comes from the org's FBR settings (invoice_prefix, default "GT-226").
 * Format matches the client's sample invoice (e.g. GT-226/0008): the
 * sequence NEVER restarts — it counts all of this org's `${prefix}/%`
 * rows and takes max suffix + 1. Old INV-YYYY-NNNN and INV-xxxxxx rows
 * are untouched and still look up fine via getInvoiceByNumber (exact
 * invoice_number match, no format assumption).
 * NOTE: two checkouts in the same instant could read the same max; there is
 * no DB sequence / unique constraint in this repo to guard that (see report).
 */
async function generateSequentialInvoiceNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string
): Promise<string> {
  let prefix = 'GT-226'
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('invoice_prefix')
      .eq('id', organizationId)
      .maybeSingle()
    const stored = (org as { invoice_prefix?: string | null } | null)?.invoice_prefix
    if (stored && stored.trim()) prefix = stored.trim().toUpperCase()
  } catch {
    // FBR columns not added to the live DB yet — fall back to the default prefix.
  }

  let next = 1
  const { data: existing, error } = await supabase
    .from('sales')
    .select('invoice_number')
    .eq('organization_id', organizationId)
    .like('invoice_number', `${prefix}/%`)

  if (!error && existing) {
    for (const row of existing as { invoice_number: string }[]) {
      // Digits after the LAST "/" — e.g. "GT-226/0008" -> 8. Old
      // "INV-2026-0001" rows never match the like() above, so they
      // cannot collide with or inflate this sequence.
      const match = /\/(\d+)$/.exec(row.invoice_number || '')
      if (match) next = Math.max(next, parseInt(match[1], 10) + 1)
    }
  }

  return `${prefix}/${String(next).padStart(4, '0')}`
}

export async function processCheckout(
  cart: { product_id: string, quantity: number, unit_price: number, subtotal: number }[],
  customerId: string | null,
  paymentMethod: string,
  totalAmount: number
) {
  if (!cart.length) return { error: 'Cart is empty' }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }
  
  let { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .limit(1)
    .single()

  if (!branch) {
    const { data: newBranch, error: branchError } = await supabase
      .from('branches')
      .insert({ organization_id: profile.organization_id, name: 'Main Branch' })
      .select('id')
      .single()
      
    if (branchError) return { error: 'Failed to create default branch.' }
    branch = newBranch
  }

  const invoice_number = await generateSequentialInvoiceNumber(supabase, profile.organization_id)

  // Normalize payment method to match Postgres enum payment_method: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE' | 'CREDIT'
  let normalizedPayment: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE' | 'CREDIT' = 'CASH'
  const upperPayment = (paymentMethod || 'CASH').toUpperCase()
  if (upperPayment === 'UPI' || upperPayment === 'ONLINE') {
    normalizedPayment = 'ONLINE'
  } else if (upperPayment === 'CARD') {
    normalizedPayment = 'CARD'
  } else if (upperPayment === 'BANK_TRANSFER') {
    normalizedPayment = 'BANK_TRANSFER'
  } else if (upperPayment === 'CREDIT') {
    normalizedPayment = 'CREDIT'
  } else {
    normalizedPayment = 'CASH'
  }

  // 1. Create Sale Header
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      customer_id: customerId || null,
      invoice_number,
      subtotal: totalAmount,
      total_amount: totalAmount,
      payment_method: normalizedPayment,
      created_by: profile.id
    })
    .select('id')
    .single()

  if (saleError) return { error: saleError.message }

  // 2. Prepare Batched Sale Items & Inventory Movements (Batch Insert in 1 roundtrip)
  const saleItemsPayload = cart.map(item => ({
    sale_id: sale.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal
  }))

  const inventoryMovementsPayload = cart.map(item => ({
    organization_id: profile.organization_id,
    branch_id: branch.id,
    product_id: item.product_id,
    movement_type: 'STOCK_OUT',
    quantity: -item.quantity, // Negative for sale deduction
    reference_type: 'sale',
    reference_id: sale.id,
    notes: `Sale ${invoice_number}`,
    created_by: profile.id
  }))

  // 3. Execute batched writes in parallel for lightning-fast invoice generation
  const tasks: PromiseLike<any>[] = [
    supabase.from('sale_items').insert(saleItemsPayload),
    supabase.from('inventory_movements').insert(inventoryMovementsPayload)
  ]

  // If customer is selected, update customer total_spent in parallel
  if (customerId) {
    tasks.push(
      (async () => {
        const { data: customerData } = await supabase
          .from('customers')
          .select('total_spent')
          .eq('id', customerId)
          .single()
        const currentTotal = customerData?.total_spent || 0
        await supabase
          .from('customers')
          .update({ total_spent: Number(currentTotal) + totalAmount })
          .eq('id', customerId)
      })()
    )
  }

  const [itemsRes, movementsRes] = await Promise.all(tasks)

  if (itemsRes?.error) {
    console.error('Error batch inserting sale items:', itemsRes.error)
  }
  if (movementsRes?.error) {
    console.error('Error batch inserting inventory movements:', movementsRes.error)
  }

  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/movements')
  revalidatePath('/sales/history')
  revalidatePath('/dashboard')

  return { success: true, invoice_number }
}

export async function getInvoiceByNumber(invoiceNumber: string) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userData.user.id)
      .single()

    if (!profile) return null

    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        id, invoice_number, subtotal, total_amount, payment_method, created_at,
        procurement_ref, fbr_status, fbr_reference_no, fbr_response_code,
        fbr_response_message, fbr_submitted_at,
        customer:customers(id, name, phone, email, address, ntn, buyer_type),
        items:sale_items(
          id, quantity, unit_price, subtotal,
          product:products(id, name, sku, weight)
        )
      `)
      .eq('organization_id', profile.organization_id)
      .eq('invoice_number', invoiceNumber)
      .maybeSingle()

    if (error || !sale) return null
    return sale
  } catch (err) {
    console.error('Error fetching invoice by number:', err)
    return null
  }
}

/**
 * Set / clear the procurement reference printed on an invoice
 * (the "Procurement Ref" line from the client's sample invoice).
 * Empty string clears it (stored as NULL). Max 50 chars.
 * NOTE: the invoice page is /sales/invoices/[id] where id is the
 * URL-encoded invoice number (see pos-client.tsx's link), so
 * revalidate that concrete path — not the literal "[id]" segment.
 */
export async function updateProcurementRef(invoiceNumber: string, value: string) {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return { error: 'Unauthorized' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userData.user.id)
      .single()

    if (!profile) return { error: 'Profile not found' }

    const procurement_ref = (value || '').trim().slice(0, 50) || null

    const { error } = await supabase
      .from('sales')
      .update({ procurement_ref })
      .eq('organization_id', profile.organization_id)
      .eq('invoice_number', invoiceNumber)

    if (error) return { error: error.message }

    revalidatePath(`/sales/invoices/${encodeURIComponent(invoiceNumber)}`)
    revalidatePath('/sales/pos')
    return { success: true }
  } catch (err) {
    console.error('Error updating procurement ref:', err)
    return { error: 'Failed to update procurement reference' }
  }
}


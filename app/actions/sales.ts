'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess, getUserProfile } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { revalidatePath } from 'next/cache'
import { INVOICE_SCHEMA_MISSING } from '@/lib/invoice-schema'
import {
  checkoutSchema,
  customerSchema,
  emptyToUndefined,
  firstZodError,
} from '@/lib/validation'
import {
  normalizePageOptions,
  type PageOptions,
} from '@/lib/pagination'

export async function getCustomers(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('customers')
    .select('*', { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

export async function createCustomer(formData: FormData) {
  const parsed = customerSchema.safeParse({
    name: formData.get('name'),
    phone: emptyToUndefined(formData.get('phone')),
    email: emptyToUndefined(formData.get('email')),
    address: emptyToUndefined(formData.get('address')),
    ntn: emptyToUndefined(formData.get('ntn')),
    buyer_type: emptyToUndefined(formData.get('buyer_type')),
  })
  if (!parsed.success) return { error: firstZodError(parsed) }
  const { name, phone, email, address, ntn, buyer_type } = parsed.data

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
      phone: phone || null,
      email: email || null,
      address: address || null,
      ntn: ntn || null,
      buyer_type: buyer_type || null
    })

  if (error) return { error: error.message }

  revalidatePath('/sales/customers')
  return { success: true }
}

// ---------------------------------------------------------------------------
// processCheckout — one atomic Postgres transaction (QA audit C3).
//
// The old code trusted the POS cart's unit_price / subtotal /
// totalAmount, inserted the sale header first, then only
// console.error'd failures of the items / movements /
// customer-total legs while still returning success. Now the
// whole sale runs inside public.process_checkout() (see
// supabase/migrations/20261122_money_transactions.sql), which:
//   * re-prices every line from products.selling_price — the
//     client-supplied prices are validated for shape only and
//     never used as money;
//   * verifies every product and the customer belong to the
//     caller's org, and that stock is sufficient;
//   * inserts the sale header + sale_items + inventory_movements
//     and bumps customers.total_spent atomically;
//   * mints the sequential invoice number under an org-row lock.
// Any leg failing raises, the transaction rolls back, and this
// action returns { error } — the POS shows the error instead of
// "Sale completed". There is no partial-success path.
// ---------------------------------------------------------------------------
export async function processCheckout(
  cart: { product_id: string, quantity: number, unit_price: number, subtotal: number }[],
  customerId: string | null,
  paymentMethod: string,
  totalAmount: number
) {
  // Shape only: negative / NaN quantities and totals are refused
  // before any DB call. Money itself is re-derived server-side.
  const parsed = checkoutSchema.safeParse({
    cart: (cart || []).map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    })),
    customerId,
    paymentMethod,
    totalAmount,
  })
  if (!parsed.success) return { error: firstZodError(parsed) }

  // Auth gate (QA audit C3: sales.ts had zero checkAccess calls).
  // Every signed-in role may sell at the POS — this is the
  // signed-out redirect, not a role restriction. The org is
  // derived from the JWT inside the RPC, not from this profile.
  try {
    await checkAccess(['owner', 'admin', 'manager', 'employee'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('process_checkout', {
    p_customer_id: parsed.data.customerId,
    p_payment_method: parsed.data.paymentMethod,
    p_items: parsed.data.cart.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    })),
  })

  if (error) return { error: error.message }

  const result = data as { invoice_number?: string; total_amount?: number } | null
  if (!result?.invoice_number) {
    return { error: 'Checkout failed: no invoice was created.' }
  }

  revalidatePath('/sales/pos')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/movements')
  revalidatePath('/dashboard')

  // total_amount is the server-computed total (catalog prices),
  // which the POS receipt must show — never the cart's total.
  return {
    success: true,
    invoice_number: result.invoice_number,
    total_amount: Number(result.total_amount) || 0,
  }
}

/**
 * Marker returned by getInvoiceByNumber when the query fails because
 * the FBR v2 columns (procurement_ref, fbr_status, ...) do not exist
 * in the database yet — i.e. the v2 delta SQL has not been run on the
 * live DB. The invoice page shows a plain "schema update needed"
 * message for this instead of a 404, so old pre-v2 invoices stay
 * readable in spirit (and new ones fail loudly, not silently).
 * (The marker itself lives in lib/invoice-schema.ts — a 'use server'
 * file may only export async functions.)
 */

// PostgREST reports a missing column as PGRST204 ("could not find the
// column ... in the schema cache"); Postgres itself reports it as
// 42703 / "column ... does not exist". Match defensively on code or
// message, not on one exact string, so either layer's wording is caught.
function isMissingColumnError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  if (code === 'PGRST204' || code === '42703') return true
  const message = (error as { message?: string } | null)?.message || ''
  return (
    /column .* does not exist/i.test(message) ||
    /could not find the .* column/i.test(message)
  )
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

    if (error) {
      if (isMissingColumnError(error)) return INVOICE_SCHEMA_MISSING
      return null
    }
    if (!sale) return null
    return sale
  } catch (err) {
    console.error('Error fetching invoice by number:', err)
    if (isMissingColumnError(err)) return INVOICE_SCHEMA_MISSING
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
    // Owner/admin/manager only (QA audit M13): an employee must not
    // rewrite the procurement reference printed on an invoice.
    let profile: { organization_id: string }
    try {
      profile = await checkAccess(['owner', 'admin', 'manager'])
    } catch (err) {
      if (isRedirectError(err)) throw err
      return { error: 'Unauthorized' }
    }

    const supabase = await createClient()

    const procurement_ref = (value || '').trim().slice(0, 50) || null

    // Zero matched rows means no such invoice in this org — report
    // it instead of the old silent `{ success: true }` on a no-op.
    const { data, error } = await supabase
      .from('sales')
      .update({ procurement_ref })
      .eq('organization_id', profile.organization_id)
      .eq('invoice_number', invoiceNumber)
      .select('id')

    if (error) return { error: error.message }
    if (!data || data.length === 0) {
      return { error: 'Invoice not found in your organization.' }
    }

    revalidatePath(`/sales/invoices/${encodeURIComponent(invoiceNumber)}`)
    revalidatePath('/sales/pos')
    return { success: true }
  } catch (err) {
    // A redirect (e.g. from checkAccess) must never become a
    // silent `{ error }` — rethrow it so Next.js can redirect.
    if (isRedirectError(err)) throw err
    console.error('Error updating procurement ref:', err)
    return { error: 'Failed to update procurement reference' }
  }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess, getUserProfile } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { revalidatePath } from 'next/cache'
import { firstZodError, returnSchema } from '@/lib/validation'
import { normalizePageOptions, type PageOptions } from '@/lib/pagination'

export async function getReturns(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('returns')
    .select(`
      *,
      customers(name),
      sales(invoice_number),
      return_items(
        *,
        products(name, sku)
      )
    `, { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

// ---------------------------------------------------------------------------
// processReturn — one atomic Postgres transaction (QA audit H9).
//
// The old code never checked that the sale existed, that the
// product was on it, or that the quantities / refund were within
// what was sold and paid — and it Promise.all'd the writes
// without inspecting the results while still returning success.
// Now the whole return runs inside public.process_return()
// (supabase/migrations/20261122_money_transactions.sql), which
// validates every line against the original sale and its prior
// returns (qty <= sold minus already-returned, refund <= still
// refundable, return_action whitelisted), inserts the return +
// items + movements, and decrements customers.total_spent
// atomically. Any leg failing raises, the transaction rolls
// back, and this action returns { error }. Return numbers are
// sequential RET-<NNNN> per org, minted under an org-row lock
// (the old RET-<Date.now> could collide).
// ---------------------------------------------------------------------------
export async function processReturn(
  sale_id: string,
  customer_id: string | null,
  returnItems: { product_id: string, quantity: number, return_action: string, refund_amount: number }[]
) {
  const parsed = returnSchema.safeParse({
    sale_id,
    customer_id,
    returnItems,
  })
  if (!parsed.success) return { error: firstZodError(parsed) }

  // Auth gate. Every signed-in role may process a return at the
  // counter — this is the signed-out redirect, not a role cut.
  try {
    await checkAccess(['owner', 'admin', 'manager', 'employee'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('process_return', {
    p_sale_id: parsed.data.sale_id,
    p_customer_id: parsed.data.customer_id,
    p_items: parsed.data.returnItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      return_action: item.return_action,
      refund_amount: item.refund_amount,
    })),
  })

  if (error) return { error: error.message }

  const result = data as { return_number?: string; refund_amount?: number } | null
  if (!result?.return_number) {
    return { error: 'Return failed: no return was created.' }
  }

  revalidatePath('/sales/returns')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/movements')
  return {
    success: true,
    return_number: result.return_number,
    refund_amount: Number(result.refund_amount) || 0,
  }
}

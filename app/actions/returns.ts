'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getReturns() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('returns')
    .select(`
      *,
      customers(name),
      sales(invoice_number),
      return_items(
        *,
        products(name, sku)
      )
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data
}

export async function processReturn(
  sale_id: string,
  customer_id: string | null,
  returnItems: { product_id: string, quantity: number, return_action: string, refund_amount: number }[]
) {
  if (!returnItems.length) return { error: 'No items to return' }

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

  const return_number = `RET-${Date.now().toString().slice(-6)}`
  const totalRefund = returnItems.reduce((sum, item) => sum + item.refund_amount, 0)

  // Create Return Header
  const { data: ret, error: retError } = await supabase
    .from('returns')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      sale_id: sale_id || null,
      customer_id: customer_id || null,
      return_number,
      status: 'processed',
      refund_amount: totalRefund,
      created_by: profile.id
    })
    .select('id')
    .single()

  if (retError) return { error: retError.message }

  // Create Return Items & Inventory Movements
  for (const item of returnItems) {
    // 1. Insert return item
    await supabase.from('return_items').insert({
      return_id: ret.id,
      product_id: item.product_id,
      quantity: item.quantity,
      return_action: item.return_action,
      refund_amount: item.refund_amount
    })

    // 2. Insert inventory movement based on action
    if (item.return_action === 'restock') {
      await supabase.from('inventory_movements').insert({
        organization_id: profile.organization_id,
        branch_id: branch.id,
        product_id: item.product_id,
        movement_type: 'RETURN',
        quantity: item.quantity, // Positive to increase stock
        reference_type: 'return',
        reference_id: ret.id,
        notes: `Restocked from return ${return_number}`,
        created_by: profile.id
      })
    } else if (item.return_action === 'damage') {
      await supabase.from('inventory_movements').insert({
        organization_id: profile.organization_id,
        branch_id: branch.id,
        product_id: item.product_id,
        movement_type: 'WASTAGE',
        quantity: -item.quantity,
        reference_type: 'return',
        reference_id: ret.id,
        notes: `Damaged from return ${return_number}`,
        created_by: profile.id
      })
    } else if (item.return_action === 'discard') {
      // Discard = expired/wasted, logged as a negative movement
      await supabase.from('inventory_movements').insert({
        organization_id: profile.organization_id,
        branch_id: branch.id,
        product_id: item.product_id,
        movement_type: 'WASTAGE',
        quantity: -item.quantity,
        reference_type: 'return',
        reference_id: ret.id,
        notes: `Discarded from return ${return_number}`,
        created_by: profile.id
      })
    }
  }

  // Deduct from customer total_spent if applicable
  if (customer_id && totalRefund > 0) {
    const { data: customerData } = await supabase
      .from('customers')
      .select('total_spent')
      .eq('id', customer_id)
      .single()
      
    const currentTotal = customerData?.total_spent || 0
    await supabase
      .from('customers')
      .update({ total_spent: Number(currentTotal) - totalRefund })
      .eq('id', customer_id)
  }

  revalidatePath('/sales/returns')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/movements')
  return { success: true, return_number }
}

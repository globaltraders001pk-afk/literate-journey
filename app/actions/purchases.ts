'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getPurchaseOrders() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      vendors(name),
      purchase_order_items(
        *,
        products(name, sku)
      )
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createSimplePO(formData: FormData) {
  const vendor_id = formData.get('vendor_id') as string
  const po_number = formData.get('po_number') as string
  const product_id = formData.get('product_id') as string
  const quantity = parseInt(formData.get('quantity') as string)
  const unit_price = parseFloat(formData.get('unit_price') as string)

  if (!vendor_id || !po_number || !product_id || !quantity || !unit_price) {
    return { error: 'Required fields missing' }
  }

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

  const total_amount = quantity * unit_price

  // Create PO
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      vendor_id,
      po_number,
      status: 'sent',
      total_amount,
      created_by: profile.id
    })
    .select('id')
    .single()

  if (poError) return { error: poError.message }

  // Create PO Item
  const { error: itemError } = await supabase
    .from('purchase_order_items')
    .insert({
      po_id: po.id,
      product_id,
      quantity,
      unit_price
    })

  if (itemError) return { error: itemError.message }
  
  revalidatePath('/purchases/orders')
  return { success: true }
}

export async function receivePurchaseOrder(poId: string, itemId: string, productId: string, quantity: number, expiryDate?: string | null) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, organization_id')
    .eq('id', userData.user.id)
    .single()

  if (!profile) return { error: 'Profile not found' }
  
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .limit(1)
    .single()

  if (!branch) return { error: 'No branch found.' }

  // 1. Mark PO as received
  await supabase
    .from('purchase_orders')
    .update({ status: 'received' })
    .eq('id', poId)

  // 2. Mark item as received
  await supabase
    .from('purchase_order_items')
    .update({ received_quantity: quantity })
    .eq('id', itemId)

  // 3. Create a product batch automatically. The expiry is recorded
  // when the goods arrive with one (expiryDate), otherwise NULL — the
  // old code invented "today + 30 days", which put every receipt in
  // the URGENT band of the Expiry Radar. Requires the
  // product-batches-expiry-nullable-delta.sql delta on the live DB.
  // The batch number is made unique per receipt so a second receive
  // of the same PO does not reuse the same batch code.
  const { data: po } = await supabase.from('purchase_orders').select('po_number').eq('id', poId).single()

  let batchNumber = `${po?.po_number}-RECV`
  const { data: existingBatches } = await supabase
    .from('product_batches')
    .select('batch_number')
    .like('batch_number', `${batchNumber}%`)
  if (existingBatches && existingBatches.some(b => b.batch_number === batchNumber)) {
    let suffix = 2
    while (existingBatches.some(b => b.batch_number === `${batchNumber}-${suffix}`)) suffix++
    batchNumber = `${batchNumber}-${suffix}`
  }

  const { error: batchError } = await supabase
    .from('product_batches')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      product_id: productId,
      batch_number: batchNumber,
      expiry_date: expiryDate || null,
      quantity_received: quantity,
      quantity_remaining: quantity
    })

  if (batchError) return { error: batchError.message }

  // 4. Create inventory movement
  await supabase
    .from('inventory_movements')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      product_id: productId,
      movement_type: 'STOCK_IN',
      quantity: quantity,
      reference_type: 'purchase_order',
      reference_id: poId,
      notes: `Received from PO ${po?.po_number}`,
      created_by: profile.id
    })

  revalidatePath('/purchases/orders')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/batches')
  revalidatePath('/inventory/movements')
  return { success: true }
}

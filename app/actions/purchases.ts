'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess, getUserProfile } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { revalidatePath } from 'next/cache'
import { firstZodError, receivePurchaseSchema } from '@/lib/validation'
import { normalizePageOptions, type PageOptions } from '@/lib/pagination'

export async function getPurchaseOrders(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('purchase_orders')
    .select(`
      *,
      vendors(name),
      purchase_order_items(
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
  // Shape first: ids must be uuids, quantity a whole number 1-10000,
  // expiry a YYYY-MM-DD date or null (null = no expiry stated).
  const parsed = receivePurchaseSchema.safeParse({
    poId,
    itemId,
    productId,
    quantity,
    expiryDate: expiryDate ?? null,
  })
  if (!parsed.success) return { error: firstZodError(parsed) }

  // Auth gate (QA audit H8: the old receive had no checkAccess at
  // all). Every signed-in role may receive stock — this is the
  // signed-out redirect, not a role cut.
  let profile: { id: string; organization_id: string }
  try {
    profile = await checkAccess(['owner', 'admin', 'manager', 'employee'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized' }
  }

  const supabase = await createClient()

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .limit(1)
    .single()

  if (!branch) return { error: 'No branch found.' }

  // Status guard (QA audit H8): a PO that is already received
  // refuses a second receive. The PO must also belong to the
  // caller's org — a bare id used to flip any tenant's PO.
  const { data: po, error: poFetchError } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status')
    .eq('id', parsed.data.poId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (poFetchError) return { error: poFetchError.message }
  if (!po) return { error: 'Purchase order not found in your organization.' }
  if (po.status === 'received') {
    return { error: 'This purchase order has already been received.' }
  }

  // The item must belong to this PO, and must not already be fully
  // received — otherwise the same line could be received twice.
  const { data: poItem, error: itemFetchError } = await supabase
    .from('purchase_order_items')
    .select('id, product_id, quantity, received_quantity')
    .eq('id', parsed.data.itemId)
    .eq('po_id', parsed.data.poId)
    .single()

  if (itemFetchError) return { error: itemFetchError.message }
  if (!poItem) return { error: 'Purchase order item not found.' }
  if (poItem.product_id !== parsed.data.productId) {
    return { error: 'Product does not match the purchase order item.' }
  }
  const alreadyReceived = Number(poItem.received_quantity) || 0
  if (alreadyReceived >= Number(poItem.quantity)) {
    return { error: 'This purchase order item has already been fully received.' }
  }
  if (parsed.data.quantity > Number(poItem.quantity) - alreadyReceived) {
    return { error: 'Receive quantity exceeds the quantity ordered for this item.' }
  }

  // 1. Mark PO as received — every write's error is checked now.
  // The old code awaited all four writes bare: a failed status
  // flip or movement insert still returned success, and a double
  // click created a duplicate batch and double-counted stock.
  // The update is compare-and-swap on the status read above: if
  // the PO changed under us, zero rows match and we refuse
  // instead of reporting success.
  const { data: updatedPo, error: poError } = await supabase
    .from('purchase_orders')
    .update({ status: 'received' })
    .eq('id', parsed.data.poId)
    .eq('organization_id', profile.organization_id)
    .eq('status', po.status)
    .select('id')

  if (poError) return { error: poError.message }
  if (!updatedPo || updatedPo.length === 0) {
    return { error: 'Purchase order was already received or changed.' }
  }

  // 2. Mark item as received (zero matched rows = the item
  // vanished under us — refuse instead of reporting success).
  const { data: updatedItem, error: itemError } = await supabase
    .from('purchase_order_items')
    .update({ received_quantity: alreadyReceived + parsed.data.quantity })
    .eq('id', parsed.data.itemId)
    .select('id')

  if (itemError) return { error: itemError.message }
  if (!updatedItem || updatedItem.length === 0) {
    return { error: 'Purchase order item not found.' }
  }

  // 3. Create a product batch automatically. The expiry is recorded
  // when the goods arrive with one (expiryDate, from the receive
  // form), otherwise NULL — the old code invented "today + 30
  // days", which put every receipt in the URGENT band of the
  // Expiry Radar. Requires the
  // product-batches-expiry-nullable-delta.sql delta on the live DB.
  // The batch number is made unique per receipt so a second receive
  // of the same PO does not reuse the same batch code.
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
      product_id: parsed.data.productId,
      batch_number: batchNumber,
      expiry_date: parsed.data.expiryDate || null,
      quantity_received: parsed.data.quantity,
      quantity_remaining: parsed.data.quantity
    })

  if (batchError) return { error: batchError.message }

  // 4. Create inventory movement
  const { error: movementError } = await supabase
    .from('inventory_movements')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      product_id: parsed.data.productId,
      movement_type: 'STOCK_IN',
      quantity: parsed.data.quantity,
      reference_type: 'purchase_order',
      reference_id: parsed.data.poId,
      notes: `Received from PO ${po?.po_number}`,
      created_by: profile.id
    })

  if (movementError) return { error: movementError.message }

  revalidatePath('/purchases/orders')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/batches')
  revalidatePath('/inventory/movements')
  return { success: true }
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess, getUserProfile } from '@/lib/auth-utils'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { generateAutoBatchNumber } from '@/lib/batch-number'
import { revalidatePath } from 'next/cache'
import { normalizePageOptions, type PageOptions } from '@/lib/pagination'

export async function getCategories() {
  const profile = await getUserProfile()
  if (!profile) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createCategory(formData: FormData) {
  try { await checkAccess(['admin', 'owner', 'manager']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Only owners, admins and managers can add categories.' } }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  
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
    .from('categories')
    .insert({
      organization_id: profile.organization_id,
      name,
      description
    })

  if (error) return { error: error.message }
  
  revalidatePath('/inventory/categories')
  return { success: true }
}

export async function updateCategory(id: string, formData: FormData) {
  try { await checkAccess(['admin', 'owner', 'manager']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Only owners, admins and managers can edit categories.' } }

  const name = formData.get('name') as string
  const description = formData.get('description') as string
  
  if (!name) return { error: 'Name is required' }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Org-scoped (QA audit H12): a bare id must never update another
  // tenant's row. Zero matched rows means unknown id or wrong org.
  const { data, error } = await supabase
    .from('categories')
    .update({ name, description })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Category not found in your organization.' }
  
  revalidatePath('/inventory/categories')
  return { success: true }
}

export async function deleteCategory(id: string) {
  try { await checkAccess(['admin', 'owner', 'manager']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Only owners, admins and managers can delete categories.' } }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Category not found in your organization.' }
  
  revalidatePath('/inventory/categories')
  return { success: true }
}

export async function getProducts(options?: PageOptions) {
  const profile = await getUserProfile()
  if (!profile) return { rows: [], total: 0, limit: 0, offset: 0 }
  const { limit, offset } = normalizePageOptions(options)
  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('products')
    .select(`
      *,
      categories(name)
    `, { count: 'exact' })
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

export async function createProduct(formData: FormData) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized to add products' }
  }

  const name = formData.get('name') as string
  const sku = formData.get('sku') as string
  const category_id = formData.get('category_id') as string
  const selling_price = formData.get('selling_price')
  const cost_price = formData.get('cost_price')
  const unit = formData.get('unit') as string
  const weight = formData.get('weight') as string
  const min_stock = formData.get('minimum_stock_level')

  if (!name || !selling_price || !cost_price) return { error: 'Required fields missing' }

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
    .from('products')
    .insert({
      organization_id: profile.organization_id,
      name,
      sku,
      category_id: category_id || null,
      selling_price: parseFloat(selling_price as string),
      cost_price: parseFloat(cost_price as string),
      unit,
      weight: weight || null,
      minimum_stock_level: min_stock ? parseInt(min_stock as string) : 0,
    })

  if (error) return { error: error.message }
  
  revalidatePath('/inventory/products')
  return { success: true }
}

export async function updateProduct(id: string, formData: FormData) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized to edit products' }
  }

  const name = formData.get('name') as string
  const sku = formData.get('sku') as string
  const category_id = formData.get('category_id') as string
  const selling_price = formData.get('selling_price')
  const cost_price = formData.get('cost_price')
  const unit = formData.get('unit') as string
  const weight = formData.get('weight') as string
  const min_stock = formData.get('minimum_stock_level')

  if (!name || !selling_price || !cost_price) return { error: 'Required fields missing' }

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()

  // Org-scoped (QA audit H12): zero matched rows means unknown id
  // or another org's product.
  const { data, error } = await supabase
    .from('products')
    .update({
      name,
      sku,
      category_id: category_id || null,
      selling_price: parseFloat(selling_price as string),
      cost_price: parseFloat(cost_price as string),
      unit,
      weight: weight || null,
      minimum_stock_level: min_stock ? parseInt(min_stock as string) : 0,
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Product not found in your organization.' }
  
  revalidatePath('/inventory/products')
  return { success: true }
}

export async function deleteProduct(id: string) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch (err) {
    if (isRedirectError(err)) throw err
    return { error: 'Unauthorized to delete products' }
  }

  const supabase = await createClient()

  const profile = await getUserProfile()
  if (!profile) return { error: 'Unauthorized' }

  // Check if product has sales or inventory movements
  const [{ count: movementCount }, { count: saleCount }] = await Promise.all([
    supabase.from('inventory_movements').select('*', { count: 'exact', head: true }).eq('product_id', id),
    supabase.from('sale_items').select('*', { count: 'exact', head: true }).eq('product_id', id)
  ])

  if ((movementCount && movementCount > 0) || (saleCount && saleCount > 0)) {
    // Soft delete to preserve historical integrity. Org-scoped
    // (QA audit H12): a zero-row result means unknown id or
    // another org's product — never report success for it.
    const { data, error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('organization_id', profile.organization_id)
      .select('id')

    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: 'Product not found in your organization.' }
    revalidatePath('/inventory/products')
    revalidatePath('/inventory/stock')
    return { success: true, message: 'Product has active history and was deactivated.' }
  }

  // Hard delete if no transactions exist
  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Product not found in your organization.' }
  
  revalidatePath('/inventory/products')
  revalidatePath('/inventory/stock')
  return { success: true, message: 'Product deleted successfully.' }
}

// One row of public.get_stock_levels(): per-product current stock
// aggregated in Postgres. The RPC returns untyped JSON, so the
// shape is pinned here — without it, every derived list (the
// dashboard's low-stock items, the stock radar) degrades to `any`.
export interface StockLevel {
  id: string
  name: string
  sku: string | null
  minimum_stock_level: number | null
  current_stock: number
  status: string
}

interface StockLevelRpcRow {
  product_id: string
  name: string
  sku: string | null
  minimum_stock_level: number | null
  current_stock: number | string
  status: string
}

// Stock is aggregated in Postgres now (QA audit M8): the old
// version fetched every active product with ALL of its
// inventory_movements and summed them in JS, so cost grew with
// total history. public.get_stock_levels() returns one row per
// product with the signed movement sum. The org always comes
// from the caller's own JWT inside the function — no org
// parameter is accepted, so a caller can never ask for another
// tenant's stock.
export async function getStockLevels(): Promise<StockLevel[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_stock_levels')

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as StockLevelRpcRow[]
  return rows.map((row) => ({
    id: row.product_id,
    name: row.name,
    sku: row.sku,
    minimum_stock_level: row.minimum_stock_level,
    current_stock: Number(row.current_stock) || 0,
    status: row.status,
  }))
}

export async function getMovements(limit: number = 200) {
  const profile = await getUserProfile()
  if (!profile) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_movements')
    .select(`
      id,
      movement_type,
      quantity,
      reference_type,
      notes,
      created_at,
      products(name, sku),
      profiles(full_name)
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw new Error(error.message)
  return data
}

export async function createMovement(formData: FormData) {
  // Role gate (S6 sweep): any signed-in staff records movements,
  // but the call must be authenticated + role-checked, not just
  // "has a user row" — the old code only checked getUser().
  try { await checkAccess(['owner', 'admin', 'manager', 'employee']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  const product_id = formData.get('product_id') as string
  const movement_type = formData.get('movement_type') as string
  // Float-safe parse (QA audit L6): parseInt truncated fractional
  // quantities — 2.5 kg became 2 kg. Quantities here are amounts
  // of goods (kg, litres), not counts, so fractions are real.
  const quantity = parseFloat(formData.get('quantity') as string)
  const notes = formData.get('notes') as string
  // Optional expiry for the auto-created batch (stock-in only). When the
  // goods arrive without a stated expiry, the batch stores NULL rather
  // than an invented date. Requires the
  // product-batches-expiry-nullable-delta.sql delta on the live DB.
  const expiry_date = formData.get('expiry_date') as string

  if (!product_id || !movement_type) return { error: 'Required fields missing' }
  if (!Number.isFinite(quantity) || quantity === 0) {
    return { error: 'Enter a valid non-zero quantity' }
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

  // Normalize movement type to Postgres enum: 'STOCK_IN' | 'STOCK_OUT' | 'WASTAGE' | 'RETURN' | 'ADJUSTMENT'
  // The sign comes from the movement type, and the typed quantity
  // must already agree with it (QA audit L6): the old code
  // silently Math.abs()'d whatever was typed, so "-5" on a
  // stock-in quietly became +5 and "+5" on a sale quietly became
  // -5. A quantity with the wrong sign is now rejected with a
  // clear error instead of being silently flipped. ADJUSTMENT is
  // the one exception — a correction can legitimately go either
  // way, so its sign is kept as typed.
  let normalizedType: 'STOCK_IN' | 'STOCK_OUT' | 'WASTAGE' | 'RETURN' | 'ADJUSTMENT' = 'ADJUSTMENT'
  const rawType = movement_type.toLowerCase()
  let finalQuantity = quantity

  if (['opening_stock', 'purchase', 'stock_in'].includes(rawType)) {
    normalizedType = 'STOCK_IN'
    if (quantity < 0) return { error: 'Quantity must be positive for stock-in. Enter the amount received.' }
    finalQuantity = quantity
  } else if (['sale', 'transfer_out', 'stock_out'].includes(rawType)) {
    normalizedType = 'STOCK_OUT'
    if (quantity < 0) return { error: 'Quantity must be positive for stock-out. Enter the amount sold or removed.' }
    finalQuantity = -quantity
  } else if (['damaged', 'expired', 'wastage'].includes(rawType)) {
    normalizedType = 'WASTAGE'
    if (quantity < 0) return { error: 'Quantity must be positive for wastage. Enter the amount damaged or expired.' }
    finalQuantity = -quantity
  } else if (['return'].includes(rawType)) {
    normalizedType = 'RETURN'
    if (quantity < 0) return { error: 'Quantity must be positive for returns. Enter the amount returned.' }
    finalQuantity = quantity
  } else {
    normalizedType = 'ADJUSTMENT'
  }

  const { error } = await supabase
    .from('inventory_movements')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      product_id,
      movement_type: normalizedType,
      quantity: finalQuantity,
      notes,
      created_by: profile.id
    })

  if (error) return { error: error.message }

  // Stock entering the business (opening stock / purchase) gets a batch
  // automatically, so the Expiry Radar sees it without anyone having to
  // create the batch by hand. Expiry is recorded when provided, else NULL.
  // Stock-out, wastage, returns and adjustments touch existing batches
  // only, so no batch is created for them.
  if (normalizedType === 'STOCK_IN') {
    const { error: batchError } = await supabase
      .from('product_batches')
      .insert({
        organization_id: profile.organization_id,
        branch_id: branch.id,
        product_id,
        batch_number: generateAutoBatchNumber(),
        manufacturing_date: null,
        expiry_date: expiry_date || null,
        quantity_received: finalQuantity,
        quantity_remaining: finalQuantity
      })

    if (batchError) {
      return { error: `Movement recorded, but the batch could not be created: ${batchError.message}` }
    }
  }

  revalidatePath('/inventory/movements')
  revalidatePath('/inventory/batches')
  revalidatePath('/inventory/stock')
  return { success: true }
}

export async function getBatches(
  organizationId?: string,
  options?: PageOptions
) {
  // Same org rule as before: radars pass their org, everyone else
  // is scoped to the signed-in user's org. (The org parameter is
  // only ever the caller's own — see getExpiryRadar.)
  const orgId = organizationId ?? (await getUserProfile())?.organization_id
  if (!orgId) return { rows: [], total: 0, limit: 0, offset: 0 }
  // Batches are ordered by expiry first, so a capped page still
  // holds the nearest-expiring batches (the ones every consumer
  // — radars, dashboard — cares about).
  const { limit, offset } = normalizePageOptions(options)

  const supabase = await createClient()
  const { data, error, count } = await supabase
    .from('product_batches')
    .select(`
      *,
      products(name, sku)
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .order('expiry_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return { rows: data ?? [], total: count ?? 0, limit, offset }
}

export async function createBatch(formData: FormData) {
  // Role gate (S6 sweep): same rule as createMovement — any
  // signed-in staff may record a received batch.
  try { await checkAccess(['owner', 'admin', 'manager', 'employee']) } catch (err) { if (isRedirectError(err)) throw err; return { error: 'Unauthorized' } }

  const product_id = formData.get('product_id') as string
  const batch_number = formData.get('batch_number') as string
  // Float-safe parse (QA audit L6): parseInt truncated fractional
  // quantities — 2.5 kg became 2 kg.
  const quantity = parseFloat(formData.get('quantity') as string)
  const manufacturing_date = formData.get('manufacturing_date') as string
  const expiry_date = formData.get('expiry_date') as string

  if (!product_id || !batch_number || !expiry_date) return { error: 'Required fields missing' }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'Enter a valid quantity greater than zero' }
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
  
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', profile.organization_id)
    .limit(1)
    .single()

  if (!branch) return { error: 'No branch found.' }

  const { error } = await supabase
    .from('product_batches')
    .insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      product_id,
      batch_number,
      manufacturing_date: manufacturing_date || null,
      expiry_date,
      quantity_received: quantity,
      quantity_remaining: quantity
    })

  if (error) return { error: error.message }
  
  // Also create a movement for the opening stock of this batch.
  // The insert's error is checked now (QA audit L5): the old code
  // fire-and-forget it, so a batch could exist with no stock
  // movement behind it and nobody would know. The batch row
  // already exists at this point, so the error says so plainly.
  const { error: movementError } = await supabase.from('inventory_movements').insert({
    organization_id: profile.organization_id,
    branch_id: branch.id,
    product_id,
    movement_type: 'STOCK_IN',
    quantity: quantity,
    notes: `Batch ${batch_number} received`,
    created_by: profile.id
  })

  if (movementError) {
    return { error: `Batch ${batch_number} was created, but its stock movement could not be recorded: ${movementError.message}` }
  }

  revalidatePath('/inventory/batches')
  revalidatePath('/inventory/stock')
  return { success: true }
}

export async function getDashboardStats() {
  const profile = await getUserProfile()
  if (!profile) {
    return { lowStock: 0, expiringBatches: 0, totalCategories: 0, totalProducts: 0 }
  }
  const orgId = profile.organization_id
  const supabase = await createClient()
  
  // 1. Get low stock products
  const productsData = await getStockLevels()
  const lowStockProducts = productsData.filter((p) => p.status === 'Low Stock').length

  // 2. Get expiring batches (next 30 days)
  const { data: batches } = await supabase
    .from('product_batches')
    .select('expiry_date')
    .eq('organization_id', orgId)
    .gt('quantity_remaining', 0)
  
  let expiringCount = 0
  if (batches) {
    const today = new Date()
    const nextMonth = new Date()
    nextMonth.setDate(today.getDate() + 30)
    
    expiringCount = batches.filter(b => {
      const expDate = new Date(b.expiry_date)
      return expDate >= today && expDate <= nextMonth
    }).length
  }

  // 3. Get total categories
  const { count: categoryCount } = await supabase
    .from('categories')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  // 4. Get total products
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  return {
    lowStock: lowStockProducts,
    expiringBatches: expiringCount,
    totalCategories: categoryCount || 0,
    totalProducts: productCount || 0
  }
}

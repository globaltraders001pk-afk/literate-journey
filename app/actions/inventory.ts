'use server'

import { createClient } from '@/lib/supabase/server'
import { checkAccess } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

export async function getCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createCategory(formData: FormData) {
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
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  
  if (!name) return { error: 'Name is required' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('categories')
    .update({ name, description })
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/inventory/categories')
  return { success: true }
}

export async function deleteCategory(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/inventory/categories')
  return { success: true }
}

export async function getProducts() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories(name)
    `)
    .order('created_at', { ascending: false })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createProduct(formData: FormData) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch {
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
  } catch {
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

  const supabase = await createClient()

  const { error } = await supabase
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

  if (error) return { error: error.message }
  
  revalidatePath('/inventory/products')
  return { success: true }
}

export async function deleteProduct(id: string) {
  try {
    await checkAccess(['admin', 'owner', 'manager'])
  } catch {
    return { error: 'Unauthorized to delete products' }
  }

  const supabase = await createClient()

  // Check if product has sales or inventory movements
  const [{ count: movementCount }, { count: saleCount }] = await Promise.all([
    supabase.from('inventory_movements').select('*', { count: 'exact', head: true }).eq('product_id', id),
    supabase.from('sale_items').select('*', { count: 'exact', head: true }).eq('product_id', id)
  ])

  if ((movementCount && movementCount > 0) || (saleCount && saleCount > 0)) {
    // Soft delete to preserve historical integrity
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)

    if (error) return { error: error.message }
    revalidatePath('/inventory/products')
    revalidatePath('/inventory/stock')
    return { success: true, message: 'Product has active history and was deactivated.' }
  }

  // Hard delete if no transactions exist
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/inventory/products')
  revalidatePath('/inventory/stock')
  return { success: true, message: 'Product deleted successfully.' }
}

export async function getStockLevels() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      sku,
      minimum_stock_level,
      inventory_movements (
        quantity
      )
    `)
    .eq('is_active', true)
    .order('name')
  
  if (error) throw new Error(error.message)
  
  // Calculate total stock by summing movements
  return data.map((product: any) => {
    const movements = product.inventory_movements || []
    const currentStock = movements.reduce((sum: number, movement: any) => sum + (Number(movement.quantity) || 0), 0)
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      minimum_stock_level: product.minimum_stock_level,
      current_stock: currentStock,
      status: currentStock <= (product.minimum_stock_level || 0) ? 'Low Stock' : 'In Stock'
    }
  })
}

export async function getMovements(limit: number = 200) {
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
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw new Error(error.message)
  return data
}

export async function createMovement(formData: FormData) {
  const product_id = formData.get('product_id') as string
  const movement_type = formData.get('movement_type') as string
  const quantity = parseInt(formData.get('quantity') as string)
  const notes = formData.get('notes') as string

  if (!product_id || !movement_type || !quantity) return { error: 'Required fields missing' }

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
  let normalizedType: 'STOCK_IN' | 'STOCK_OUT' | 'WASTAGE' | 'RETURN' | 'ADJUSTMENT' = 'ADJUSTMENT'
  const rawType = movement_type.toLowerCase()
  let finalQuantity = quantity

  if (['opening_stock', 'purchase', 'stock_in'].includes(rawType)) {
    normalizedType = 'STOCK_IN'
    finalQuantity = Math.abs(finalQuantity)
  } else if (['sale', 'transfer_out', 'stock_out'].includes(rawType)) {
    normalizedType = 'STOCK_OUT'
    finalQuantity = -Math.abs(finalQuantity)
  } else if (['damaged', 'expired', 'wastage'].includes(rawType)) {
    normalizedType = 'WASTAGE'
    finalQuantity = -Math.abs(finalQuantity)
  } else if (['return'].includes(rawType)) {
    normalizedType = 'RETURN'
    finalQuantity = Math.abs(finalQuantity)
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
  
  revalidatePath('/inventory/movements')
  revalidatePath('/inventory/stock')
  return { success: true }
}

export async function getBatches() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_batches')
    .select(`
      *,
      products(name, sku)
    `)
    .order('expiry_date', { ascending: true })
  
  if (error) throw new Error(error.message)
  return data
}

export async function createBatch(formData: FormData) {
  const product_id = formData.get('product_id') as string
  const batch_number = formData.get('batch_number') as string
  const quantity = parseInt(formData.get('quantity') as string)
  const manufacturing_date = formData.get('manufacturing_date') as string
  const expiry_date = formData.get('expiry_date') as string

  if (!product_id || !batch_number || !quantity || !expiry_date) return { error: 'Required fields missing' }

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
  
  // Also create a movement for the opening stock of this batch
  await supabase.from('inventory_movements').insert({
    organization_id: profile.organization_id,
    branch_id: branch.id,
    product_id,
    movement_type: 'STOCK_IN',
    quantity: quantity,
    notes: `Batch ${batch_number} received`,
    created_by: profile.id
  })

  revalidatePath('/inventory/batches')
  revalidatePath('/inventory/stock')
  return { success: true }
}

export async function getDashboardStats() {
  const supabase = await createClient()
  
  // 1. Get low stock products
  const productsData = await getStockLevels()
  const lowStockProducts = productsData.filter((p: any) => p.status === 'Low Stock').length

  // 2. Get expiring batches (next 30 days)
  const { data: batches } = await supabase
    .from('product_batches')
    .select('expiry_date')
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

  // 4. Get total products
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })

  return {
    lowStock: lowStockProducts,
    expiringBatches: expiringCount,
    totalCategories: categoryCount || 0,
    totalProducts: productCount || 0
  }
}

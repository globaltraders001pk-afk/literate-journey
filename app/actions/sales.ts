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
      address
    })

  if (error) return { error: error.message }
  
  revalidatePath('/sales/customers')
  return { success: true }
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

  const invoice_number = `INV-${Date.now().toString().slice(-6)}`

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

  // Create Sale Header
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

  // Create Sale Items & Inventory Movements
  for (const item of cart) {
    // 1. Insert sale item
    await supabase.from('sale_items').insert({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    })

    // 2. Insert inventory movement (deduct stock with valid enum STOCK_OUT)
    await supabase.from('inventory_movements').insert({
      organization_id: profile.organization_id,
      branch_id: branch.id,
      product_id: item.product_id,
      movement_type: 'STOCK_OUT',
      quantity: -item.quantity, // Negative for sale
      reference_type: 'sale',
      reference_id: sale.id,
      notes: `Sale ${invoice_number}`,
      created_by: profile.id
    })
  }

  // Update customer total_spent if applicable
  if (customerId) {
    // Fetch current customer to get total_spent
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
  }

  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/movements')
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
        customer:customers(id, name, phone, email),
        items:sale_items(
          id, quantity, unit_price, subtotal,
          product:products(id, name, sku)
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


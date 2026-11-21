import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ToolExecutionResult {
  success: boolean
  action: string
  details: string
  data?: any
}

export async function executeErpTool(
  toolName: string,
  args: Record<string, any>,
  profile: { id: string; role: string; organization_id: string; full_name: string }
): Promise<ToolExecutionResult> {
  const supabase = await createClient()
  const orgId = profile.organization_id

  // Fetch or ensure default branch
  let branchId: string
  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', orgId)
    .limit(1)
    .single()

  if (branch) {
    branchId = branch.id
  } else {
    const { data: newBranch } = await supabase
      .from('branches')
      .insert({ organization_id: orgId, name: 'Main Branch' })
      .select('id')
      .single()
    branchId = newBranch?.id || orgId
  }

  try {
    switch (toolName) {
      // ==================== INVENTORY & PRODUCTS ====================
      case 'create_product': {
        const {
          name,
          sku,
          category_name,
          cost_price,
          selling_price,
          unit,
          weight,
          minimum_stock_level,
          initial_stock
        } = args

        let categoryId: string | null = null
        if (category_name) {
          const { data: existingCat } = await supabase
            .from('categories')
            .select('id')
            .eq('organization_id', orgId)
            .ilike('name', category_name.trim())
            .limit(1)
            .single()

          if (existingCat) {
            categoryId = existingCat.id
          } else {
            const { data: newCat } = await supabase
              .from('categories')
              .insert({ organization_id: orgId, name: category_name.trim() })
              .select('id')
              .single()
            categoryId = newCat?.id || null
          }
        }

        const generatedSku = sku || `SKU-${Date.now().toString().slice(-5)}`

        const { data: product, error } = await supabase
          .from('products')
          .insert({
            organization_id: orgId,
            name: name.trim(),
            sku: generatedSku,
            category_id: categoryId,
            cost_price: Number(cost_price) || 0,
            selling_price: Number(selling_price) || 0,
            unit: unit || 'pcs',
            weight: weight || null,
            minimum_stock_level: Number(minimum_stock_level) || 0,
            is_active: true
          })
          .select('id, name, sku, cost_price, selling_price')
          .single()

        if (error) throw new Error(error.message)

        if (initial_stock && Number(initial_stock) > 0) {
          await supabase.from('inventory_movements').insert({
            organization_id: orgId,
            branch_id: branchId,
            product_id: product.id,
            movement_type: 'STOCK_IN',
            quantity: Number(initial_stock),
            notes: 'Initial opening stock via AI Agent',
            created_by: profile.id
          })
        }

        revalidatePath('/inventory/products')
        revalidatePath('/inventory/stock')
        revalidatePath('/dashboard')

        return {
          success: true,
          action: 'Product Created',
          details: `Added "${product.name}" (SKU: ${product.sku}) with cost Rs ${product.cost_price}, price Rs ${product.selling_price}${initial_stock ? `, initial stock: ${initial_stock}` : ''}.`,
          data: product
        }
      }

      case 'update_product': {
        const { product_name_or_sku, new_name, cost_price, selling_price, minimum_stock_level } = args

        const { data: products } = await supabase
          .from('products')
          .select('id, name, sku')
          .eq('organization_id', orgId)
          .or(`name.ilike.%${product_name_or_sku}%,sku.ilike.%${product_name_or_sku}%`)
          .limit(1)

        if (!products || products.length === 0) {
          return { success: false, action: 'Product Not Found', details: `Could not locate any product matching "${product_name_or_sku}".` }
        }

        const target = products[0]
        const updates: Record<string, any> = {}
        if (new_name) updates.name = new_name.trim()
        if (cost_price !== undefined) updates.cost_price = Number(cost_price)
        if (selling_price !== undefined) updates.selling_price = Number(selling_price)
        if (minimum_stock_level !== undefined) updates.minimum_stock_level = Number(minimum_stock_level)

        const { error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', target.id)

        if (error) throw new Error(error.message)

        revalidatePath('/inventory/products')
        revalidatePath('/inventory/stock')

        return {
          success: true,
          action: 'Product Updated',
          details: `Updated details for "${target.name}" (${target.sku}). Changes: ${JSON.stringify(updates)}`
        }
      }

      case 'adjust_inventory_stock': {
        const { product_name_or_sku, movement_type, quantity, notes } = args

        const { data: products } = await supabase
          .from('products')
          .select('id, name, sku')
          .eq('organization_id', orgId)
          .or(`name.ilike.%${product_name_or_sku}%,sku.ilike.%${product_name_or_sku}%`)
          .limit(1)

        if (!products || products.length === 0) {
          return { success: false, action: 'Product Not Found', details: `No product found for "${product_name_or_sku}".` }
        }

        const product = products[0]
        let qty = Math.abs(Number(quantity))
        if (['STOCK_OUT', 'WASTAGE'].includes(movement_type)) {
          qty = -qty
        }

        const { error } = await supabase.from('inventory_movements').insert({
          organization_id: orgId,
          branch_id: branchId,
          product_id: product.id,
          movement_type,
          quantity: qty,
          notes: notes || `Stock ${movement_type} via AI Agent`,
          created_by: profile.id
        })

        if (error) throw new Error(error.message)

        revalidatePath('/inventory/stock')
        revalidatePath('/inventory/movements')
        revalidatePath('/dashboard')

        return {
          success: true,
          action: 'Inventory Adjusted',
          details: `Recorded ${movement_type} of ${Math.abs(qty)} unit(s) for "${product.name}". Notes: ${notes || 'None'}`
        }
      }

      case 'create_product_batch': {
        const { product_name_or_sku, batch_number, quantity, expiry_date, manufacturing_date } = args

        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .eq('organization_id', orgId)
          .or(`name.ilike.%${product_name_or_sku}%,sku.ilike.%${product_name_or_sku}%`)
          .limit(1)

        if (!products || products.length === 0) {
          return { success: false, action: 'Product Not Found', details: `No product found for "${product_name_or_sku}".` }
        }

        const product = products[0]
        const qty = Number(quantity)

        const { error } = await supabase.from('product_batches').insert({
          organization_id: orgId,
          branch_id: branchId,
          product_id: product.id,
          batch_number,
          manufacturing_date: manufacturing_date || null,
          expiry_date,
          quantity_received: qty,
          quantity_remaining: qty
        })

        if (error) throw new Error(error.message)

        // Automatically record stock-in movement
        await supabase.from('inventory_movements').insert({
          organization_id: orgId,
          branch_id: branchId,
          product_id: product.id,
          movement_type: 'STOCK_IN',
          quantity: qty,
          notes: `Batch ${batch_number} added (Expiry: ${expiry_date}) via AI Agent`,
          created_by: profile.id
        })

        revalidatePath('/inventory/batches')
        revalidatePath('/inventory/stock')

        return {
          success: true,
          action: 'Batch Created',
          details: `Registered Batch "${batch_number}" for "${product.name}": ${qty} units expiring on ${expiry_date}.`
        }
      }

      case 'query_inventory': {
        const { filter = 'all', search_query } = args

        if (filter === 'expiring_batches') {
          const today = new Date()
          const nextMonth = new Date()
          nextMonth.setDate(today.getDate() + 30)

          const { data: batches } = await supabase
            .from('product_batches')
            .select('batch_number, expiry_date, quantity_remaining, products(name)')
            .eq('organization_id', orgId)
            .gt('quantity_remaining', 0)
            .lte('expiry_date', nextMonth.toISOString().split('T')[0])
            .order('expiry_date', { ascending: true })

          return {
            success: true,
            action: 'Expiring Batches Query',
            details: `Found ${batches?.length || 0} batches expiring in the next 30 days.`,
            data: batches
          }
        }

        let query = supabase
          .from('products')
          .select(`
            id, name, sku, selling_price, cost_price, minimum_stock_level, is_active,
            categories(name),
            inventory_movements(quantity)
          `)
          .eq('organization_id', orgId)
          .eq('is_active', true)

        if (filter === 'search' && search_query) {
          query = query.or(`name.ilike.%${search_query}%,sku.ilike.%${search_query}%`)
        }

        const { data: products } = await query

        const itemsWithStock = (products || []).map((p: any) => {
          const currentStock = (p.inventory_movements || []).reduce((acc: number, m: any) => acc + (m.quantity || 0), 0)
          return {
            name: p.name,
            sku: p.sku,
            category: p.categories?.name || 'Uncategorized',
            selling_price: p.selling_price,
            current_stock: currentStock,
            min_stock: p.minimum_stock_level,
            status: currentStock <= p.minimum_stock_level ? 'Low Stock' : 'Adequate'
          }
        })

        const resultData = filter === 'low_stock' 
          ? itemsWithStock.filter(i => i.status === 'Low Stock')
          : itemsWithStock

        return {
          success: true,
          action: 'Inventory Query',
          details: `Retrieved ${resultData.length} product records${filter === 'low_stock' ? ' flagged with low stock' : ''}.`,
          data: resultData
        }
      }

      // ==================== PURCHASING & VENDORS ====================
      case 'create_vendor': {
        const { name, contact_person, phone, email, address, items_supplied, rates } = args

        const { data: vendor, error } = await supabase
          .from('vendors')
          .insert({
            organization_id: orgId,
            name: name.trim(),
            contact_person: contact_person || null,
            phone: phone || null,
            email: email || null,
            address: address || null,
            items_supplied: items_supplied || null,
            rates: rates || null
          })
          .select('id, name')
          .single()

        if (error) throw new Error(error.message)

        revalidatePath('/purchases/vendors')
        return {
          success: true,
          action: 'Vendor Created',
          details: `Registered supplier "${vendor.name}". Contact: ${contact_person || 'N/A'}, Phone: ${phone || 'N/A'}.`,
          data: vendor
        }
      }

      case 'update_vendor': {
        const { vendor_name, phone, email, contact_person, items_supplied } = args

        const { data: vendors } = await supabase
          .from('vendors')
          .select('id, name')
          .eq('organization_id', orgId)
          .ilike('name', `%${vendor_name}%`)
          .limit(1)

        if (!vendors || vendors.length === 0) {
          return { success: false, action: 'Vendor Not Found', details: `No vendor found matching "${vendor_name}".` }
        }

        const target = vendors[0]
        const updates: Record<string, any> = {}
        if (phone) updates.phone = phone
        if (email) updates.email = email
        if (contact_person) updates.contact_person = contact_person
        if (items_supplied) updates.items_supplied = items_supplied

        const { error } = await supabase
          .from('vendors')
          .update(updates)
          .eq('id', target.id)

        if (error) throw new Error(error.message)

        revalidatePath('/purchases/vendors')
        return {
          success: true,
          action: 'Vendor Updated',
          details: `Updated information for vendor "${target.name}".`
        }
      }

      case 'create_purchase_order': {
        const { vendor_name, product_name, quantity, unit_price, po_number } = args

        const { data: vendors } = await supabase
          .from('vendors')
          .select('id, name')
          .eq('organization_id', orgId)
          .ilike('name', `%${vendor_name}%`)
          .limit(1)

        if (!vendors || vendors.length === 0) {
          return { success: false, action: 'Vendor Not Found', details: `Cannot create PO: vendor "${vendor_name}" not found.` }
        }

        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .eq('organization_id', orgId)
          .ilike('name', `%${product_name}%`)
          .limit(1)

        if (!products || products.length === 0) {
          return { success: false, action: 'Product Not Found', details: `Cannot create PO: product "${product_name}" not found.` }
        }

        const vendor = vendors[0]
        const product = products[0]
        const finalPoNum = po_number || `PO-${Date.now().toString().slice(-6)}`
        const totalAmount = Number(quantity) * Number(unit_price)

        const { data: po, error: poError } = await supabase
          .from('purchase_orders')
          .insert({
            organization_id: orgId,
            branch_id: branchId,
            vendor_id: vendor.id,
            po_number: finalPoNum,
            status: 'sent',
            total_amount: totalAmount,
            created_by: profile.id
          })
          .select('id, po_number')
          .single()

        if (poError) throw new Error(poError.message)

        await supabase.from('purchase_order_items').insert({
          po_id: po.id,
          product_id: product.id,
          quantity: Number(quantity),
          unit_price: Number(unit_price)
        })

        revalidatePath('/purchases/orders')
        return {
          success: true,
          action: 'Purchase Order Issued',
          details: `Created ${po.po_number} to "${vendor.name}" for ${quantity} x "${product.name}" (Rs ${unit_price} each). Total: Rs ${totalAmount}.`,
          data: po
        }
      }

      case 'query_vendors_and_orders': {
        const { query_type } = args

        if (query_type === 'vendors') {
          const { data: vendors } = await supabase
            .from('vendors')
            .select('name, contact_person, phone, email, items_supplied, is_active')
            .eq('organization_id', orgId)

          return { success: true, action: 'Vendors Query', details: `Found ${vendors?.length || 0} registered vendors.`, data: vendors }
        } else {
          const { data: orders } = await supabase
            .from('purchase_orders')
            .select(`
              po_number, status, total_amount, created_at,
              vendors(name),
              purchase_order_items(quantity, unit_price, products(name))
            `)
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false })
            .limit(10)

          return { success: true, action: 'Purchase Orders Query', details: `Found ${orders?.length || 0} recent purchase orders.`, data: orders }
        }
      }

      // ==================== EMPLOYEES, ATTENDANCE & PAYROLL ====================
      case 'create_employee': {
        const { first_name, last_name, role, base_salary, employment_type = 'full_time', phone, email } = args

        const { data: employee, error } = await supabase
          .from('employees')
          .insert({
            organization_id: orgId,
            branch_id: branchId,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            role: role.trim(),
            base_salary: Number(base_salary) || 0,
            employment_type,
            phone: phone || null,
            email: email || null,
            is_active: true
          })
          .select('id, first_name, last_name, role, base_salary')
          .single()

        if (error) throw new Error(error.message)

        revalidatePath('/employees/list')
        revalidatePath('/dashboard')

        return {
          success: true,
          action: 'Employee Added',
          details: `Added ${employee.first_name} ${employee.last_name} (${employee.role}) with base salary Rs ${employee.base_salary}/month.`,
          data: employee
        }
      }

      case 'record_attendance': {
        const { employee_name, status, date, check_in_time, check_out_time, notes } = args

        const { data: employees } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('organization_id', orgId)
          .or(`first_name.ilike.%${employee_name}%,last_name.ilike.%${employee_name}%`)
          .limit(1)

        if (!employees || employees.length === 0) {
          return { success: false, action: 'Employee Not Found', details: `No employee found matching "${employee_name}".` }
        }

        const employee = employees[0]
        const recordDate = date || new Date().toISOString().split('T')[0]

        // Check if attendance already exists for this date
        const { data: existing } = await supabase
          .from('attendance')
          .select('id')
          .eq('organization_id', orgId)
          .eq('employee_id', employee.id)
          .eq('date', recordDate)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('attendance')
            .update({
              status,
              check_in_time: check_in_time || null,
              check_out_time: check_out_time || null,
              notes: notes || null
            })
            .eq('id', existing.id)
        } else {
          await supabase
            .from('attendance')
            .insert({
              organization_id: orgId,
              employee_id: employee.id,
              date: recordDate,
              status,
              check_in_time: check_in_time || null,
              check_out_time: check_out_time || null,
              notes: notes || null
            })
        }

        revalidatePath('/employees/attendance')
        return {
          success: true,
          action: 'Attendance Recorded',
          details: `Logged attendance for ${employee.first_name} ${employee.last_name} on ${recordDate}: Status "${status}"${check_in_time ? ` (Check-in: ${check_in_time})` : ''}.`
        }
      }

      case 'mark_bulk_attendance': {
        const { present_employee_names = [], absent_employee_names = [], default_status_for_others, date } = args
        const recordDate = date || new Date().toISOString().split('T')[0]

        // Fetch all active employees
        const { data: employees, error: empErr } = await supabase
          .from('employees')
          .select('id, first_name, last_name, role')
          .eq('organization_id', orgId)
          .eq('is_active', true)

        if (empErr || !employees || employees.length === 0) {
          return {
            success: false,
            action: 'Bulk Attendance Failed',
            details: 'No active employees found in your organization.'
          }
        }

        const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

        const presentList = (Array.isArray(present_employee_names) ? present_employee_names : [present_employee_names]).filter(Boolean).map(normalize)
        const absentList = (Array.isArray(absent_employee_names) ? absent_employee_names : [absent_employee_names]).filter(Boolean).map(normalize)

        const results: Array<{ name: string; role: string; status: string }> = []

        for (const emp of employees) {
          const fullName = `${emp.first_name} ${emp.last_name}`
          const normFirst = normalize(emp.first_name)
          const normFull = normalize(fullName)

          let status = default_status_for_others || null

          // Check if matches present
          const isPresent = presentList.some(p => normFull.includes(p) || p.includes(normFirst) || normFirst.includes(p))
          if (isPresent) {
            status = 'present'
          } else {
            const isAbsent = absentList.some(a => normFull.includes(a) || a.includes(normFirst) || normFirst.includes(a))
            if (isAbsent) {
              status = 'absent'
            }
          }

          if (status) {
            const { data: existing } = await supabase
              .from('attendance')
              .select('id')
              .eq('organization_id', orgId)
              .eq('employee_id', emp.id)
              .eq('date', recordDate)
              .maybeSingle()

            if (existing) {
              await supabase
                .from('attendance')
                .update({ status })
                .eq('id', existing.id)
            } else {
              await supabase
                .from('attendance')
                .insert({
                  organization_id: orgId,
                  employee_id: emp.id,
                  date: recordDate,
                  status
                })
            }

            results.push({ name: fullName, role: emp.role, status })
          }
        }

        revalidatePath('/employees/attendance')

        const presentCount = results.filter(r => r.status === 'present').length
        const absentCount = results.filter(r => r.status === 'absent').length

        return {
          success: true,
          action: 'Bulk Attendance Logged',
          details: `Processed attendance on ${recordDate}: ${presentCount} Present, ${absentCount} Absent.`,
          data: results
        }
      }

      case 'generate_monthly_payroll': {
        const { month, year } = args

        const { data: employees } = await supabase
          .from('employees')
          .select('id, first_name, last_name, base_salary')
          .eq('organization_id', orgId)
          .eq('is_active', true)

        if (!employees || employees.length === 0) {
          return { success: false, action: 'Payroll Failed', details: 'No active employees found to generate payroll.' }
        }

        let createdCount = 0
        for (const emp of employees) {
          const { error } = await supabase.from('payroll').upsert({
            organization_id: orgId,
            employee_id: emp.id,
            month: Number(month),
            year: Number(year),
            basic_salary: emp.base_salary,
            deductions: 0,
            bonuses: 0,
            net_salary: emp.base_salary,
            status: 'draft'
          }, { onConflict: 'organization_id, employee_id, month, year' })

          if (!error) createdCount++
        }

        revalidatePath('/employees/payroll')
        return {
          success: true,
          action: 'Payroll Generated',
          details: `Generated payroll slips for ${createdCount} active employees for month ${month}/${year}.`
        }
      }

      case 'mark_payroll_paid': {
        const { employee_name, month, year } = args

        const { data: employees } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .eq('organization_id', orgId)
          .or(`first_name.ilike.%${employee_name}%,last_name.ilike.%${employee_name}%`)
          .limit(1)

        if (!employees || employees.length === 0) {
          return { success: false, action: 'Employee Not Found', details: `No employee matching "${employee_name}".` }
        }

        const employee = employees[0]
        const todayStr = new Date().toISOString().split('T')[0]

        const { error } = await supabase
          .from('payroll')
          .update({
            status: 'paid',
            payment_date: todayStr
          })
          .eq('organization_id', orgId)
          .eq('employee_id', employee.id)
          .eq('month', Number(month))
          .eq('year', Number(year))

        if (error) throw new Error(error.message)

        revalidatePath('/employees/payroll')
        return {
          success: true,
          action: 'Payroll Paid',
          details: `Marked salary as PAID for ${employee.first_name} ${employee.last_name} for period ${month}/${year}.`
        }
      }

      case 'query_employees_and_attendance': {
        const { query_type, date } = args

        if (query_type === 'attendance') {
          const queryDate = date || new Date().toISOString().split('T')[0]
          const { data: logs } = await supabase
            .from('attendance')
            .select(`
              date, status, check_in_time, check_out_time, notes,
              employees(first_name, last_name, role)
            `)
            .eq('organization_id', orgId)
            .eq('date', queryDate)

          return {
            success: true,
            action: 'Attendance Query',
            details: `Found ${logs?.length || 0} attendance records for ${queryDate}.`,
            data: logs
          }
        } else {
          const { data: staff } = await supabase
            .from('employees')
            .select('first_name, last_name, role, employment_type, base_salary, is_active, phone')
            .eq('organization_id', orgId)

          return {
            success: true,
            action: 'Staff Query',
            details: `Retrieved ${staff?.length || 0} team members.`,
            data: staff
          }
        }
      }

      // ==================== EXPENSES & FINANCE ====================
      case 'log_expense': {
        const { category_name, amount, expense_date, reference_number, notes } = args

        let categoryId: string | null = null
        if (category_name) {
          const { data: existingCat } = await supabase
            .from('expense_categories')
            .select('id')
            .eq('organization_id', orgId)
            .ilike('name', category_name.trim())
            .limit(1)
            .single()

          if (existingCat) {
            categoryId = existingCat.id
          } else {
            const { data: newCat } = await supabase
              .from('expense_categories')
              .insert({ organization_id: orgId, name: category_name.trim() })
              .select('id')
              .single()
            categoryId = newCat?.id || null
          }
        }

        const dateStr = expense_date || new Date().toISOString().split('T')[0]

        const { data: exp, error } = await supabase
          .from('expenses')
          .insert({
            organization_id: orgId,
            branch_id: branchId,
            category_id: categoryId,
            amount: Number(amount),
            expense_date: dateStr,
            reference_number: reference_number || `EXP-${Date.now().toString().slice(-4)}`,
            notes: notes || null,
            created_by: profile.id,
            status: 'approved'
          })
          .select('id, amount, reference_number')
          .single()

        if (error) throw new Error(error.message)

        revalidatePath('/expenses/ledger')
        revalidatePath('/expenses/cashflow')
        revalidatePath('/dashboard')

        return {
          success: true,
          action: 'Expense Logged',
          details: `Recorded expense of Rs ${exp.amount} under "${category_name}" on ${dateStr}. Ref: ${exp.reference_number}.`,
          data: exp
        }
      }

      case 'query_financial_summary': {
        const { period = 'this_month' } = args
        const now = new Date()
        let startDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`

        if (period === 'today') {
          startDate = now.toISOString().split('T')[0]
        } else if (period === 'all_time') {
          startDate = '2000-01-01'
        }

        const [{ data: sales }, { data: expenses }] = await Promise.all([
          supabase.from('sales').select('total_amount').eq('organization_id', orgId).gte('created_at', startDate),
          supabase.from('expenses').select('amount').eq('organization_id', orgId).gte('expense_date', startDate)
        ])

        const totalRevenue = (sales || []).reduce((acc, s) => acc + (Number(s.total_amount) || 0), 0)
        const totalExpenses = (expenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0)
        const netMargin = totalRevenue - totalExpenses

        return {
          success: true,
          action: 'Financial Summary',
          details: `Financials (${period}): Total Revenue: Rs ${totalRevenue.toFixed(2)}, Operational Expenses: Rs ${totalExpenses.toFixed(2)}, Net Profit: Rs ${netMargin.toFixed(2)}.`,
          data: { totalRevenue, totalExpenses, netMargin, salesCount: sales?.length || 0 }
        }
      }

      // ==================== TASKS & OPERATIONS ====================
      case 'create_task': {
        const { title, description, assigned_to_name, priority = 'medium', due_date } = args

        let assignedToId: string | null = null
        if (assigned_to_name) {
          const { data: userProfiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('organization_id', orgId)
            .ilike('full_name', `%${assigned_to_name}%`)
            .limit(1)

          if (userProfiles && userProfiles.length > 0) {
            assignedToId = userProfiles[0].id
          }
        }

        const { data: task, error } = await supabase
          .from('tasks')
          .insert({
            organization_id: orgId,
            title: title.trim(),
            description: description || null,
            assigned_to: assignedToId,
            priority,
            status: 'pending',
            due_date: due_date || null,
            created_by: profile.id
          })
          .select('id, title, priority')
          .single()

        if (error) throw new Error(error.message)

        revalidatePath('/tasks')
        revalidatePath('/dashboard')

        return {
          success: true,
          action: 'Task Assigned',
          details: `Assigned task "${task.title}" (Priority: ${task.priority})${assigned_to_name ? ` to ${assigned_to_name}` : ''}.`,
          data: task
        }
      }

      case 'update_task_status': {
        const { task_title, status } = args

        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('organization_id', orgId)
          .ilike('title', `%${task_title}%`)
          .limit(1)

        if (!tasks || tasks.length === 0) {
          return { success: false, action: 'Task Not Found', details: `No task found matching "${task_title}".` }
        }

        const target = tasks[0]
        const { error } = await supabase
          .from('tasks')
          .update({ status })
          .eq('id', target.id)

        if (error) throw new Error(error.message)

        revalidatePath('/tasks')
        revalidatePath('/dashboard')

        return {
          success: true,
          action: 'Task Status Updated',
          details: `Updated task "${target.title}" status to "${status}".`
        }
      }

      case 'query_tasks': {
        const { status_filter = 'all' } = args

        let query = supabase
          .from('tasks')
          .select(`
            id, title, priority, status, due_date,
            assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name)
          `)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })

        if (status_filter !== 'all') {
          query = query.eq('status', status_filter)
        }

        const { data: tasks } = await query

        return {
          success: true,
          action: 'Tasks Query',
          details: `Found ${tasks?.length || 0} task(s).`,
          data: tasks
        }
      }

      // ==================== ORGANIZATION SETTINGS ====================
      case 'update_organization_info': {
        const { name, phone, email, address } = args
        const updates: Record<string, any> = {}

        if (name) updates.name = name.trim()
        if (phone) updates.phone = phone.trim()
        if (email) updates.email = email.trim()
        if (address) updates.address = address.trim()

        const { error } = await supabase
          .from('organizations')
          .update(updates)
          .eq('id', orgId)

        if (error) throw new Error(error.message)

        revalidatePath('/settings')
        return {
          success: true,
          action: 'Organization Updated',
          details: `Updated organization settings: ${Object.keys(updates).join(', ')}.`
        }
      }

      case 'query_organization_info': {
        const { data: org } = await supabase
          .from('organizations')
          .select('name, phone, email, address, created_at')
          .eq('id', orgId)
          .single()

        return {
          success: true,
          action: 'Organization Details',
          details: `Business: ${org?.name || 'acme'}, Phone: ${org?.phone || 'Not set'}, Email: ${org?.email || 'Not set'}, Address: ${org?.address || 'Not set'}.`,
          data: org
        }
      }

      // ==================== CUSTOMERS ====================
      case 'create_customer': {
        const { name, phone, email, address } = args

        const { data: customer, error } = await supabase
          .from('customers')
          .insert({
            organization_id: orgId,
            name: name.trim(),
            phone: phone || null,
            email: email || null,
            address: address || null
          })
          .select('id, name')
          .single()

        if (error) throw new Error(error.message)

        revalidatePath('/sales/customers')
        return {
          success: true,
          action: 'Customer Created',
          details: `Registered customer "${customer.name}". Phone: ${phone || 'N/A'}.`,
          data: customer
        }
      }

      case 'query_customers': {
        const { search } = args
        let query = supabase
          .from('customers')
          .select('name, phone, email, address, total_spent')
          .eq('organization_id', orgId)

        if (search) {
          query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
        }

        const { data: customers } = await query

        return {
          success: true,
          action: 'Customer Query',
          details: `Found ${customers?.length || 0} customer record(s).`,
          data: customers
        }
      }

      // ==================== SALES & POS CHECKOUT ====================
      case 'create_sale_checkout': {
        const {
          product_name_or_sku,
          quantity,
          items = [],
          payment_method = 'CASH',
          customer_name_or_phone,
          notes
        } = args

        // 1. Build line items list
        const rawItems: Array<{ product_name_or_sku: string; quantity: number; unit_price?: number }> = []
        if (Array.isArray(items) && items.length > 0) {
          rawItems.push(...items)
        } else if (product_name_or_sku && quantity) {
          rawItems.push({ product_name_or_sku, quantity: Number(quantity) })
        }

        if (rawItems.length === 0) {
          return {
            success: false,
            action: 'Checkout Failed',
            details: 'No products or quantities specified for checkout.'
          }
        }

        // 2. Resolve each product from catalog
        const resolvedItems: Array<{
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          subtotal: number
        }> = []

        for (const it of rawItems) {
          const { data: products } = await supabase
            .from('products')
            .select('id, name, sku, selling_price')
            .eq('organization_id', orgId)
            .or(`name.ilike.%${it.product_name_or_sku}%,sku.ilike.%${it.product_name_or_sku}%`)
            .limit(1)

          if (!products || products.length === 0) {
            return {
              success: false,
              action: 'Product Not Found',
              details: `Cannot checkout: product "${it.product_name_or_sku}" was not found in your inventory.`
            }
          }

          const prod = products[0]
          const qty = Number(it.quantity) || 1
          const unitPrice = it.unit_price !== undefined ? Number(it.unit_price) : Number(prod.selling_price || 0)
          const subtotal = qty * unitPrice

          resolvedItems.push({
            product_id: prod.id,
            product_name: prod.name,
            quantity: qty,
            unit_price: unitPrice,
            subtotal
          })
        }

        const totalAmount = resolvedItems.reduce((acc, i) => acc + i.subtotal, 0)

        // 3. Resolve customer if provided
        let customerId: string | null = null
        let customerDisplayName: string | null = null
        if (customer_name_or_phone) {
          const { data: customers } = await supabase
            .from('customers')
            .select('id, name')
            .eq('organization_id', orgId)
            .or(`name.ilike.%${customer_name_or_phone}%,phone.ilike.%${customer_name_or_phone}%`)
            .limit(1)

          if (customers && customers.length > 0) {
            customerId = customers[0].id
            customerDisplayName = customers[0].name
          }
        }

        // 4. Normalize payment method
        let normalizedPayment: 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE' | 'CREDIT' = 'CASH'
        const upperPayment = (payment_method || 'CASH').toUpperCase()
        if (upperPayment === 'ONLINE' || upperPayment === 'UPI') {
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

        // 5. Ensure valid branch
        let effectiveBranchId = branchId
        if (!effectiveBranchId) {
          const { data: branch } = await supabase
            .from('branches')
            .select('id')
            .eq('organization_id', orgId)
            .limit(1)
            .single()

          if (branch) {
            effectiveBranchId = branch.id
          } else {
            const { data: newBranch } = await supabase
              .from('branches')
              .insert({ organization_id: orgId, name: 'Main Branch' })
              .select('id')
              .single()
            if (newBranch) effectiveBranchId = newBranch.id
          }
        }

        const invoice_number = `INV-${Date.now().toString().slice(-6)}`

        // 6. Insert into sales
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .insert({
            organization_id: orgId,
            branch_id: effectiveBranchId,
            customer_id: customerId,
            invoice_number,
            subtotal: totalAmount,
            total_amount: totalAmount,
            payment_method: normalizedPayment,
            created_by: profile.id
          })
          .select('id, invoice_number')
          .single()

        if (saleError) throw new Error(saleError.message)

        // 7. Batch insert sale_items and inventory_movements (STOCK_OUT) in parallel
        const saleItemsPayload = resolvedItems.map(item => ({
          sale_id: sale.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal
        }))

        const inventoryMovementsPayload = resolvedItems.map(item => ({
          organization_id: orgId,
          branch_id: effectiveBranchId,
          product_id: item.product_id,
          movement_type: 'STOCK_OUT',
          quantity: -item.quantity,
          reference_type: 'sale',
          reference_id: sale.id,
          notes: notes || `POS Sale Invoice ${invoice_number}`,
          created_by: profile.id
        }))

        const tasks: PromiseLike<any>[] = [
          supabase.from('sale_items').insert(saleItemsPayload),
          supabase.from('inventory_movements').insert(inventoryMovementsPayload)
        ]

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

        await Promise.all(tasks)

        revalidatePath('/sales/pos')
        revalidatePath('/sales/history')
        revalidatePath('/inventory/stock')
        revalidatePath('/inventory/movements')
        revalidatePath('/dashboard')

        const itemSummary = resolvedItems.map(i => `${i.quantity}x ${i.product_name} (Rs ${i.subtotal})`).join(', ')

        return {
          success: true,
          action: 'Sale Checkout Completed',
          details: `Invoice ${invoice_number}: Sold ${itemSummary} for a total of Rs ${totalAmount} via ${normalizedPayment}.${customerDisplayName ? ` Customer: ${customerDisplayName}.` : ''} Inventory stock was automatically reduced.`,
          data: {
            invoice_number,
            total_amount: totalAmount,
            payment_method: normalizedPayment,
            items: resolvedItems,
            customer: customerDisplayName
          }
        }
      }

      case 'query_sales_history': {
        const { period = 'all', days, limit = 50 } = args
        let startDate: string | null = null
        const now = new Date()

        if (days && Number(days) > 0) {
          startDate = new Date(now.getTime() - Number(days) * 24 * 60 * 60 * 1000).toISOString()
        } else if (period === 'today') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        } else if (period === 'yesterday') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
        } else if (period === 'this_week') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
        } else if (period === 'this_month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        } else if (period === 'last_30_days') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        } else if (period === 'last_50_days') {
          startDate = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString()
        } else if (period === 'last_90_days') {
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
        } else {
          const matchDays = String(period).match(/(\d+)\s*day/i)
          if (matchDays) {
            const numDays = parseInt(matchDays[1], 10)
            startDate = new Date(now.getTime() - numDays * 24 * 60 * 60 * 1000).toISOString()
          }
        }

        let query = supabase
          .from('sales')
          .select(`
            id, invoice_number, total_amount, payment_method, created_at,
            customer:customers(name),
            items:sale_items(quantity, unit_price, subtotal, product:products(name))
          `)
          .eq('organization_id', orgId)
          .order('created_at', { ascending: false })
          .limit(Number(limit) || 50)

        if (startDate) {
          query = query.gte('created_at', startDate)
        }

        const { data: sales, error: salesError } = await query
        if (salesError) throw new Error(salesError.message)

        const totalRevenue = (sales || []).reduce((acc: number, s: any) => acc + Number(s.total_amount || 0), 0)
        const totalTransactions = sales?.length || 0
        const periodLabel = days ? `past ${days} days` : period

        return {
          success: true,
          action: 'Sales History Query',
          details: `Retrieved ${totalTransactions} sale(s) totaling Rs ${totalRevenue.toFixed(2)} for ${periodLabel}.`,
          data: {
            period: periodLabel,
            totalRevenue,
            totalTransactions,
            sales: sales || []
          }
        }
      }

      default:
        return {
          success: false,
          action: 'Unknown Tool',
          details: `Tool "${toolName}" is not registered in the ERP executor.`
        }
    }
  } catch (err: any) {
    console.error(`Error executing ERP tool "${toolName}":`, err)
    return {
      success: false,
      action: 'Execution Failed',
      details: `Failed to execute ${toolName}: ${err?.message || 'Internal database error'}`
    }
  }
}

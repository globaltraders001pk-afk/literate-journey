// One tool parameter: `items` is the element shape of an ARRAY
// param (e.g. the items of a checkout), `properties` the fields
// of an OBJECT param — both recursive.
export interface ToolParameter {
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'INTEGER' | 'ARRAY' | 'OBJECT' | 'string' | 'number' | 'boolean' | 'integer' | 'array' | 'object'
  description?: string
  enum?: string[]
  items?: ToolParameter
  properties?: Record<string, ToolParameter>
  required?: string[]
}

export interface ToolDeclaration {
  name: string
  description: string
  parameters: {
    type: 'OBJECT' | 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}

export const ERP_TOOLS: ToolDeclaration[] = [
  // ==================== INVENTORY & PRODUCTS ====================
  {
    name: 'create_product',
    description: 'Add a new product to the business or store inventory catalog. Automatically assigns to the organization.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the product (e.g., "Aged Cheddar Cheese", "Organic Milk")' },
        sku: { type: 'STRING', description: 'Stock keeping unit code (e.g., "CHD-001")' },
        category_name: { type: 'STRING', description: 'Category name (e.g., "Dairy", "Beverages", "Meat"). If it does not exist, it will be automatically matched or created.' },
        cost_price: { type: 'NUMBER', description: 'Cost/purchase price per unit' },
        selling_price: { type: 'NUMBER', description: 'Retail/selling price per unit' },
        unit: { type: 'STRING', description: 'Unit of measurement (e.g., "kg", "pcs", "bottle", "wheel")' },
        weight: { type: 'STRING', description: 'Weight or volume details (e.g., "500g", "1L")' },
        minimum_stock_level: { type: 'INTEGER', description: 'Low stock threshold alert quantity' },
        initial_stock: { type: 'INTEGER', description: 'Initial stock on hand to record as opening stock' }
      },
      required: ['name', 'cost_price', 'selling_price']
    }
  },
  {
    name: 'update_product',
    description: 'Update an existing product details (prices, name, unit, minimum stock level).',
    parameters: {
      type: 'OBJECT',
      properties: {
        product_name_or_sku: { type: 'STRING', description: 'Name or SKU of the product to find and update' },
        new_name: { type: 'STRING', description: 'Updated name of the product' },
        cost_price: { type: 'NUMBER', description: 'New cost price' },
        selling_price: { type: 'NUMBER', description: 'New selling price' },
        minimum_stock_level: { type: 'INTEGER', description: 'New minimum stock alert level' }
      },
      required: ['product_name_or_sku']
    }
  },
  {
    name: 'adjust_inventory_stock',
    description: 'Record an inventory movement to adjust physical stock (e.g., receiving stock, spoilage/wastage, manual adjustment, or customer returns).',
    parameters: {
      type: 'OBJECT',
      properties: {
        product_name_or_sku: { type: 'STRING', description: 'Name or SKU of the product to adjust' },
        movement_type: { 
          type: 'STRING', 
          description: 'Type of movement: "STOCK_IN" (purchase/receiving), "STOCK_OUT" (consumed/sold), "WASTAGE" (expired/damaged/spoiled), "RETURN", or "ADJUSTMENT"',
          enum: ['STOCK_IN', 'STOCK_OUT', 'WASTAGE', 'RETURN', 'ADJUSTMENT']
        },
        quantity: { type: 'INTEGER', description: 'Positive number of units being moved or adjusted' },
        notes: { type: 'STRING', description: 'Reason or note for this movement (e.g., "Expired batch disposed", "Manual stock count adjustment")' }
      },
      required: ['product_name_or_sku', 'movement_type', 'quantity']
    }
  },
  {
    name: 'create_product_batch',
    description: 'Register a perishable product batch with manufacturing and expiration dates (vital for cheeses, meats, dairy).',
    parameters: {
      type: 'OBJECT',
      properties: {
        product_name_or_sku: { type: 'STRING', description: 'Name or SKU of the product' },
        batch_number: { type: 'STRING', description: 'Batch code or lot identifier (e.g., "LOT-2026-09A")' },
        quantity: { type: 'INTEGER', description: 'Quantity of units received in this batch' },
        expiry_date: { type: 'STRING', description: 'Expiration date in YYYY-MM-DD format' },
        manufacturing_date: { type: 'STRING', description: 'Manufacturing date in YYYY-MM-DD format (optional)' }
      },
      required: ['product_name_or_sku', 'batch_number', 'quantity', 'expiry_date']
    }
  },
  {
    name: 'query_inventory',
    description: 'Search products, check stock levels, view low-stock items, or check expiring batches.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filter: { 
          type: 'STRING', 
          description: 'Filter type: "all", "low_stock", "expiring_batches", or search query for specific product name',
          enum: ['all', 'low_stock', 'expiring_batches', 'search']
        },
        search_query: { type: 'STRING', description: 'Product name or SKU to search when filter is "search"' }
      }
    }
  },

  // ==================== PURCHASING & VENDORS ====================
  {
    name: 'create_vendor',
    description: 'Add a new supplier/vendor record with contact information, items supplied, and negotiated rates.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Name of the vendor or supplier company' },
        contact_person: { type: 'STRING', description: 'Primary contact person name' },
        phone: { type: 'STRING', description: 'Phone number' },
        email: { type: 'STRING', description: 'Email address' },
        address: { type: 'STRING', description: 'Physical address / city' },
        items_supplied: { type: 'STRING', description: 'Summary of items supplied (e.g., "Dairy, Fresh Cheeses, Milk")' },
        rates: { type: 'STRING', description: 'Pricing agreements or terms' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_vendor',
    description: 'Update an existing vendor details, contact info, or items supplied.',
    parameters: {
      type: 'OBJECT',
      properties: {
        vendor_name: { type: 'STRING', description: 'Name of the vendor to find' },
        phone: { type: 'STRING', description: 'New phone number' },
        email: { type: 'STRING', description: 'New email address' },
        contact_person: { type: 'STRING', description: 'Updated contact person' },
        items_supplied: { type: 'STRING', description: 'Updated items supplied' }
      },
      required: ['vendor_name']
    }
  },
  {
    name: 'create_purchase_order',
    description: 'Create a Purchase Order (PO) to a supplier for specified products.',
    parameters: {
      type: 'OBJECT',
      properties: {
        vendor_name: { type: 'STRING', description: 'Name of the vendor to order from' },
        product_name: { type: 'STRING', description: 'Product being ordered' },
        quantity: { type: 'INTEGER', description: 'Number of units ordered' },
        unit_price: { type: 'NUMBER', description: 'Agreed unit price' },
        po_number: { type: 'STRING', description: 'Custom PO number (if not provided, auto-generated)' },
        confirm: { type: 'BOOLEAN', description: 'Set to true ONLY after the owner explicitly confirms this financial write. The first call without confirm returns a preview and writes nothing.' }
      },
      required: ['vendor_name', 'product_name', 'quantity', 'unit_price']
    }
  },
  {
    name: 'query_vendors_and_orders',
    description: 'List suppliers or view recent purchase orders and their status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query_type: { 
          type: 'STRING', 
          description: 'What to query: "vendors" to list suppliers, or "purchase_orders" to see purchase orders',
          enum: ['vendors', 'purchase_orders']
        }
      },
      required: ['query_type']
    }
  },

  // ==================== EMPLOYEES, ATTENDANCE & PAYROLL ====================
  {
    name: 'create_employee',
    description: 'Add a new employee to the team with role, employment type, and base salary.',
    parameters: {
      type: 'OBJECT',
      properties: {
        first_name: { type: 'STRING', description: 'First name' },
        last_name: { type: 'STRING', description: 'Last name' },
        role: { type: 'STRING', description: 'Job title/role (e.g., "Chef", "Cashier", "Floor Manager", "Waiter")' },
        base_salary: { type: 'NUMBER', description: 'Monthly base salary' },
        employment_type: { 
          type: 'STRING', 
          description: 'Type: "full_time", "part_time", or "contract"',
          enum: ['full_time', 'part_time', 'contract']
        },
        phone: { type: 'STRING', description: 'Contact phone' },
        email: { type: 'STRING', description: 'Email address' }
      },
      required: ['first_name', 'last_name', 'role', 'base_salary']
    }
  },
  {
    name: 'record_attendance',
    description: 'Log daily attendance for an employee (Present, Late, Absent, Half-Day, Leave) with optional clock in/out times.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee_name: { type: 'STRING', description: 'Full or partial name of the employee (e.g., "Araf", "John")' },
        status: { 
          type: 'STRING', 
          description: 'Attendance status',
          enum: ['present', 'absent', 'half_day', 'leave']
        },
        date: { type: 'STRING', description: 'Date in YYYY-MM-DD format (defaults to today if omitted)' },
        check_in_time: { type: 'STRING', description: 'Time of arrival (e.g., "09:00", "09:15:00")' },
        check_out_time: { type: 'STRING', description: 'Time of departure (e.g., "17:00")' },
        notes: { type: 'STRING', description: 'Remarks (e.g., "Late due to heavy traffic", "Approved sick leave")' }
      },
      required: ['employee_name', 'status']
    }
  },
  {
    name: 'mark_bulk_attendance',
    description: 'Mark attendance for multiple employees at once. Ideal for commands like "mark X and Y present and everyone else absent".',
    parameters: {
      type: 'OBJECT',
      properties: {
        present_employee_names: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'List of employee names who are present today (e.g., ["Araf Muhammad", "Fasih Hussain Ahmed"])'
        },
        absent_employee_names: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'List of employee names who are explicitly absent'
        },
        default_status_for_others: {
          type: 'STRING',
          description: 'Attendance status for all other staff members not explicitly listed (e.g. "absent")',
          enum: ['present', 'absent', 'leave']
        },
        date: {
          type: 'STRING',
          description: 'Date in YYYY-MM-DD format (defaults to today if omitted)'
        }
      }
    }
  },
  {
    name: 'generate_monthly_payroll',
    description: 'Generate monthly payroll records for all active employees for a given month and year.',
    parameters: {
      type: 'OBJECT',
      properties: {
        month: { type: 'INTEGER', description: 'Month number (1 to 12)' },
        year: { type: 'INTEGER', description: 'Year (e.g., 2026)' },
        confirm: { type: 'BOOLEAN', description: 'Set to true ONLY after the owner explicitly confirms this financial write. The first call without confirm returns a preview and writes nothing.' }
      },
      required: ['month', 'year']
    }
  },
  {
    name: 'mark_payroll_paid',
    description: 'Mark an employee payroll slip as paid for a given month/year.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee_name: { type: 'STRING', description: 'Name of the employee' },
        month: { type: 'INTEGER', description: 'Month number (1 to 12)' },
        year: { type: 'INTEGER', description: 'Year (e.g., 2026)' },
        confirm: { type: 'BOOLEAN', description: 'Set to true ONLY after the owner explicitly confirms this financial write. The first call without confirm returns a preview and writes nothing.' }
      },
      required: ['employee_name', 'month', 'year']
    }
  },
  {
    name: 'query_employees_and_attendance',
    description: 'List employees, inspect salary details, or view today attendance records.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query_type: { 
          type: 'STRING', 
          description: 'What to query: "employees" for staff list and payroll, or "attendance" for attendance logs',
          enum: ['employees', 'attendance']
        },
        date: { type: 'STRING', description: 'Date in YYYY-MM-DD for attendance (defaults to today)' }
      },
      required: ['query_type']
    }
  },

  // ==================== EXPENSES & FINANCE ====================
  {
    name: 'log_expense',
    description: 'Record an operational expense (e.g., rent, utility bills, raw ingredient purchases, equipment repair).',
    parameters: {
      type: 'OBJECT',
      properties: {
        category_name: { type: 'STRING', description: 'Category name (e.g., "Utilities", "Rent", "Kitchen Supplies", "Maintenance")' },
        amount: { type: 'NUMBER', description: 'Total expense amount' },
        expense_date: { type: 'STRING', description: 'Date in YYYY-MM-DD (defaults to today if omitted)' },
        reference_number: { type: 'STRING', description: 'Receipt number or bill reference' },
        notes: { type: 'STRING', description: 'Explanation or details of what was paid' },
        confirm: { type: 'BOOLEAN', description: 'Set to true ONLY after the owner explicitly confirms this financial write. The first call without confirm returns a preview and writes nothing.' }
      },
      required: ['category_name', 'amount']
    }
  },
  {
    name: 'query_financial_summary',
    description: 'Retrieve financial metrics including sales revenue, operational expenses, gross profit, and cash flow.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: { 
          type: 'STRING', 
          description: 'Time frame: "today", "this_month", or "all_time"',
          enum: ['today', 'this_month', 'all_time']
        }
      }
    }
  },

  // ==================== TASKS & OPERATIONS ====================
  {
    name: 'create_task',
    description: 'Assign an operational task or duty to a team member with priority and due date.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Title of the task (e.g., "Audit refrigerator temperature", "Restock front display")' },
        description: { type: 'STRING', description: 'Detailed instructions' },
        assigned_to_name: { type: 'STRING', description: 'Name of the employee to assign this task to' },
        priority: { 
          type: 'STRING', 
          description: 'Priority level: "low", "medium", "high", or "urgent"',
          enum: ['low', 'medium', 'high', 'urgent']
        },
        due_date: { type: 'STRING', description: 'Due date in YYYY-MM-DD format' }
      },
      required: ['title']
    }
  },
  {
    name: 'update_task_status',
    description: 'Mark a task status as pending, in_progress, or completed.',
    parameters: {
      type: 'OBJECT',
      properties: {
        task_title: { type: 'STRING', description: 'Title or keyword of the task' },
        status: { 
          type: 'STRING', 
          description: 'New status',
          enum: ['pending', 'in_progress', 'completed']
        }
      },
      required: ['task_title', 'status']
    }
  },
  {
    name: 'query_tasks',
    description: 'List active, pending, or completed tasks across the business.',
    parameters: {
      type: 'OBJECT',
      properties: {
        status_filter: { 
          type: 'STRING', 
          description: 'Filter: "all", "pending", "in_progress", or "completed"',
          enum: ['all', 'pending', 'in_progress', 'completed']
        }
      }
    }
  },

  // ==================== ORGANIZATION SETTINGS ====================
  {
    name: 'update_organization_info',
    description: 'Update company settings, business name, phone number, official email, or address.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'New business name' },
        phone: { type: 'STRING', description: 'Contact phone' },
        email: { type: 'STRING', description: 'Business email' },
        address: { type: 'STRING', description: 'Official main address' }
      }
    }
  },
  {
    name: 'query_organization_info',
    description: 'View current organization information and branch details.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },

  // ==================== CUSTOMERS & SALES ====================
  {
    name: 'create_customer',
    description: 'Register a new customer for loyalty, sales history, and accounts.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Customer full name' },
        phone: { type: 'STRING', description: 'Phone number' },
        email: { type: 'STRING', description: 'Email address' },
        address: { type: 'STRING', description: 'Delivery/residential address' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_sale_checkout',
    description: 'Process a POS sales checkout transaction for one or more products. Automatically calculates totals from catalog prices, creates the invoice, deducts physical stock (STOCK_OUT), and logs payment method.',
    parameters: {
      type: 'OBJECT',
      properties: {
        product_name_or_sku: { type: 'STRING', description: 'Name or SKU of product when selling a single item (e.g. "Lays", "Cheese")' },
        quantity: { type: 'NUMBER', description: 'Number of units sold for single item' },
        items: {
          type: 'ARRAY',
          description: 'List of products sold when selling multiple items at once',
          items: {
            type: 'OBJECT',
            properties: {
              product_name_or_sku: { type: 'STRING', description: 'Product name or SKU' },
              quantity: { type: 'NUMBER', description: 'Quantity sold' },
              unit_price: { type: 'NUMBER', description: 'Optional custom selling price per unit' }
            },
            required: ['product_name_or_sku', 'quantity']
          }
        },
        payment_method: { 
          type: 'STRING', 
          description: 'Payment mode: "CASH", "CARD", "ONLINE", "BANK_TRANSFER", or "CREDIT"',
          enum: ['CASH', 'CARD', 'ONLINE', 'BANK_TRANSFER', 'CREDIT']
        },
        customer_name_or_phone: { type: 'STRING', description: 'Optional customer name or phone to attach to invoice' },
        notes: { type: 'STRING', description: 'Optional remarks or sale memo' },
        confirm: { type: 'BOOLEAN', description: 'Set to true ONLY after the owner explicitly confirms this financial write. The first call without confirm returns a preview and writes nothing.' }
      }
    }
  },
  {
    name: 'query_sales_history',
    description: 'View sales transactions, invoices, or revenue history for any timeframe or number of days.',
    parameters: {
      type: 'OBJECT',
      properties: {
        period: {
          type: 'STRING',
          description: 'Timeframe: "today", "yesterday", "this_week", "this_month", "last_30_days", "last_50_days", "last_90_days", or "all"'
        },
        days: {
          type: 'INTEGER',
          description: 'Custom number of past days to query sales for (e.g., 30, 50, 60, 90)'
        },
        limit: { type: 'INTEGER', description: 'Number of sales records to retrieve (default 50)' }
      }
    }
  }
]

// Money-action validation (QA audit M15, Phase 2).
//
// The repo had no validation framework: actions took raw
// parseFloat / parseInt results, negative amounts passed
// createExpense, free-text buyer_type / NTN / IBAN were stored
// raw. These zod schemas are the single place money-critical
// server actions validate their inputs. They reject negative
// amounts / quantities and NaN everywhere they are used; the
// SQL transaction functions are the second layer (they re-check
// the same bounds and raise, so a bad call can never write).
//
// Value lists come from the app / client sample only — nothing
// invented:
//  * buyer_type: the customer form's own placeholder
//    ("Registered, Unregistered") — the sample invoice only says
//    "[Confirm applicable FBR category]".
//  * NTN: Pakistan NTN, 7 digits with an optional -X suffix
//    (the customer form's placeholder is "1234567-8").
//  * IBAN: ISO 13616 — two-letter country + two check digits +
//    BBAN, verified with the mod-97 check.

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

/** Pakistan NTN: 7 digits, optional "-X" suffix (e.g. 1234567 or 1234567-8). */
export function isValidNtn(value: string): boolean {
  return /^\d{7}(-\d)?$/.test(value.trim())
}

/**
 * IBAN (ISO 13616): country + check digits + BBAN, mod-97 == 1.
 * Spaces are ignored (users paste "PK36 SCBL ..."). Pure JS,
 * computed digit-by-digit so no BigInt / float precision issue.
 */
export function isValidIban(value: string): boolean {
  const compact = value.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false
  const rearranged = compact.slice(4) + compact.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const code = ch >= 'A' && ch <= 'Z' ? ch.charCodeAt(0) - 55 : Number(ch)
    // code is 10-35 for letters (two digits) or 0-9 for digits.
    remainder = (remainder * (code >= 10 ? 100 : 10) + code) % 97
  }
  return remainder === 1
}

export const ntnSchema = z
  .string()
  .trim()
  .refine(isValidNtn, 'NTN must be 7 digits, with an optional -X suffix (e.g. 1234567-8)')

export const ibanSchema = z
  .string()
  .trim()
  .refine(isValidIban, 'IBAN is not valid (check the country code, check digits and account number)')

// Buyer categories the app already uses (customer form
// placeholder "Registered, Unregistered"). Nothing else is
// accepted — the FBR invoice prints this value verbatim.
export const BUYER_TYPES = ['Registered', 'Unregistered'] as const
export const buyerTypeSchema = z.enum(BUYER_TYPES)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** FormData gives '' for an empty input; treat it as "not given". */
export const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value

const uuidSchema = z.string().uuid('Invalid id')

/** Positive money: finite, > 0, at most 2 decimal places of sense (numeric column). */
const positiveAmount = z
  .number({ error: 'Amount must be a number' })
  .finite('Amount must be a valid number')
  .positive('Amount must be greater than zero')

const nonNegativeAmount = z
  .number({ error: 'Amount must be a number' })
  .finite('Amount must be a valid number')
  .nonnegative('Amount cannot be negative')

// ---------------------------------------------------------------------------
// Checkout (processCheckout) — client money is validated for
// shape only and then IGNORED: the SQL function re-prices from
// products.selling_price. totalAmount stays in the signature so
// the POS call site does not change.
// ---------------------------------------------------------------------------

export const checkoutSchema = z.object({
  cart: z
    .array(
      z.object({
        product_id: uuidSchema,
        quantity: z
          .number({ error: 'Quantity must be a number' })
          .int('Quantity must be a whole number')
          .min(1, 'Quantity must be at least 1')
          .max(10000, 'Quantity cannot exceed 10000'),
      })
    )
    .min(1, 'Cart is empty')
    .max(100, 'Cart has too many lines (max 100)'),
  customerId: uuidSchema.nullable(),
  paymentMethod: z.string().trim().min(1).max(20),
  // Shape-checked only — never used as money (see above).
  totalAmount: z.number().finite('Total must be a valid number'),
})

// ---------------------------------------------------------------------------
// Returns (processReturn)
// ---------------------------------------------------------------------------

export const RETURN_ACTIONS = ['restock', 'damage', 'discard'] as const

export const returnSchema = z.object({
  sale_id: uuidSchema,
  customer_id: uuidSchema.nullable(),
  returnItems: z
    .array(
      z.object({
        product_id: uuidSchema,
        quantity: z
          .number({ error: 'Quantity must be a number' })
          .int('Quantity must be a whole number')
          .min(1, 'Quantity must be at least 1')
          .max(10000, 'Quantity cannot exceed 10000'),
        return_action: z.enum(RETURN_ACTIONS, 'Invalid return action'),
        refund_amount: nonNegativeAmount,
      })
    )
    .min(1, 'No items to return')
    .max(100, 'Return has too many lines (max 100)'),
})

// ---------------------------------------------------------------------------
// Purchase receiving (receivePurchaseOrder)
// ---------------------------------------------------------------------------

export const receivePurchaseSchema = z.object({
  poId: uuidSchema,
  itemId: uuidSchema,
  productId: uuidSchema,
  quantity: z
    .number({ error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(10000, 'Quantity cannot exceed 10000'),
  // YYYY-MM-DD or null. Null means "no expiry stated" — never
  // invented by the server (the old today+30d bug).
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be YYYY-MM-DD')
    .nullable()
    .optional(),
})

// ---------------------------------------------------------------------------
// Customers (createCustomer)
// ---------------------------------------------------------------------------

export const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().max(30).optional(),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Invalid email address')
    .optional(),
  address: z.string().trim().max(500).optional(),
  ntn: ntnSchema.optional(),
  buyer_type: buyerTypeSchema.optional(),
})

// ---------------------------------------------------------------------------
// Expenses (createExpense)
// ---------------------------------------------------------------------------

export const expenseSchema = z.object({
  category_id: uuidSchema,
  amount: positiveAmount,
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expense date must be YYYY-MM-DD'),
  reference_number: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
})

// ---------------------------------------------------------------------------
// Employees (createEmployee / updateEmployee) — salary is money,
// so it is validated here, not with a bare parseFloat.
// ---------------------------------------------------------------------------

const employeeBaseSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().max(254).optional(),
  phone: z.string().trim().max(30).optional(),
  role: z.string().trim().min(1, 'Role is required').max(100),
  employment_type: z.string().trim().max(50).optional(),
  base_salary: z
    .number({ error: 'Base salary must be a number' })
    .finite('Base salary must be a valid number')
    .nonnegative('Base salary cannot be negative'),
  system_role: z.enum(['owner', 'admin', 'manager', 'employee']).optional(),
})

export const employeeCreateSchema = employeeBaseSchema.extend({
  create_login: z.boolean(),
  // Password strength (QA audit L3): at least 8 characters, with at
  // least one letter and one digit. Checked whenever a password is
  // supplied — createEmployee still only *requires* one when
  // create_login is on.
  password: z
    .string()
    .max(200)
    .optional()
    .refine((v) => v === undefined || isStrongPassword(v), {
      message:
        'Password must be at least 8 characters long and include at least one letter and one digit',
    }),
})

export const employeeUpdateSchema = employeeBaseSchema.extend({
  is_active: z.boolean(),
})

// ---------------------------------------------------------------------------
// Payroll (generatePayroll / payPayroll)
// ---------------------------------------------------------------------------

export const payrollGenerateSchema = z.object({
  month: z.number().int().min(1, 'Month must be between 1 and 12').max(12),
  year: z.number().int().min(2000, 'Year must be between 2000 and 2100').max(2100),
})

export const payrollPaySchema = z.object({
  payrollId: uuidSchema,
})

/** Password strength (QA audit L3): min 8 chars, at least one letter and one digit. */
export function isStrongPassword(value: string): boolean {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value)
}

/** First human-readable message from a zod parse failure. */
export function firstZodError(result: {
  success: boolean
  error?: z.ZodError
}): string | null {
  if (result.success) return null
  const issue = result.error?.issues[0]
  return issue?.message || 'Invalid input'
}

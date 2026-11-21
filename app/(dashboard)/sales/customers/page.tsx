import { getCustomers } from '@/app/actions/sales'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CustomerForm } from './customer-form'
import { truncationNote } from '@/lib/pagination'

export default async function CustomersPage() {
  const { rows: customers, total: customersTotal } = await getCustomers()
  const customersNote = truncationNote(customersTotal, customers.length, 'customers')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your customer database and purchase history.</p>
        </div>
        <CustomerForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>A list of all registered customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Added On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              )}
              {customers?.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone || '-'}</TableCell>
                  <TableCell>{customer.email || '-'}</TableCell>
                  <TableCell className="font-medium text-primary">${customer.total_spent || '0.00'}</TableCell>
                  <TableCell>{new Date(customer.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {customersNote && (
            <p className="text-xs text-muted-foreground mt-3">{customersNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

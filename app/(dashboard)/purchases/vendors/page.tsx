import { getVendors } from '@/app/actions/vendors'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { VendorForm } from './vendor-form'
import { truncationNote } from '@/lib/pagination'
import { VendorOrdersDialog } from './vendor-orders-dialog'

export default async function VendorsPage() {
  const { rows: vendors, total: vendorsTotal } = await getVendors()
  const vendorsNote = truncationNote(vendorsTotal, vendors.length, 'vendors')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Vendors & Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage material, equipment, and packaging suppliers, agreed rates, and order history.
          </p>
        </div>
        <VendorForm />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
          <CardDescription>A directory of all suppliers with supply details and transaction logs.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Items Supplied</TableHead>
                <TableHead>Agreed Rates</TableHead>
                <TableHead>Phone / Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No vendors found. Click &quot;Add Vendor&quot; to register your first supplier.
                  </TableCell>
                </TableRow>
              )}
              {vendors?.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium text-foreground">{vendor.name}</TableCell>
                  <TableCell className="text-sm">{vendor.contact_person || '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {vendor.items_supplied || '-'}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-foreground">
                    {vendor.rates || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{vendor.phone || '-'}</div>
                    <div className="text-[11px] text-muted-foreground/80">{vendor.email || ''}</div>
                  </TableCell>
                  <TableCell>
                    {vendor.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <VendorOrdersDialog vendorId={vendor.id} vendorName={vendor.name} />
                      <VendorForm initialData={vendor} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {vendorsNote && (
            <p className="text-xs text-muted-foreground mt-3">{vendorsNote}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

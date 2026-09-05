'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createVendor, updateVendor } from '@/app/actions/vendors'
import { Plus, Pencil } from 'lucide-react'

export function VendorForm({ initialData }: { initialData?: any }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const isEditing = !!initialData

  async function handleSubmit(formData: FormData) {
    setPending(true)
    if (isEditing) {
      await updateVendor(initialData.id, formData)
    } else {
      await createVendor(formData)
    }
    setPending(false)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        isEditing ? (
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        )
      } />
      <DialogContent className="max-w-md">
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update vendor details, items, and contract rates.' : 'Register a new supplier for cheese raw materials or packaging.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Company / Supplier Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Alpine Dairy Cooperative" defaultValue={initialData?.name} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact_person">Contact Person</Label>
                <Input id="contact_person" name="contact_person" placeholder="John Doe" defaultValue={initialData?.contact_person} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" placeholder="(555) 123-4567" defaultValue={initialData?.phone} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="orders@alpinedairy.com" defaultValue={initialData?.email} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="items_supplied">Items Supplied</Label>
              <Input id="items_supplied" name="items_supplied" placeholder="e.g. Raw Milk, Cultures, Rennet, Wax" defaultValue={initialData?.items_supplied} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rates">Agreed Rates / Terms</Label>
              <Input id="rates" name="rates" placeholder="e.g. $1.15/L Milk, Net 30" defaultValue={initialData?.rates} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Address / Facility</Label>
              <Input id="address" name="address" placeholder="123 Farm Valley Rd..." defaultValue={initialData?.address} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : (isEditing ? 'Update Vendor' : 'Save Vendor')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

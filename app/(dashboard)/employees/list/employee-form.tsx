'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createEmployee, updateEmployee } from '@/app/actions/employees'
import { Plus, Pencil } from 'lucide-react'

export function EmployeeForm({ initialData }: { initialData?: any }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const isEditing = !!initialData

  async function handleSubmit(formData: FormData) {
    setPending(true)
    const result = isEditing ? await updateEmployee(initialData.id, formData) : await createEmployee(formData)
    setPending(false)
    
    if (result?.error) {
      alert(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={isEditing ? <Button variant="ghost" size="icon" /> : <Button />}>
        {isEditing ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Add Employee
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update staff member details.' : 'Add a new staff member to the payroll.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" name="first_name" required defaultValue={initialData?.first_name} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" required defaultValue={initialData?.last_name} />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" defaultValue={initialData?.phone} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={initialData?.email} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2 col-span-1">
                <Label htmlFor="role">Job Title</Label>
                <Input id="role" name="role" required placeholder="e.g. Store Manager" defaultValue={initialData?.role} />
              </div>
              <div className="grid gap-2 col-span-1">
                <Label htmlFor="employment_type">Type</Label>
                <Select name="employment_type" defaultValue={initialData?.employment_type || "full_time"}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 col-span-1">
                <Label htmlFor="base_salary">Base Salary ($)</Label>
                <Input id="base_salary" name="base_salary" type="number" step="0.01" required defaultValue={initialData?.base_salary} />
              </div>
            </div>

            {!isEditing && (
              <div className="border-t pt-4 mt-2 space-y-3">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="create_login" name="create_login" defaultChecked className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <Label htmlFor="create_login" className="font-semibold">Provision System Login for this User</Label>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  Creates an ERP login account using the Email provided above. Select the user's operational permission level:
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="system_role">System Access Level</Label>
                  <Select name="system_role" defaultValue="manager">
                    <SelectTrigger>
                      <SelectValue placeholder="Select Access Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager (Inventory, Orders, Staff Attendance & Tasks)</SelectItem>
                      <SelectItem value="employee">Employee (POS Sales, Daily Stock In/Out, Personal Tasks)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="password">Temporary Password</Label>
                  <Input id="password" name="password" type="text" placeholder="Set a temporary password" />
                </div>
              </div>
            )}

            {isEditing && (
              <div className="border-t pt-4 mt-2 space-y-3">
                {initialData?.profile_id && (
                  <div className="grid gap-2">
                    <Label htmlFor="system_role">System Access Level</Label>
                    <Select name="system_role" defaultValue={initialData?.profiles?.role || 'employee'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Access Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">Manager (Inventory, Orders, Staff Attendance & Tasks)</SelectItem>
                        <SelectItem value="employee">Employee (POS Sales, Daily Stock In/Out, Personal Tasks)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <input 
                    type="checkbox" 
                    id="is_active" 
                    name="is_active" 
                    defaultChecked={initialData?.is_active}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
                  />
                  <Label htmlFor="is_active">Active Employee</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Unchecking this will mark the employee as inactive and immediately revoke their system login access.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : (isEditing ? 'Update Employee' : 'Save Employee')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

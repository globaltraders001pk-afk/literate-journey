'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteExpense } from '@/app/actions/expenses'
import { Trash2 } from 'lucide-react'

export function DeleteExpenseButton({ expenseId, expenseLabel }: { expenseId: string, expenseLabel: string }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const handleDelete = async () => {
    setPending(true)
    const result = await deleteExpense(expenseId)
    setPending(false)
    setOpen(false)
    if (result?.error) {
      alert(`Error: ${result.error}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 cursor-pointer" title="Delete expense">
          <Trash2 className="h-4 w-4" />
        </Button>
      } />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Expense</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <span className="font-semibold text-foreground">{expenseLabel}</span>?
            This removes it from the ledger and reports permanently.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex sm:justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function FbrInvoiceLoading() {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200">
      <div>
        <Skeleton className="h-7 w-36 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md mt-1" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <Card className="mx-auto max-w-3xl">
        <CardContent className="p-6 sm:p-8 space-y-5">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
            <Skeleton className="h-8 w-28 rounded" />
          </div>
          <Skeleton className="h-14 w-full rounded" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16 w-full rounded" />
            <Skeleton className="h-16 w-full rounded" />
          </div>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
          <div className="flex justify-end">
            <Skeleton className="h-10 w-64 rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

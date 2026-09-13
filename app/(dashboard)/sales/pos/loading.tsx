import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShoppingCart } from 'lucide-react'

export default function POSLoading() {
  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in-50 duration-200">
      {/* 1. Page Header */}
      <div>
        <Skeleton className="h-7 w-40 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded-md mt-1" />
      </div>

      {/* 2. Main Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
        {/* Left Column: Product Selection Cards */}
        <div className="lg:col-span-2 space-y-4 h-full flex flex-col">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-auto pb-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 flex flex-col items-center text-center justify-center h-32 space-y-2">
                  <Skeleton className="h-4 w-28 rounded" />
                  <Skeleton className="h-3.5 w-16 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column: Cart / Checkout Sidebar */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-muted-foreground/60" />
              <span>Current Sale</span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-auto space-y-3 min-h-[250px]">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-sm">
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-16 rounded" />
                  <Skeleton className="h-4 w-12 rounded" />
                  <Skeleton className="h-7 w-7 rounded" />
                </div>
              </div>
            ))}
          </CardContent>

          <div className="p-4 border-t bg-muted/10 space-y-4">
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Skeleton className="h-3.5 w-28 rounded" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
              <div className="grid gap-1.5">
                <Skeleton className="h-3.5 w-28 rounded" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>
            </div>

            <div className="pt-2 border-t flex justify-between items-center">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-6 w-24 rounded" />
            </div>

            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </Card>
      </div>
    </div>
  )
}

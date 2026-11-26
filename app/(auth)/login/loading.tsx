import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Store } from 'lucide-react'

export default function LoginLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-col items-center justify-center gap-2.5 text-center">
        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
          <Store className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Global Traders</h1>
          <p className="text-xs text-muted-foreground">Business & Inventory Management System</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your credentials below to access the management portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <span className="text-sm font-medium">Email</span>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Password</span>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Skeleton className="h-9 w-full rounded-md bg-primary/30" />
        </CardFooter>
      </Card>
    </div>
  )
}

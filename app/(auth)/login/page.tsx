'use client'

import { useActionState, useEffect, useState } from 'react'
import { login } from '@/app/actions/auth'
import { getPublicBrand } from '@/app/actions/organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { Store } from 'lucide-react'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)
  const [brand, setBrand] = useState<{ name: string; logo_url: string | null }>({
    name: 'Qurbat ERP',
    logo_url: null,
  })

  useEffect(() => {
    getPublicBrand().then((b) => {
      if (b) setBrand(b)
    })
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center gap-2.5 text-center">
        {brand.logo_url ? (
          <div className="h-14 w-14 rounded-2xl overflow-hidden border border-border/80 bg-background shadow-sm flex items-center justify-center p-1">
            <Image
              src={brand.logo_url}
              alt={brand.name}
              width={56}
              height={56}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Store className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{brand.name}</h1>
          <p className="text-xs text-muted-foreground">Business & Inventory Management System</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your credentials below to access the management portal</CardDescription>
        </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="m@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Logging in...' : 'Login'}
          </Button>
        </CardFooter>
      </form>
    </Card>
    </div>
  )
}

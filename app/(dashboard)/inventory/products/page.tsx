import { Suspense } from 'react'
import { getProducts, getCategories } from '@/app/actions/inventory'
import { getUserProfile } from '@/lib/auth-utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProductForm } from './product-form'
import { DeleteProductButton } from './delete-product-button'
import { ExportProductsButton } from './export-products-button'
import { Badge } from '@/components/ui/badge'
import ProductsLoading from './loading'
import { formatPKR } from '@/lib/format-currency'

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsLoading />}>
      <ProductsDataLoader />
    </Suspense>
  )
}

async function ProductsDataLoader() {
  const [products, categories, profile] = await Promise.all([
    getProducts(),
    getCategories(),
    getUserProfile()
  ])

  const canViewCost = profile?.role === 'owner' || profile?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your product catalog, weights, and pricing.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportProductsButton products={products || []} canViewCost={canViewCost} />
          <ProductForm categories={categories || []} canViewCost={canViewCost} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Products</CardTitle>
          <CardDescription>A list of all products in your catalog.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Weight / Size</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Price</TableHead>
                {canViewCost && <TableHead>Cost</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canViewCost ? 8 : 7} className="text-center text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
              {products?.map((prod: any) => (
                <TableRow key={prod.id}>
                  <TableCell className="font-medium">{prod.name}</TableCell>
                  <TableCell>{prod.categories?.name || '-'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{prod.weight || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{prod.sku || '-'}</TableCell>
                  <TableCell>{formatPKR(prod.selling_price)}</TableCell>
                  {canViewCost && (
                    <TableCell className="text-muted-foreground">{formatPKR(prod.cost_price)}</TableCell>
                  )}
                  <TableCell>
                    {prod.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ProductForm categories={categories || []} initialData={prod} canViewCost={canViewCost} />
                      <DeleteProductButton productId={prod.id} productName={prod.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

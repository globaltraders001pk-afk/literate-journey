import { getStockLevels } from '@/app/actions/inventory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default async function StockPage() {
  const stockLevels = await getStockLevels()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Stock Levels</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View real-time inventory levels calculated from movements.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Inventory</CardTitle>
          <CardDescription>Stock levels for all active products.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Min. Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockLevels?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No products found.
                  </TableCell>
                </TableRow>
              )}
              {stockLevels?.map((stock: any) => (
                <TableRow key={stock.id}>
                  <TableCell className="font-medium">{stock.name}</TableCell>
                  <TableCell>{stock.sku}</TableCell>
                  <TableCell className="text-base font-semibold">{stock.current_stock}</TableCell>
                  <TableCell>{stock.minimum_stock_level}</TableCell>
                  <TableCell>
                    {stock.status === 'Low Stock' ? (
                      <Badge variant="destructive">Low Stock</Badge>
                    ) : (
                      <Badge variant="default">In Stock</Badge>
                    )}
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

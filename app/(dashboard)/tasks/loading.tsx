import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Clock, ListTodo, CheckCircle2 } from 'lucide-react'

export default function TasksLoading() {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* 1. Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-border/40">
        <div>
          <Skeleton className="h-7 w-64 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-md mt-1.5" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* 2. Three Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500/50" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-14 rounded-md" />
            <Skeleton className="h-3 w-28 rounded mt-2" />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">In Progress</CardTitle>
            <ListTodo className="h-4 w-4 text-primary/50" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-14 rounded-md" />
            <Skeleton className="h-3 w-36 rounded mt-2" />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500/50" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-14 rounded-md" />
            <Skeleton className="h-3 w-32 rounded mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* 3. Task Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
          <CardDescription>All operational tasks across the organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-48 rounded" />
                    <Skeleton className="h-3 w-72 rounded mt-1.5" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-3.5 w-24 rounded" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-32 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 rounded-md" />
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

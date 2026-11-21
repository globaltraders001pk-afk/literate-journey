'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateTaskStatus, deleteTask } from '@/app/actions/tasks'
import { TaskForm } from './task-form'
import { CheckCircle2, Clock, Trash2, ListTodo } from 'lucide-react'

export function TasksClient({
  tasks,
  assignees,
  userRole,
}: {
  tasks: any[]
  assignees: any[]
  userRole: string
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const canManage = userRole === 'owner' || userRole === 'admin' || userRole === 'manager'

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    setLoadingId(taskId)
    await updateTaskStatus(taskId, newStatus)
    setLoadingId(null)
  }

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return
    setLoadingId(taskId)
    await deleteTask(taskId)
    setLoadingId(null)
  }

  const pendingCount = tasks.filter(t => t.status === 'pending').length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length
  const completedCount = tasks.filter(t => t.status === 'completed').length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {canManage ? 'Team Operations & Tasks' : 'My Assigned Tasks'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canManage 
              ? 'Assign, track, and oversee daily duties for cheese manufacturing, storage, and retail operations.'
              : 'View and mark progress on your assigned daily duties.'}
          </p>
        </div>
        {canManage && <TaskForm assignees={assignees} />}
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">In Progress</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently being handled</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Done and verified</p>
          </CardContent>
        </Card>
      </div>

      {/* Task Table */}
      <Card>
        <CardHeader>
          <CardTitle>Task List</CardTitle>
          <CardDescription>
            {canManage ? 'All operational tasks across the organization.' : 'Your active tasks.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                {canManage && <TableHead>Assigned To</TableHead>}
                <TableHead>Priority</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 4} className="text-center text-muted-foreground py-8">
                    No tasks found. {canManage && 'Click "Assign Task" to create one.'}
                  </TableCell>
                </TableRow>
              )}
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {task.description}
                      </div>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-sm">
                      {task.assigned_to_profile?.full_name || (
                        <span className="text-muted-foreground text-xs">Unassigned</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge
                      variant={
                        task.priority === 'high'
                          ? 'destructive'
                          : task.priority === 'medium'
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs capitalize"
                    >
                      {task.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {task.due_date || '-'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={task.status}
                      onValueChange={(val) => handleStatusChange(task.id, val)}
                      disabled={loadingId === task.id}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(task.id)}
                        disabled={loadingId === task.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

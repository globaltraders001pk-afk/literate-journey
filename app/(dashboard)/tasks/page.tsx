import { getTasks, getAssignees } from '@/app/actions/tasks'
import { getUserProfile, checkAccess } from '@/lib/auth-utils'
import { TasksClient } from './task-client'
import { truncationNote } from '@/lib/pagination'

export default async function TasksPage() {
  const profile = await checkAccess(['admin', 'owner', 'manager', 'employee'])

  const [{ rows: tasks, total: tasksTotal }, assignees] = await Promise.all([
    getTasks(),
    getAssignees(),
  ])
  const tasksNote = truncationNote(tasksTotal, tasks.length, 'tasks')

  return (
    <div className="space-y-4">
      {tasksNote && <p className="text-xs text-muted-foreground">{tasksNote}</p>}
      <TasksClient
        tasks={tasks}
        assignees={assignees}
        userRole={profile.role}
      />
    </div>
  )
}

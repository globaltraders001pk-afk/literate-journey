import { getTasks, getAssignees } from '@/app/actions/tasks'
import { getUserProfile, checkAccess } from '@/lib/auth-utils'
import { TasksClient } from './task-client'

export default async function TasksPage() {
  const profile = await checkAccess(['admin', 'owner', 'manager', 'employee'])

  const [tasks, assignees] = await Promise.all([
    getTasks(),
    getAssignees(),
  ])

  return (
    <TasksClient
      tasks={tasks}
      assignees={assignees}
      userRole={profile.role}
    />
  )
}

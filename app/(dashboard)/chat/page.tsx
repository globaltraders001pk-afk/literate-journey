import { getUserProfile } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ChatClient } from './chat-client'

export const metadata = {
  title: 'AI Command Chat - Qurbat ERP',
  description: 'ChatGPT-style autonomous AI agent command center for Qurbat ERP'
}

export default async function ChatPage() {
  const profile = await getUserProfile()

  if (!profile) {
    redirect('/login')
  }

  if (profile.role !== 'owner') {
    redirect('/dashboard?error=unauthorized')
  }

  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center bg-background text-muted-foreground text-sm">Loading AI Command Center...</div>}>
      <ChatClient profile={profile} />
    </Suspense>
  )
}

import { getUserProfile } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ChatClient } from './chat-client'

import ChatLoading from './loading'

export const metadata = {
  title: 'AI Command Chat - Global Traders',
  description: 'ChatGPT-style autonomous AI agent command center for Global Traders'
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
    <Suspense fallback={<ChatLoading />}>
      <ChatClient />
    </Suspense>
  )
}

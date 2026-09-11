import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/auth-utils'
import { createAgentStream, ChatMessage } from '@/lib/ai/gemini-client'

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce strict Owner-only authorization
    const profile = await getUserProfile()

    if (!profile) {
      return NextResponse.json(
        { error: 'Unauthorized: You must be logged in.' },
        { status: 401 }
      )
    }

    if (profile.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: The AI Agent is strictly restricted to the business owner.' },
        { status: 403 }
      )
    }

    // 2. Parse payload
    const body = await req.json()
    const messages: ChatMessage[] = body.messages || []

    if (!messages.length) {
      return NextResponse.json(
        { error: 'Message history is required.' },
        { status: 400 }
      )
    }

    // 3. Return real-time SSE stream
    const stream = createAgentStream(messages, profile)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    })
  } catch (error: any) {
    console.error('Unhandled error in /api/ai/chat:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/auth-utils'
import { createAgentStream, ChatMessage } from '@/lib/ai/gemini-client'
import { checkRateLimit } from '@/lib/rate-limit'

// AI chat abuse guards (QA audit M12): per-user fixed window,
// plus hard caps on the request itself — the old code parsed
// any body with no size or history limit.
const CHAT_RATE_LIMIT = 20 // requests per user ...
const CHAT_RATE_WINDOW_MS = 60_000 // ... per minute
const MAX_BODY_BYTES = 100_000 // ~100 KB of JSON
const MAX_MESSAGES = 50 // history turns per request
const MAX_MESSAGE_CHARS = 8_000 // chars per message

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

    // 2. Per-user rate limit (in-memory fixed window; see
    // lib/rate-limit.ts). The owner is the only caller, so the
    // key is the user id — a stolen session still cannot flood
    // the paid model endpoints.
    const rate = checkRateLimit(
      `ai-chat:${profile.id}`,
      CHAT_RATE_LIMIT,
      CHAT_RATE_WINDOW_MS
    )
    if (!rate.allowed) {
      return NextResponse.json(
        { error: `Too many AI requests. Try again in ${rate.retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
      )
    }

    // 3. Parse payload with a body-size cap first: req.json()
    // on an unbounded body lets a caller force a huge parse.
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: 'Request too large. Keep the chat history under 100 KB.' },
        { status: 413 }
      )
    }
    const body: { messages?: ChatMessage[] } = rawBody ? JSON.parse(rawBody) : {}
    const messages: ChatMessage[] = body.messages || []

    if (!messages.length) {
      return NextResponse.json(
        { error: 'Message history is required.' },
        { status: 400 }
      )
    }

    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: `Too many messages in one request (max ${MAX_MESSAGES}). Start a new chat.` },
        { status: 400 }
      )
    }

    const tooLong = messages.find(
      (m) => typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_CHARS
    )
    if (tooLong) {
      return NextResponse.json(
        { error: `One message is too long (max ${MAX_MESSAGE_CHARS} characters).` },
        { status: 400 }
      )
    }

    // 4. Return real-time SSE stream
    const stream = createAgentStream(messages, profile)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    })
  } catch (error: unknown) {
    console.error('Unhandled error in /api/ai/chat:', error)
    // Generic message: the old code returned the raw error (and
    // upstream provider bodies) to the client (QA audit M18).
    return NextResponse.json(
      { error: 'AI service error. Please try again.' },
      { status: 500 }
    )
  }
}

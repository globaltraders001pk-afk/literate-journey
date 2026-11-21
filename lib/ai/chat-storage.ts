'use client'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  actions?: {
    action: string
    details: string
    success: boolean
    data?: Record<string, unknown>
  }[]
}

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

const STORAGE_KEY = 'qurbat_ai_chat_sessions'

// No seeded sessions (QA audit fix-priority #10): the old code
// shipped three fake "sample" conversations with invented stock
// counts, attendance figures and a made-up Rs 342,000 expense
// total, presented as if they were real history. A fresh browser
// starts with an empty chat list; real sessions are only the
// ones the owner actually has.

export function getChatSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getChatSession(id: string): ChatSession | null {
  const sessions = getChatSessions()
  return sessions.find(s => s.id === id) || null
}

export function saveChatSession(session: ChatSession): void {
  if (typeof window === 'undefined') return
  try {
    const sessions = getChatSessions()
    const index = sessions.findIndex(s => s.id === session.id)
    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.unshift(session)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    window.dispatchEvent(new CustomEvent('qurbat-chats-changed'))
  } catch (err) {
    console.error('Failed to save chat session:', err)
  }
}

export function deleteChatSession(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const sessions = getChatSessions().filter(s => s.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
    window.dispatchEvent(new CustomEvent('qurbat-chats-changed'))
  } catch (err) {
    console.error('Failed to delete chat session:', err)
  }
}

export function createNewSession(firstUserPrompt: string): ChatSession {
  // Generate a clean concise title from prompt
  const cleanTitle = firstUserPrompt.trim()
  const title = cleanTitle.length > 28 
    ? cleanTitle.slice(0, 28) + '...' 
    : cleanTitle

  const now = new Date().toISOString()
  return {
    id: 'session-' + Date.now(),
    title: title || 'New Conversation',
    createdAt: now,
    updatedAt: now,
    messages: []
  }
}

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
    data?: any
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

const DEFAULT_SESSIONS: ChatSession[] = [
  {
    id: 'sample-session-1',
    title: 'Inventory & Stock Audit',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    messages: [
      {
        id: 's1-m1',
        role: 'user',
        content: 'Check low stock items and expiring batches',
        timestamp: '09:15 PM'
      },
      {
        id: 's1-m2',
        role: 'assistant',
        content: 'I checked your live inventory database. Found 2 items requiring attention:\n- **Smoked Cheddar**: 6 units remaining (Reorder threshold: 10)\n- **Almond Milk**: 4 units remaining (Reorder threshold: 8)',
        timestamp: '09:15 PM',
        actions: [
          {
            action: 'CHECK_STOCK_LEVELS',
            details: 'Audited 24 inventory items across Dairy & Beverage categories.',
            success: true
          }
        ]
      }
    ]
  },
  {
    id: 'sample-session-2',
    title: 'Daily Staff Attendance',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    messages: [
      {
        id: 's2-m1',
        role: 'user',
        content: 'Show attendance report for active shift today',
        timestamp: '06:30 PM'
      },
      {
        id: 's2-m2',
        role: 'assistant',
        content: 'All scheduled staff members are checked in for today’s evening shift. No unexcused absences recorded.',
        timestamp: '06:30 PM',
        actions: [
          {
            action: 'GET_ATTENDANCE_SUMMARY',
            details: 'Fetched attendance logs for 8 active staff members.',
            success: true
          }
        ]
      }
    ]
  },
  {
    id: 'sample-session-3',
    title: 'Operational Expenses Review',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    messages: [
      {
        id: 's3-m1',
        role: 'user',
        content: 'Summarize our operational expenses this month',
        timestamp: 'Yesterday'
      },
      {
        id: 's3-m2',
        role: 'assistant',
        content: 'Total operational expenses recorded this month: **Rs 342,000.00** across Utilities, Kitchen Supplies, and Maintenance.',
        timestamp: 'Yesterday',
        actions: [
          {
            action: 'GET_EXPENSES_SUMMARY',
            details: 'Aggregated expenses across 14 ledger entries.',
            success: true
          }
        ]
      }
    ]
  }
]

export function getChatSessions(): ChatSession[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      // Seed default starter sessions
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SESSIONS))
      return DEFAULT_SESSIONS
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : DEFAULT_SESSIONS
  } catch {
    return DEFAULT_SESSIONS
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
